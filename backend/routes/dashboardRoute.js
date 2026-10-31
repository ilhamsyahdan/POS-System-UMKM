const express = require("express");
const { getDashboardMetrics } = require("../controllers/dashboardController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const router = express.Router();

router.get("/metrics", isVerifiedUser, getDashboardMetrics);

module.exports = router;
