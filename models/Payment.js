const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", required: true },
    batchNameSnapshot: { type: String, required: true }, // name at time of payment
    feePerMonthSnapshot: { type: Number, required: true }, // fee at time of payment

    // Months this single transaction covers, e.g. [{month:6,year:2026},{month:7,year:2026}]
    months: [
      {
        month: { type: Number, required: true, min: 1, max: 12 },
        year: { type: Number, required: true },
      },
    ],

    amount: { type: Number, required: true },
    transactionId: { type: String, required: true, trim: true },

    status: {
      type: String,
      enum: ["pending", "completed", "rejected"],
      default: "pending",
    },

    emailSent: { type: Boolean, default: false },
    rejectionReason: { type: String, default: "" },
  },
  { timestamps: true }
);

paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ "months.month": 1, "months.year": 1, batch: 1 });
paymentSchema.index({ transactionId: 1 });

module.exports = mongoose.model("Payment", paymentSchema);
