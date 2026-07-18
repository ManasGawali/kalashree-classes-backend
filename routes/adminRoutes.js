const express = require("express");
const User = require("../models/User");
const Batch = require("../models/Batch");
const Payment = require("../models/Payment");
const { verifyToken, requireAdmin } = require("../middleware/auth");
const { getUserPaymentStatus } = require("../utils/dateUtils");
const { MONTH_NAMES, sendWelcomeEmail } = require("../utils/sendEmail");

const router = express.Router();
router.use(verifyToken, requireAdmin);

/* ------------------------------ DASHBOARD STATS ------------------------------ */
router.get("/stats", async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ isActive: true });
    const batches = await Batch.find();

    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    const monthPayments = await Payment.find({
      status: "completed",
      months: { $elemMatch: { month, year } },
    });
    const collectedThisMonth = monthPayments.reduce((sum, p) => {
      // Only count the portion of amount attributable to this month
      const perMonth = p.feePerMonthSnapshot;
      return sum + perMonth;
    }, 0);

    const studentsPerBatch = await User.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$batch", count: { $sum: 1 } } },
    ]);
    const batchMap = {};
    batches.forEach((b) => (batchMap[b._id] = { name: b.name, fee: b.monthlyFee, count: 0 }));
    studentsPerBatch.forEach((s) => {
      if (batchMap[s._id]) batchMap[s._id].count = s.count;
    });

    // Count students who are overdue right now
    const allUsers = await User.find({ isActive: true });
    let overdueCount = 0;
    allUsers.forEach((u) => {
      const status = getUserPaymentStatus(u);
      if (!status.isUpToDate) overdueCount += 1;
    });

    res.json({
      totalStudents,
      collectedThisMonth,
      overdueCount,
      batchBreakdown: Object.values(batchMap),
      currentMonthLabel: `${MONTH_NAMES[month]} ${year}`,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ------------------------------ CREATE STUDENT ------------------------------ */
// POST /api/admin/students - admin-only account creation (no public self-registration)
router.post("/students", async (req, res) => {
  try {
    const { name, phone, email, password, batchId, joinMonth, joinYear } = req.body;
    if (!name || !phone || !password || !batchId) {
      return res.status(400).json({ message: "Name, phone, password, and batch are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existingPhone = await User.findOne({ phone: phone.trim() });
    if (existingPhone) return res.status(400).json({ message: "A student with this phone number already exists" });

    if (email) {
      const existingEmail = await User.findOne({ email: email.toLowerCase() });
      if (existingEmail) return res.status(400).json({ message: "A student with this email already exists" });
    }

    const batch = await Batch.findById(batchId);
    if (!batch) return res.status(400).json({ message: "Invalid batch selected" });

    const today = new Date();
    const user = await User.create({
      name,
      phone: phone.trim(),
      email: email ? email.toLowerCase() : undefined,
      password,
      batch: batch._id,
      joinMonth: joinMonth || today.getMonth() + 1,
      joinYear: joinYear || today.getFullYear(),
    });

    if (user.email) {
      sendWelcomeEmail(user, batch.name, batch.monthlyFee, password).catch(() => {});
    }

    res.status(201).json({
      message: "Student account created successfully",
      user: { id: user._id, name: user.name, phone: user.phone, email: user.email, batch: batch.name },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* --------------------------- RESET STUDENT PASSWORD --------------------------- */
// PUT /api/admin/students/:id/reset-password - since there's no public self-service reset
router.put("/students/:id/reset-password", async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "Student not found" });

    user.password = newPassword; // pre-save hook hashes it
    await user.save();

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ------------------------- ACTIVATE / DEACTIVATE STUDENT ------------------------- */
router.put("/students/:id/status", async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: !!isActive }, { new: true });
    if (!user) return res.status(404).json({ message: "Student not found" });
    res.json({ message: `Student ${isActive ? "activated" : "deactivated"}`, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* --------------------------- STUDENT SEARCH / LIST --------------------------- */
router.get("/students", async (req, res) => {
  try {
    const { search = "", batch = "" } = req.query;
    const filter = { isActive: true };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
    if (batch) filter.batch = batch;

    const users = await User.find(filter).populate("batch").sort({ name: 1 });

    const results = users.map((u) => {
      const status = getUserPaymentStatus(u);
      return {
        id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        batch: u.batch.name,
        monthlyFee: u.batch.monthlyFee,
        paidTill: status.lastPaid
          ? `${MONTH_NAMES[status.lastPaid.month]} ${status.lastPaid.year}`
          : "Never paid",
        dueDate: `${MONTH_NAMES[status.dueMonth]} ${status.dueYear}`,
        isUpToDate: status.isUpToDate,
        monthsOverdue: status.monthsOverdue,
      };
    });

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ------------------------------ STUDENT DETAIL ------------------------------ */
router.get("/students/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate("batch");
    if (!user) return res.status(404).json({ message: "Student not found" });

    const status = getUserPaymentStatus(user);
    const payments = await Payment.find({ user: user._id }).sort({ createdAt: -1 });

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        batch: user.batch.name,
        monthlyFee: user.batch.monthlyFee,
        joined: `${MONTH_NAMES[user.joinMonth]} ${user.joinYear}`,
      },
      paidTill: status.lastPaid
        ? `${MONTH_NAMES[status.lastPaid.month]} ${status.lastPaid.year}`
        : "Never paid",
      dueDate: `${MONTH_NAMES[status.dueMonth]} ${status.dueYear}`,
      isUpToDate: status.isUpToDate,
      monthsOverdue: status.monthsOverdue,
      payments,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* --------------------- BATCH-WISE, MONTH-WISE FEE COLLECTION --------------------- */
// GET /api/admin/fees?month=7&year=2026&batch=<id optional>
router.get("/fees", async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const { batch } = req.query;

    const userFilter = { isActive: true };
    if (batch) userFilter.batch = batch;
    const users = await User.find(userFilter).populate("batch");

    const paymentsThisMonth = await Payment.find({
      status: "completed",
      months: { $elemMatch: { month, year } },
    });
    const paidUserIds = new Set(paymentsThisMonth.map((p) => String(p.user)));

    const rows = users.map((u) => ({
      id: u._id,
      name: u.name,
      batch: u.batch.name,
      monthlyFee: u.batch.monthlyFee,
      paid: paidUserIds.has(String(u._id)),
    }));

    const totalCollected = rows.filter((r) => r.paid).reduce((s, r) => s + r.monthlyFee, 0);
    const totalPending = rows.filter((r) => !r.paid).reduce((s, r) => s + r.monthlyFee, 0);

    res.json({
      month,
      year,
      label: `${MONTH_NAMES[month]} ${year}`,
      rows,
      totalCollected,
      totalPending,
      paidCount: rows.filter((r) => r.paid).length,
      pendingCount: rows.filter((r) => !r.paid).length,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ------------------------------ REJECT A PAYMENT ------------------------------ */
router.put("/payments/:id/reject", async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    payment.status = "rejected";
    payment.rejectionReason = req.body.reason || "Rejected by admin";
    await payment.save();

    // Recompute the user's paidTill from remaining completed payments
    const user = await User.findById(payment.user);
    const completed = await Payment.find({ user: user._id, status: "completed" });

    let latest = null;
    completed.forEach((p) => {
      p.months.forEach((m) => {
        if (!latest || m.year > latest.year || (m.year === latest.year && m.month > latest.month)) {
          latest = m;
        }
      });
    });

    user.paidTillMonth = latest ? latest.month : null;
    user.paidTillYear = latest ? latest.year : null;
    await user.save();

    res.json({ message: "Payment rejected and student's due date recalculated", payment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
