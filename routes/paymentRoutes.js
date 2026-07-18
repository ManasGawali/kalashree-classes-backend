const express = require("express");
const User = require("../models/User");
const Payment = require("../models/Payment");
const { verifyToken, requireUser } = require("../middleware/auth");
const { getUserPaymentStatus, addMonths, compareMY } = require("../utils/dateUtils");
const { generateUpiQR } = require("../utils/generateQR");
const { sendPaymentConfirmationEmail } = require("../utils/sendEmail");

const router = express.Router();

/**
 * Validates that the requested months are exactly a contiguous run starting
 * at the user's current due month. This keeps the "paidTillMonth" cache
 * simple and prevents users from cherry-picking random future months while
 * skipping the ones actually owed.
 */
function validateContiguousFromDue(months, dueMonth, dueYear) {
  if (!Array.isArray(months) || months.length === 0) return false;
  const sorted = [...months].sort((a, b) => (a.year - b.year) || (a.month - b.month));
  let cursor = { month: dueMonth, year: dueYear };
  for (const m of sorted) {
    if (compareMY(m, cursor) !== 0) return false;
    cursor = addMonths(cursor, 1);
  }
  return sorted;
}

// POST /api/payments/quote - calculate amount & get QR for chosen months
router.post("/quote", verifyToken, requireUser, async (req, res) => {
  try {
    const user = await User.findById(req.auth.id).populate("batch");
    const status = getUserPaymentStatus(user);

    const sortedMonths = validateContiguousFromDue(req.body.months, status.dueMonth, status.dueYear);
    if (!sortedMonths) {
      return res.status(400).json({
        message: "Selected months must start from your current due month and be consecutive.",
      });
    }

    const amount = sortedMonths.length * user.batch.monthlyFee;
    const note = `Kalashree Fees - ${user.name} - ${sortedMonths.length} mo`;
    const { dataUrl } = await generateUpiQR(amount, note);

    res.json({ amount, months: sortedMonths, qrDataUrl: dataUrl, feePerMonth: user.batch.monthlyFee });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/payments/submit - record transaction ID & finalize payment
router.post("/submit", verifyToken, requireUser, async (req, res) => {
  try {
    const { months, transactionId } = req.body;
    if (!transactionId || transactionId.trim().length < 4) {
      return res.status(400).json({ message: "Please enter a valid transaction ID" });
    }

    const user = await User.findById(req.auth.id).populate("batch");
    const status = getUserPaymentStatus(user);

    const sortedMonths = validateContiguousFromDue(months, status.dueMonth, status.dueYear);
    if (!sortedMonths) {
      return res.status(400).json({
        message: "Selected months must start from your current due month and be consecutive.",
      });
    }

    const amount = sortedMonths.length * user.batch.monthlyFee;

    const payment = await Payment.create({
      user: user._id,
      batch: user.batch._id,
      batchNameSnapshot: user.batch.name,
      feePerMonthSnapshot: user.batch.monthlyFee,
      months: sortedMonths,
      amount,
      transactionId: transactionId.trim(),
      status: "completed", // manual UPI - auto-marked; admin can review/flag later
    });

    // Advance the user's paidTill pointer to the last month in this payment
    const last = sortedMonths[sortedMonths.length - 1];
    user.paidTillMonth = last.month;
    user.paidTillYear = last.year;
    await user.save();

    const emailed = await sendPaymentConfirmationEmail(user, payment);
    payment.emailSent = emailed;
    await payment.save();

    res.status(201).json({ message: "Payment recorded successfully", payment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/payments/mine - full payment history for logged in user
router.get("/mine", verifyToken, requireUser, async (req, res) => {
  const payments = await Payment.find({ user: req.auth.id }).sort({ createdAt: -1 });
  res.json(payments);
});

module.exports = router;
