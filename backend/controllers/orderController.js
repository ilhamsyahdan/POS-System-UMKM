const orderService = require("../services/order-service");
const Order = require("../models/orderModel");

// CREATE
const addOrder = async (req, res, next) => {
  try {
    const order = await orderService.addOrder(req.body);
    res.status(201).json({
      success: true,
      message: "Order Created!",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// GET BY ID
const getOrderById = async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(req.params.id);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

// GET ALL
const getOrders = async (req, res, next) => {
  try {
    const orders = await orderService.getOrders(req.query);
    res.status(200).json({ success: true, ...orders });
  } catch (error) {
    next(error);
  }
};

// UPDATE
const updateOrder = async (req, res, next) => {
  try {
    const { orderStatus } = req.body;

    if (!orderStatus) {
      return res.status(400).json({
        success: false,
        message: "orderStatus is required",
      });
    }
    const order = await orderService.updateOrder(req.params.id, orderStatus);
    res
      .status(200)
      .json({ success: true, message: "Order Updated!", data: order });
  } catch (error) {
    console.error("error update: ", error);

    next(error);
  }
};

const getOrderStats = async (req, res, next) => {
  try {
    const stats = await orderService.getOrderStats();
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addOrder,
  getOrderById,
  getOrders,
  updateOrder,
  getOrderStats,
};
