const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || "Kalashree Music Classes <onboarding@resend.dev>";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

async function sendMail({ to, subject, html }) {
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
    return true;
  } catch (err) {
    console.error("Resend email error:", err.message);
    return false;
  }
}

function wrapTemplate(title, bodyHtml) {
  return `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width:560px; margin:0 auto; background:#ffffff;">
    <div style="background:#6F4E37; padding:24px; text-align:center;">
      <h1 style="color:#fff; margin:0; font-size:20px; letter-spacing:0.5px;">Kalashree Music Classes</h1>
    </div>
    <div style="padding:28px; color:#3a2c22; line-height:1.6;">
      <h2 style="color:#6F4E37; font-size:18px;">${title}</h2>
      ${bodyHtml}
    </div>
    <div style="padding:16px; text-align:center; background:#F5EDE4; color:#8a7666; font-size:12px;">
      Kalashree Music Classes • This is an automated email
    </div>
  </div>`;
}

async function sendOtpEmail(email, otp) {
  const html = wrapTemplate(
    "Admin Login OTP",
    `<p>Your one-time password for admin login is:</p>
     <p style="font-size:28px; font-weight:bold; letter-spacing:6px; color:#6F4E37;">${otp}</p>
     <p>This OTP is valid for 5 minutes. If you did not request this, please ignore this email.</p>`
  );
  return sendMail({ to: email, subject: "Your Admin Login OTP - Kalashree Music Classes", html });
}

async function sendPaymentConfirmationEmail(user, payment) {
  if (!user.email) return false; // no email on file - nothing to send
  const monthsList = payment.months
    .map((m) => `${MONTH_NAMES[m.month]} ${m.year}`)
    .join(", ");
  const html = wrapTemplate(
    "Payment Received - Thank You!",
    `<p>Dear ${user.name},</p>
     <p>We have received your fee payment. Here are the details:</p>
     <table style="width:100%; border-collapse:collapse; margin:16px 0;">
       <tr><td style="padding:8px 0; color:#8a7666;">Batch</td><td style="padding:8px 0; text-align:right; font-weight:600;">${payment.batchNameSnapshot}</td></tr>
       <tr><td style="padding:8px 0; color:#8a7666;">Month(s)</td><td style="padding:8px 0; text-align:right; font-weight:600;">${monthsList}</td></tr>
       <tr><td style="padding:8px 0; color:#8a7666;">Amount Paid</td><td style="padding:8px 0; text-align:right; font-weight:600;">Rs. ${payment.amount}/-</td></tr>
       <tr><td style="padding:8px 0; color:#8a7666;">Transaction ID</td><td style="padding:8px 0; text-align:right; font-weight:600;">${payment.transactionId}</td></tr>
     </table>
     <p>Thank you for staying current with your monthly fees.</p>`
  );
  return sendMail({ to: user.email, subject: "Payment Confirmation - Kalashree Music Classes", html });
}

async function sendWelcomeEmail(user, batchName, fee, tempPassword) {
  if (!user.email) return false; // no email on file - nothing to send
  const html = wrapTemplate(
    "Welcome to Kalashree Music Classes!",
    `<p>Dear ${user.name},</p>
     <p>Your student account has been created by the admin. Here are your login details:</p>
     <table style="width:100%; border-collapse:collapse; margin:16px 0;">
       <tr><td style="padding:8px 0; color:#8a7666;">Login Phone Number</td><td style="padding:8px 0; text-align:right; font-weight:600;">${user.phone}</td></tr>
       <tr><td style="padding:8px 0; color:#8a7666;">Temporary Password</td><td style="padding:8px 0; text-align:right; font-weight:600;">${tempPassword}</td></tr>
       <tr><td style="padding:8px 0; color:#8a7666;">Batch</td><td style="padding:8px 0; text-align:right; font-weight:600;">${batchName}</td></tr>
       <tr><td style="padding:8px 0; color:#8a7666;">Monthly Fee</td><td style="padding:8px 0; text-align:right; font-weight:600;">Rs. ${fee}/-</td></tr>
     </table>
     <p>Please log in with your phone number and this password. If you'd like it changed, contact the admin.</p>
     <p>You can check your payment status and pay your monthly fees anytime from your dashboard.</p>`
  );
  return sendMail({ to: user.email, subject: "Welcome to Kalashree Music Classes - Your Login Details", html });
}

async function sendPasswordResetOtpEmail(email, otp, studentName) {
  const html = wrapTemplate(
    "Password Reset OTP",
    `<p>Dear ${studentName},</p>
     <p>We received a request to reset your password. Your one-time password is:</p>
     <p style="font-size:28px; font-weight:bold; letter-spacing:6px; color:#6F4E37;">${otp}</p>
     <p>This OTP is valid for <strong>5 minutes</strong>. If you did not request a password reset, please ignore this email.</p>`
  );
  return sendMail({ to: email, subject: "Password Reset OTP - Kalashree Music Classes", html });
}

/* ---------- Scheduled Email Templates ---------- */

const TABLE_STYLES = {
  table: 'width:100%; border-collapse:collapse; margin:16px 0; font-size:14px;',
  th: 'padding:10px 12px; background:#6F4E37; color:#fff; text-align:left; font-weight:600; font-size:12.5px; text-transform:uppercase; letter-spacing:0.3px;',
  td: 'padding:10px 12px; border-bottom:1px solid #e9ddcf;',
  tdRight: 'padding:10px 12px; border-bottom:1px solid #e9ddcf; text-align:right; font-weight:600;',
  footerTd: 'padding:12px; background:#F5EDE4; font-weight:700; color:#4a2e1e;',
};

/**
 * Email 1: Student fee reminder (sent on 10th)
 */
async function sendFeeReminderEmail(user, batchName, fee, dueMonth, dueYear, monthsOverdue, totalDue) {
  if (!user.email) return false;
  const dueLabel = `${MONTH_NAMES[dueMonth]} ${dueYear}`;
  const html = wrapTemplate(
    "Fee Payment Reminder",
    `<p>Dear ${user.name},</p>
     <p>This is a friendly reminder that your monthly fee payment is pending. Please find the details below:</p>
     <table style="${TABLE_STYLES.table}">
       <tr><td style="${TABLE_STYLES.td} color:#8a7666;">Batch</td><td style="${TABLE_STYLES.tdRight}">${batchName}</td></tr>
       <tr><td style="${TABLE_STYLES.td} color:#8a7666;">Monthly Fee</td><td style="${TABLE_STYLES.tdRight}">Rs. ${fee}/-</td></tr>
       <tr><td style="${TABLE_STYLES.td} color:#8a7666;">Due Since</td><td style="${TABLE_STYLES.tdRight}">${dueLabel}</td></tr>
       <tr><td style="${TABLE_STYLES.td} color:#8a7666;">Months Pending</td><td style="${TABLE_STYLES.tdRight}">${monthsOverdue}</td></tr>
       <tr><td style="${TABLE_STYLES.footerTd}">Total Amount Due</td><td style="${TABLE_STYLES.footerTd} text-align:right;">Rs. ${totalDue}/-</td></tr>
     </table>
     <p>Please log in to your account and complete the payment at your earliest convenience.</p>
     <p style="color:#8a7666; font-size:13px;">If you have already made the payment, please disregard this email.</p>`
  );
  return sendMail({ to: user.email, subject: "Fee Payment Reminder - Kalashree Music Classes", html });
}

/**
 * Email 2: Admin report of unpaid students for current month (sent on 20th)
 * @param {string} adminEmail
 * @param {number} month
 * @param {number} year
 * @param {Array} unpaidStudents - [{name, phone, batch, fee, dueSince, monthsOverdue}]
 */
async function sendAdminUnpaidReportEmail(adminEmail, month, year, unpaidStudents) {
  const monthLabel = `${MONTH_NAMES[month]} ${year}`;
  const totalPending = unpaidStudents.reduce((s, u) => s + u.fee, 0);

  let tableRows = unpaidStudents.map((s, i) =>
    `<tr style="background:${i % 2 === 0 ? '#fff' : '#faf6f2'}">
       <td style="${TABLE_STYLES.td}">${i + 1}</td>
       <td style="${TABLE_STYLES.td}">${s.name}</td>
       <td style="${TABLE_STYLES.td}">${s.phone}</td>
       <td style="${TABLE_STYLES.td}">${s.batch}</td>
       <td style="${TABLE_STYLES.tdRight}">Rs. ${s.fee}/-</td>
       <td style="${TABLE_STYLES.td}">${s.dueSince}</td>
     </tr>`
  ).join("");

  const html = wrapTemplate(
    `Unpaid Students Report — ${monthLabel}`,
    `<p>The following <strong>${unpaidStudents.length}</strong> student(s) have not paid their fee for <strong>${monthLabel}</strong>:</p>
     <table style="${TABLE_STYLES.table}">
       <tr>
         <th style="${TABLE_STYLES.th}">#</th>
         <th style="${TABLE_STYLES.th}">Student</th>
         <th style="${TABLE_STYLES.th}">Phone</th>
         <th style="${TABLE_STYLES.th}">Batch</th>
         <th style="${TABLE_STYLES.th} text-align:right;">Monthly Fee</th>
         <th style="${TABLE_STYLES.th}">Due Since</th>
       </tr>
       ${tableRows}
       <tr>
         <td colspan="4" style="${TABLE_STYLES.footerTd}">Total Pending (${unpaidStudents.length} students)</td>
         <td colspan="2" style="${TABLE_STYLES.footerTd} text-align:right;">Rs. ${totalPending}/-</td>
       </tr>
     </table>`
  );
  return sendMail({ to: adminEmail, subject: `Unpaid Students Report — ${monthLabel} - Kalashree Music Classes`, html });
}

/**
 * Email 3: Admin cumulative outstanding fees report (sent on last day of month)
 * @param {string} adminEmail
 * @param {number} month
 * @param {number} year
 * @param {Array} students - [{name, phone, batch, feePerMonth, monthsOverdue, totalOutstanding}]
 * @param {number} grandTotal
 */
async function sendAdminCumulativeReportEmail(adminEmail, month, year, students, grandTotal) {
  const monthLabel = `${MONTH_NAMES[month]} ${year}`;
  const studentsWithDues = students.filter(s => s.totalOutstanding > 0);
  const upToDateCount = students.length - studentsWithDues.length;

  let tableRows = studentsWithDues.map((s, i) =>
    `<tr style="background:${i % 2 === 0 ? '#fff' : '#faf6f2'}">
       <td style="${TABLE_STYLES.td}">${i + 1}</td>
       <td style="${TABLE_STYLES.td}">${s.name}</td>
       <td style="${TABLE_STYLES.td}">${s.phone}</td>
       <td style="${TABLE_STYLES.td}">${s.batch}</td>
       <td style="${TABLE_STYLES.tdRight}">Rs. ${s.feePerMonth}/-</td>
       <td style="${TABLE_STYLES.td} text-align:center;">${s.monthsOverdue}</td>
       <td style="${TABLE_STYLES.tdRight}">Rs. ${s.totalOutstanding}/-</td>
     </tr>`
  ).join("");

  const html = wrapTemplate(
    `Monthly Fee Summary — ${monthLabel}`,
    `<p>End-of-month cumulative fee status for all students as of <strong>${monthLabel}</strong>.</p>
     <p><strong>${studentsWithDues.length}</strong> student(s) have outstanding dues. <strong>${upToDateCount}</strong> student(s) are fully up to date.</p>
     ${studentsWithDues.length > 0 ? `
     <table style="${TABLE_STYLES.table}">
       <tr>
         <th style="${TABLE_STYLES.th}">#</th>
         <th style="${TABLE_STYLES.th}">Student</th>
         <th style="${TABLE_STYLES.th}">Phone</th>
         <th style="${TABLE_STYLES.th}">Batch</th>
         <th style="${TABLE_STYLES.th} text-align:right;">Fee/Month</th>
         <th style="${TABLE_STYLES.th} text-align:center;">Months Due</th>
         <th style="${TABLE_STYLES.th} text-align:right;">Total Due</th>
       </tr>
       ${tableRows}
       <tr>
         <td colspan="5" style="${TABLE_STYLES.footerTd}">Grand Total (${studentsWithDues.length} students)</td>
         <td style="${TABLE_STYLES.footerTd} text-align:center;">—</td>
         <td style="${TABLE_STYLES.footerTd} text-align:right;">Rs. ${grandTotal}/-</td>
       </tr>
     </table>` : '<p style="color:#2f7a4f; font-weight:600;">🎉 All students are fully paid up!</p>'}
     <p style="color:#8a7666; font-size:13px;">This report was auto-generated on the last day of ${monthLabel}.</p>`
  );
  return sendMail({ to: adminEmail, subject: `Monthly Fee Summary — ${monthLabel} - Kalashree Music Classes`, html });
}

module.exports = {
  sendMail,
  sendOtpEmail,
  sendPasswordResetOtpEmail,
  sendPaymentConfirmationEmail,
  sendWelcomeEmail,
  sendFeeReminderEmail,
  sendAdminUnpaidReportEmail,
  sendAdminCumulativeReportEmail,
  MONTH_NAMES,
};

