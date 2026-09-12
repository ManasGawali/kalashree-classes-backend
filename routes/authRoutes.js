const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const Admin = require("../models/Admin");
const OTP = require("../models/OTP");
const { sendOtpEmail, sendPasswordResetOtpEmail } = require("../utils/sendEmail");

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

    //const sent = await sendOtpEmail(admin.email, otp);
    //if (!sent) return res.status(500).json({ message: "Failed to send OTP email" });

    res.json({ message: "OTP sent to registered admin email" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* -------------------------- ADMIN: VERIFY OTP -------------------------- */
router.post("/admin/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    //const record = await OTP.findOne({ email: email?.toLowerCase(), otp });
    //if (!record) return res.status(400).json({ message: "Invalid or expired OTP" });

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) return res.status(400).json({ message: "Admin not found" });

    await OTP.deleteMany({ email: admin.email });

    const token = signToken(admin._id, "admin");
    res.json({ token, admin: { id: admin._id, name: admin.name, email: admin.email } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* -------------------- USER: FORGOT PASSWORD – REQUEST OTP -------------------- */
router.post("/forgot-password", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone number is required" });

    const user = await User.findOne({ phone: phone.trim() });
    if (!user) return res.status(404).json({ message: "No account found with this phone number" });
    if (!user.email) return res.status(400).json({ message: "No email is registered for this account. Please contact the admin to reset your password." });
    if (!user.isActive) return res.status(403).json({ message: "This account has been deactivated" });

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    await OTP.deleteMany({ email: user.email }); // clear old OTPs
    await OTP.create({ email: user.email, otp });

    // Mask email for privacy: "m***s@gmail.com"
    const [local, domain] = user.email.split("@");
    const masked = local.length <= 2
      ? local[0] + "***@" + domain
      : local[0] + "***" + local[local.length - 1] + "@" + domain;

    const sent = await sendPasswordResetOtpEmail(user.email, otp, user.name);
    if (!sent) return res.status(500).json({ message: "Failed to send OTP email. Please try again." });

    res.json({ message: "OTP sent to your registered email", maskedEmail: masked });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* -------------------- USER: FORGOT PASSWORD – VERIFY OTP -------------------- */
router.post("/forgot-password/verify-otp", async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ message: "Phone and OTP are required" });

    const user = await User.findOne({ phone: phone.trim() });
    if (!user) return res.status(404).json({ message: "No account found" });

    const record = await OTP.findOne({ email: user.email, otp });
    if (!record) return res.status(400).json({ message: "Invalid or expired OTP" });

    // Clear used OTP
    await OTP.deleteMany({ email: user.email });

    // Issue a short-lived reset token (10 min) so the client can call /reset
    const resetToken = jwt.sign(
      { id: user._id, purpose: "password-reset" },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );

    res.json({ message: "OTP verified", resetToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* -------------------- USER: FORGOT PASSWORD – RESET PASSWORD -------------------- */
router.post("/forgot-password/reset", async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) return res.status(400).json({ message: "Reset token and new password are required" });
    if (newPassword.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

    let payload;
    try {
      payload = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ message: "Reset link has expired. Please request a new OTP." });
    }

    if (payload.purpose !== "password-reset") {
      return res.status(400).json({ message: "Invalid reset token" });
    }

    const user = await User.findById(payload.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = newPassword; // pre-save hook will hash it
    await user.save();

    res.json({ message: "Password reset successful. You can now login with your new password." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
