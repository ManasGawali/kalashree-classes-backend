const QRCode = require("qrcode");

/**
 * Generates a UPI payment QR code (as a base64 data URL) with the amount
 * pre-filled, so the student just has to scan and confirm in their UPI app.
 */
async function generateUpiQR(amount, note) {
  const upiId = process.env.UPI_ID;
  const payeeName = process.env.UPI_PAYEE_NAME || "Kalashree Music Classes";

  const upiUrl =
    `upi://pay?pa=${encodeURIComponent(upiId)}` +
    `&pn=${encodeURIComponent(payeeName)}` +
    `&am=${encodeURIComponent(amount.toFixed(2))}` +
    `&cu=INR` +
    `&tn=${encodeURIComponent(note || "Kalashree Music Fees")}`;

  const dataUrl = await QRCode.toDataURL(upiUrl, {
    width: 320,
    margin: 1,
    color: { dark: "#4A2E1E", light: "#FFFFFF" },
  });

  return { dataUrl, upiUrl };
}

module.exports = { generateUpiQR };
