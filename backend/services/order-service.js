const mongoose = require("mongoose");
const Order = require("../models/orderModel");
const Dish = require("../models/dishModel");
const Table = require("../models/tableModel");
const createHttpError = require("http-errors");
const crypto = require("crypto");

const ALLOWED_STATUS = ["in_progress", "ready", "completed"];

const addOrder = async (payload) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const orderCode = payload.orderCode || `ORDER-${crypto.randomUUID()}`;

    const existingOrder = await Order.findOne({ orderCode }).session(session);

    if (existingOrder) {
      throw createHttpError(400, "Order with this code already exists");
    }

    // 🔹 Stock validation
    for (const item of payload.items) {
      const dish = await Dish.findById(item.dishId).session(session);

      if (!dish) {
        throw createHttpError(404, `Dish not found: ${item.dishId}`);
      }

      if (dish.stock < item.quantity) {
        throw createHttpError(400, `Not enough stock for ${dish.name}`);
      }

      dish.stock -= item.quantity;
      await dish.save({ session });
    }

    // 🔹 TRANSFORM PAYLOAD → SCHEMA
    const orderPayload = {
      orderCode,
      orderStatus: "in_progress",

      customer: {
        name: payload.customerDetails.name,
        phone: String(payload.customerDetails.phone ?? ""),
        guests: payload.customerDetails.guests,
      },

      bills: payload.bills,
      table: payload.table,

      items: payload.items.map((item) => ({
        menuId: item.dishId,
        name: item.name,
        price: item.pricePerQuantity,
        qty: item.quantity,
      })),
    };

    const [order] = await Order.create([orderPayload], { session });

    if (payload.table) {
      await Table.findByIdAndUpdate(
        payload.table,
        {
          status: "Booked",
          currentOrder: order._id,
        },
        { session },
      );
    }

    await session.commitTransaction();
    session.endSession();

    return order;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const getOrderById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createHttpError(404, "Invalid Id!");
  }

  const order = await Order.findById(id);
  if (!order) {
    throw createHttpError(404, "Order Not Found!");
  }

  return order;
};

const getOrders = async ({
  status,
  period,
  search,
  page = 1,
  limit = 10,
} = {}) => {
  const query = {};

  // 🔹 Filter status
  if (status) {
    query.orderStatus = status;
  }

  // 🔹 Filter period
  if (period) {
    const now = new Date();
    let startDate;

    if (period === "weekly") {
      startDate = new Date();
      startDate.setDate(now.getDate() - 7);
    }

    if (period === "monthly") {
      startDate = new Date();
      startDate.setMonth(now.getMonth() - 1);
    }

    if (period === "yearly") {
      startDate = new Date();
      startDate.setFullYear(now.getFullYear() - 1);
    }

    if (startDate) {
      query.createdAt = { $gte: startDate };
    }
  }

  // search
  if (search) {
    query.$or = [
      {
        "customer.name": { $regex: search, $options: "i" },
      },
      {
        orderCode: { $regex: search, $options: "i" },
      },
    ];
  }
  // 🔹 Pagination
  const skip = (Number(page) - 1) * Number(limit);

  const [data, total] = await Promise.all([
    Order.find(query)
      .populate("table")
      .populate("payment")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Order.countDocuments(query),
  ]);

  return {
    data,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const updateOrder = async (id, orderStatus) => {
  if (!ALLOWED_STATUS.includes(orderStatus)) {
    throw createHttpError(400, "Invalid order status");
  }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createHttpError(404, "Invalid Id!");
  }

  const order = await Order.findById(id).populate("table");

  if (!order) {
    throw createHttpError(404, "Order Not Found!");
  }

  const validateNext = {
    in_progress: ["ready"],
    ready: ["completed"],
    completed: [],
  };

  const allowedNext = validateNext[order.orderStatus] || [];

  if (!allowedNext.includes(orderStatus)) {
    throw createHttpError(
      400,
      `Invalid status transition from ${order.orderStatus} to ${orderStatus}`,
    );
  }

  if (orderStatus === "completed") {
    const Payment = require("../models/paymentModel");

    const payment = await Payment.findOne({ order: order._id });

    if (!payment) {
      throw createHttpError(400, "Payment not found for this order");
    }

    if (payment.status !== "success") {
      throw createHttpError(
        400,
        "Order cannot be completed before payment success",
      );
    }
  }

  order.orderStatus = orderStatus;
  await order.save();

  if (orderStatus === "completed" && order.table?._id) {
    await Table.findByIdAndUpdate(order.table._id, {
      status: "Available",
      currentOrder: null,
    });
  }

  return order;
};

const calcPercentChange = (current, previous) => {
  if (previous === 0) return current === 0 ? 0 : null; // null = tidak bisa dihitung
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

const getOrderStats = async () => {
  const now = new Date();
  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [earningsAgg, inProgress] = await Promise.all([
    Order.aggregate([
      { $match: { orderStatus: "completed" } },
      {
        $group: {
          _id: null,
          all: { $sum: "$bills.totalWithTax" },
          thisMonth: {
            $sum: {
              $cond: [
                { $gte: ["$createdAt", startThisMonth] },
                "$bills.totalWithTax",
                0,
              ],
            },
          },
          lastMonth: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$createdAt", startLastMonth] },
                    { $lt: ["$createdAt", startThisMonth] },
                  ],
                },
                "$bills.totalWithTax",
                0,
              ],
            },
          },
        },
      },
    ]),
    Order.countDocuments({ orderStatus: "in_progress" }),
  ]);

  const e = earningsAgg[0] || { all: 0, thisMonth: 0, lastMonth: 0 };

  return {
    totalEarnings: e.all,
    earningsThisMonth: e.thisMonth,
    earningsChange: calcPercentChange(e.thisMonth, e.lastMonth),
    inProgress,
  };
};

module.exports = {
  addOrder,
  getOrderById,
  getOrders,
  updateOrder,
  getOrderStats,
};
