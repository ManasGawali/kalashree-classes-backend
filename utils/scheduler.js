const cron = require("node-cron");
const User = require("../models/User");
const {
  getUserPaymentStatus,
} = require("./dateUtils");
const {
  MONTH_NAMES,
  sendFeeReminderEmail,
  sendAdminUnpaidReportEmail,
  sendAdminCumulativeReportEmail,
} = require("./sendEmail");

/**
 * Collect the unpaid-student data used by multiple jobs.
 * Returns { month, year, unpaidList, allStudentRows }
 */
async function collectFeeData() {
  const today = new Date();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();

  const users = await User.find({ isActive: true }).populate("batch");

  const unpaidList = [];
  const allStudentRows = [];

  for (const user of users) {
    if (!user.batch) continue; // skip orphan records
    const status = getUserPaymentStatus(user);
    const fee = user.batch.monthlyFee;

    if (!status.isUpToDate) {
      unpaidList.push({
        user,
        name: user.name,
        phone: user.phone,
        email: user.email,
        batch: user.batch.name,
        fee,
        dueMonth: status.dueMonth,
        dueYear: status.dueYear,
        dueSince: `${MONTH_NAMES[status.dueMonth]} ${status.dueYear}`,
        monthsOverdue: status.monthsOverdue,
        totalDue: status.monthsOverdue * fee,
      });
    }

    allStudentRows.push({
      name: user.name,
      phone: user.phone,
      batch: user.batch.name,
      feePerMonth: fee,
      monthsOverdue: status.monthsOverdue,
      totalOutstanding: status.isUpToDate ? 0 : status.monthsOverdue * fee,
    });
  }

  return { month, year, unpaidList, allStudentRows };
}

/* ------------------------------------------------------------------ */
/* Job 1: Student fee reminder — 10th of each month at 10:00 AM IST   */
/* ------------------------------------------------------------------ */
async function runStudentReminders() {
  console.log("[Scheduler] Running student fee reminder job...");
  try {
    const { unpaidList } = await collectFeeData();
    let sent = 0;
    for (const s of unpaidList) {
      if (!s.email) continue; // no email on file – skip
      const ok = await sendFeeReminderEmail(
        s.user,
        s.batch,
        s.fee,
        s.dueMonth,
        s.dueYear,
        s.monthsOverdue,
        s.totalDue
      );
      if (ok) sent++;
    }
    console.log(`[Scheduler] Fee reminders: ${sent}/${unpaidList.length} emails sent.`);
  } catch (err) {
    console.error("[Scheduler] Student reminder job error:", err.message);
  }
}

/* ------------------------------------------------------------------ */
/* Job 2: Admin unpaid report — 20th of each month at 10:00 AM IST    */
/* ------------------------------------------------------------------ */
async function runAdminUnpaidReport() {
  console.log("[Scheduler] Running admin unpaid report job...");
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.warn("[Scheduler] ADMIN_EMAIL not set — skipping admin unpaid report.");
      return;
    }
    const { month, year, unpaidList } = await collectFeeData();
    if (unpaidList.length === 0) {
      console.log("[Scheduler] No unpaid students — skipping admin report email.");
      return;
    }
    const ok = await sendAdminUnpaidReportEmail(adminEmail, month, year, unpaidList);
    console.log(`[Scheduler] Admin unpaid report: ${ok ? "sent" : "failed"}`);
  } catch (err) {
    console.error("[Scheduler] Admin unpaid report error:", err.message);
  }
}

/* ------------------------------------------------------------------ */
/* Job 3: Admin cumulative report — last day of month at 6:00 PM IST  */
/* ------------------------------------------------------------------ */
async function runAdminCumulativeReport() {
  console.log("[Scheduler] Running admin cumulative report job...");
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.warn("[Scheduler] ADMIN_EMAIL not set — skipping cumulative report.");
      return;
    }
    const { month, year, allStudentRows } = await collectFeeData();
    const grandTotal = allStudentRows.reduce((s, r) => s + r.totalOutstanding, 0);
    const ok = await sendAdminCumulativeReportEmail(adminEmail, month, year, allStudentRows, grandTotal);
    console.log(`[Scheduler] Admin cumulative report: ${ok ? "sent" : "failed"}`);
  } catch (err) {
    console.error("[Scheduler] Admin cumulative report error:", err.message);
  }
}

/* ------------------------------------------------------------------ */
/* Start all cron schedules                                            */
/* ------------------------------------------------------------------ */
function startScheduler() {
  // 10th of every month at 10:00 AM IST
  cron.schedule("0 10 10 * *", runStudentReminders, {
    timezone: "Asia/Kolkata",
  });
  console.log("[Scheduler] ✓ Student fee reminder — 10th of every month at 10:00 AM IST");

  // 20th of every month at 10:00 AM IST
  cron.schedule("0 10 20 * *", runAdminUnpaidReport, {
    timezone: "Asia/Kolkata",
  });
  console.log("[Scheduler] ✓ Admin unpaid report — 20th of every month at 10:00 AM IST");

  // Last day of every month at 6:00 PM IST
  // Cron doesn't natively support "last day", so we run on 28-31 and check
  cron.schedule("0 18 28-31 * *", () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    // Only run if tomorrow is the 1st (meaning today is the last day)
    if (tomorrow.getDate() === 1) {
      runAdminCumulativeReport();
    }
  }, {
    timezone: "Asia/Kolkata",
  });
  console.log("[Scheduler] ✓ Admin cumulative report — last day of every month at 6:00 PM IST");
}

module.exports = {
  startScheduler,
  // Exported for the admin test route
  runStudentReminders,
  runAdminUnpaidReport,
  runAdminCumulativeReport,
};
