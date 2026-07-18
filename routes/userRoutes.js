const express = require("express");
const User = require("../models/User");
const Payment = require("../models/Payment");
const { verifyToken, requireUser } = require("../middleware/auth");
const { getUserPaymentStatus, getPayableMonths } = require("../utils/dateUtils");
const { MONTH_NAMES } = require("../utils/sendEmail");

const router = express.Router();

// GET /api/user/dashboard - paid-till date, due date, payable months, history
router.get("/dashboard", verifyToken, requireUser, async (req, res) => {
  try {
    const user = await User.findById(req.auth.id).populate("batch");
    if (!user) return res.status(404).json({ message: "User not found" });

    const status = getUserPaymentStatus(user);
    const payableMonths = getPayableMonths(status.dueMonth, status.dueYear, 12);

    const recentPayments = await Payment.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        batch: { id: user.batch._id, name: user.batch.name, monthlyFee: user.batch.monthlyFee },
      },
      paidTill: status.lastPaid
        ? `${MONTH_NAMES[status.lastPaid.month]} ${status.lastPaid.year}`
        : "Not paid yet",
      dueDate: `${MONTH_NAMES[status.dueMonth]} ${status.dueYear}`,
      isUpToDate: status.isUpToDate,
      monthsOverdue: status.monthsOverdue,
      payableMonths,
      recentPayments,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
