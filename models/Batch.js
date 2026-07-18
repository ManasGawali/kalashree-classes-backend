const mongoose = require("mongoose");

// Batch names are fixed (fixed curriculum levels) but fee is admin-editable
const BATCH_NAMES = [
  "Prarambhik",
  "Praveshika Pratham",
  "Praveshika Poorna",
  "Madhyama Pratham",
  "Madhyama Poorna",
  "Visharad Pratham",
  "Visharad Poorna",
];

const batchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: BATCH_NAMES,
    },
    monthlyFee: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

batchSchema.statics.BATCH_NAMES = BATCH_NAMES;

module.exports = mongoose.model("Batch", batchSchema);
