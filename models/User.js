const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Email is optional - only used to send payment receipts/notifications if provided
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    // Phone is the login identifier - must be unique
    phone: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", required: true },

    // The first month/year fees are due from (i.e. when student joined)
    joinMonth: { type: Number, required: true, min: 1, max: 12 },
    joinYear: { type: Number, required: true },

    // Cached "paid till" pointer - the last month/year fully paid & verified.
    // Null means nothing paid yet -> due starts from joinMonth/joinYear.
    paidTillMonth: { type: Number, default: null },
    paidTillYear: { type: Number, default: null },

    role: { type: String, default: "user", enum: ["user"] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", userSchema);
