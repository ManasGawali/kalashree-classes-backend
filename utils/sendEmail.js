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

module.exports = { sendMail, sendOtpEmail, sendPaymentConfirmationEmail, sendWelcomeEmail, MONTH_NAMES };
