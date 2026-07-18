const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const Admin = require("../models/Admin");
const OTP = require("../models/OTP");
const { sendOtpEmail } = require("../utils/sendEmail");

const router = express.Router();

function signToken(id, role) {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

/* ------------------------------ USER: LOGIN ------------------------------ */
// Students are created by admin only (see /api/admin/students). Login is by phone number.
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ message: "Phone number and password are required" });
    }
    const user = await User.findOne({ phone: phone.trim() }).populate("batch");
    if (!user) return res.status(401).json({ message: "Invalid phone number or password" });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: "Invalid phone number or password" });

    if (!user.isActive) return res.status(403).json({ message: "This account has been deactivated" });

    const token = signToken(user._id, "user");
    res.json({
      token,
      user: { id: user._id, name: user.name, phone: user.phone, batch: user.batch.name },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ------------------------- ADMIN: REQUEST OTP LOGIN ------------------------- */
router.post("/admin/request-otp", async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email: email?.toLowerCase() });
    if (!admin) return res.status(401).json({ message: "Invalid credentials" });

    const match = await admin.comparePassword(password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    await OTP.deleteMany({ email: admin.email }); // clear old OTPs
    await OTP.create({ email: admin.email, otp });

    const sent = await sendOtpEmail(admin.email, otp);
    if (!sent) return res.status(500).json({ message: "Failed to send OTP email" });

    res.json({ message: "OTP sent to registered admin email" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* -------------------------- ADMIN: VERIFY OTP -------------------------- */
router.post("/admin/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const record = await OTP.findOne({ email: email?.toLowerCase(), otp });
    if (!record) return res.status(400).json({ message: "Invalid or expired OTP" });

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) return res.status(400).json({ message: "Admin not found" });

    await OTP.deleteMany({ email: admin.email });

    const token = signToken(admin._id, "admin");
    res.json({ token, admin: { id: admin._id, name: admin.name, email: admin.email } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
