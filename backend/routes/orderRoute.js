const express = require("express");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const {
  addOrder,
  getOrders,
  getOrderById,
  updateOrder,
  getOrderStats,
} = require("../controllers/orderController");
const router = express.Router();

router.route("/").post(isVerifiedUser, addOrder);
router.route("/").get(isVerifiedUser, getOrders);

// HARUS di atas "/:id"
router.route("/stats").get(isVerifiedUser, getOrderStats);

router.route("/:id").get(isVerifiedUser, getOrderById);
router.route("/:id").patch(isVerifiedUser, updateOrder);

module.exports = router;
