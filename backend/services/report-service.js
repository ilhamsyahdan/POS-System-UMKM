const Order = require("../models/orderModel");
const Payment = require("../models/paymentModel");

const TIMEZONE = "Asia/Jakarta";
const WIB_OFFSET = 7 * 60 * 60 * 1000; // WIB = UTC+7, tanpa DST
const DAY = 24 * 60 * 60 * 1000;

const PERIOD_LABELS = {
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  month: "This Month",
  year: "This Year",
  all: "All Time",
};

// ---------- Helper tanggal (batas hari/bulan/tahun menurut WIB) ----------
const toWib = (date) => new Date(date.getTime() + WIB_OFFSET);
const fromWib = (ms) => new Date(ms - WIB_OFFSET);

const startOfDay = (date) => {
  const w = toWib(date);
  return fromWib(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()));
};

const startOfMonth = (date, shift = 0) => {
  const w = toWib(date);
  return fromWib(Date.UTC(w.getUTCFullYear(), w.getUTCMonth() + shift, 1));
};

const startOfYear = (date, shift = 0) => {
  const w = toWib(date);
  return fromWib(Date.UTC(w.getUTCFullYear() + shift, 0, 1));
};

const normalizePeriod = (range) => {
  if (range === "week") return "7d"; // nilai lama
  return PERIOD_LABELS[range] ? range : "all";
};

const resolvePeriod = (range) => {
  const type = normalizePeriod(range);
  const now = new Date();
  let start = null;
  let prevStart = null;
  let prevEnd = null;

  if (type === "7d" || type === "30d") {
    const days = type === "7d" ? 7 : 30;
    start = new Date(startOfDay(now).getTime() - (days - 1) * DAY);
    prevStart = new Date(start.getTime() - days * DAY);
    prevEnd = start;
  } else if (type === "month") {
    start = startOfMonth(now);
    prevStart = startOfMonth(now, -1);
    // bandingkan dengan rentang yang sama panjangnya, bukan bulan penuh
    prevEnd = new Date(
      Math.min(prevStart.getTime() + (now - start), start.getTime()),
    );
  } else if (type === "year") {
    start = startOfYear(now);
    prevStart = startOfYear(now, -1);
    prevEnd = new Date(
      Math.min(prevStart.getTime() + (now - start), start.getTime()),
    );
  }

  return { type, start, end: now, prevStart, prevEnd };
};

// null = tidak ada pembanding (periode sebelumnya 0 atau "All Time")
const calcGrowth = (current, previous) => {
  if (!previous) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

// ---------- Service ----------
const getSalesReport = async (range) => {
  const { type, start, end, prevStart, prevEnd } = resolvePeriod(range);

  const match = start ? { createdAt: { $gte: start, $lte: end } } : {};
  const prevMatch = prevStart
    ? { createdAt: { $gte: prevStart, $lt: prevEnd } }
    : null;

  const [
    revenueAgg,
    statusAgg,
    revenueByMethod,
    topItems,
    revenueTrend,
    prevRevenueAgg,
    prevTotalOrders,
  ] = await Promise.all([
    // Ringkasan revenue (hanya order completed)
    Order.aggregate([
      { $match: { orderStatus: "completed", ...match } },
      {
        $group: {
          _id: null,
          netRevenue: { $sum: "$bills.total" },
          taxTotal: { $sum: "$bills.tax" },
          grossRevenue: { $sum: "$bills.totalWithTax" },
        },
      },
    ]),

    // Jumlah order per status
    Order.aggregate([
      { $match: match },
      { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
    ]),

    // Revenue per metode bayar (dari order completed + payment yang success)
    Order.aggregate([
      { $match: { orderStatus: "completed", ...match } },
      {
        $lookup: {
          from: Payment.collection.name,
          let: { orderId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$order", "$$orderId"] },
                status: "success",
              },
            },
            { $limit: 1 },
          ],
          as: "paymentDoc",
        },
      },
      { $unwind: { path: "$paymentDoc", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ["$paymentDoc.paymentMethod", "unknown"] },
          total: { $sum: "$bills.total" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]),

    // Produk terlaris
    Order.aggregate([
      { $match: { orderStatus: "completed", ...match } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          qty: { $sum: "$items.qty" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
        },
      },
      { $sort: { qty: -1, revenue: -1, _id: 1 } },
      { $limit: 5 },
    ]),

    // Tren harian (tanggal menurut WIB)
    Order.aggregate([
      { $match: { orderStatus: "completed", ...match } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: TIMEZONE,
            },
          },
          revenue: { $sum: "$bills.total" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Periode sebelumnya
    prevMatch
      ? Order.aggregate([
          { $match: { orderStatus: "completed", ...prevMatch } },
          { $group: { _id: null, netRevenue: { $sum: "$bills.total" } } },
        ])
      : Promise.resolve([]),
    prevMatch ? Order.countDocuments(prevMatch) : Promise.resolve(0),
  ]);

  const statusBreakdown = { in_progress: 0, ready: 0, completed: 0 };
  statusAgg.forEach((s) => {
    statusBreakdown[s._id] = s.count;
  });

  const totalOrders = Object.values(statusBreakdown).reduce(
    (sum, n) => sum + n,
    0,
  );
  const completedOrders = statusBreakdown.completed;

  const netRevenue = revenueAgg[0]?.netRevenue || 0;
  const prevNetRevenue = prevRevenueAgg[0]?.netRevenue || 0;

  return {
    period: { type, label: PERIOD_LABELS[type] },
    range: {
      start,
      end: start ? end : null,
      timezone: TIMEZONE,
      daysCount: start ? Math.ceil((end - start) / DAY) : null,
    },
    summary: {
      netRevenue,
      taxTotal: revenueAgg[0]?.taxTotal || 0,
      grossRevenue: revenueAgg[0]?.grossRevenue || 0,
      totalOrders,
      completedOrders,
      inProgressOrders: statusBreakdown.in_progress,
      readyOrders: statusBreakdown.ready,
      completionRate:
        totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0,
      avgOrderValue:
        completedOrders > 0 ? Math.round(netRevenue / completedOrders) : 0,
      revenueGrowth: prevMatch ? calcGrowth(netRevenue, prevNetRevenue) : null,
      ordersGrowth: prevMatch ? calcGrowth(totalOrders, prevTotalOrders) : null,
    },
    statusBreakdown,
    revenueByMethod,
    topItems,
    revenueTrend,
  };
};

module.exports = { getSalesReport };
