/**
 * Test script: triggers all 3 scheduled email jobs for manasmgawali@gmail.com
 * - Temporarily makes the student overdue so reminder + unpaid report fire
 * - Overrides ADMIN_EMAIL so the admin reports also go to that inbox
 * - Restores original data after sending
 *
 * Usage: node utils/testEmails.js
 */
require("dotenv").config();

// Override admin email to the Resend-verified address
process.env.ADMIN_EMAIL = "manasmgawali@gmail.com";

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const Batch = require("../models/Batch");
const {
  runStudentReminders,
  runAdminUnpaidReport,
  runAdminCumulativeReport,
} = require("./scheduler");

async function main() {
  await connectDB();

  // Find the student with that email
  const user = await User.findOne({ email: "manasmgawali@gmail.com" });
  if (!user) {
    console.error("No student found with manasmgawali@gmail.com");
    process.exit(1);
  }

  console.log(`Found student: ${user.name} (${user.phone})`);
  console.log(`Current paidTill: ${user.paidTillMonth}/${user.paidTillYear}`);

  // Save original values
  const origMonth = user.paidTillMonth;
  const origYear = user.paidTillYear;

  // Make them overdue: set paidTill to 3 months ago
  const now = new Date();
  let fakeMonth = now.getMonth() + 1 - 3; // 3 months behind
  let fakeYear = now.getFullYear();
  if (fakeMonth <= 0) { fakeMonth += 12; fakeYear -= 1; }

  user.paidTillMonth = fakeMonth;
  user.paidTillYear = fakeYear;
  await User.updateOne({ _id: user._id }, {
    $set: { paidTillMonth: fakeMonth, paidTillYear: fakeYear }
  });
  console.log(`Temporarily set paidTill to: ${fakeMonth}/${fakeYear} (3 months overdue)`);

  console.log("\n--- Running Job 1: Student Fee Reminders ---");
  await runStudentReminders();

  console.log("\n--- Running Job 2: Admin Unpaid Report ---");
  await runAdminUnpaidReport();

  console.log("\n--- Running Job 3: Admin Cumulative Report ---");
  await runAdminCumulativeReport();

  // Restore original values
  await User.updateOne({ _id: user._id }, {
    $set: { paidTillMonth: origMonth, paidTillYear: origYear }
  });
  console.log(`\nRestored paidTill to: ${origMonth}/${origYear}`);

  console.log("\n✓ All done! Check manasmgawali@gmail.com for 3 emails.");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
