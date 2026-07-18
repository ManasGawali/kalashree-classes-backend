require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Batch = require("../models/Batch");
const Admin = require("../models/Admin");

const DEFAULT_FEES = {
  "Prarambhik": 700,
  "Praveshika Pratham": 800,
  "Praveshika Poorna": 900,
  "Madhyama Pratham": 1000,
  "Madhyama Poorna": 1100,
  "Visharad Pratham": 1300,
  "Visharad Poorna": 1500,
};

(async () => {
  await connectDB();

  for (const [name, monthlyFee] of Object.entries(DEFAULT_FEES)) {
    await Batch.findOneAndUpdate(
      { name },
      { name, monthlyFee },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`Batch ready: ${name} - Rs.${monthlyFee}/month`);
  }

  const adminEmail = (process.env.ADMIN_EMAIL || "admin@kalashreemusic.com").toLowerCase();
  const existingAdmin = await Admin.findOne({ email: adminEmail });
  if (!existingAdmin) {
    await Admin.create({
      email: adminEmail,
      password: process.env.ADMIN_PASSWORD || "ChangeMe@123",
      name: "Admin",
    });
    console.log(`Admin created: ${adminEmail} (change password after first login!)`);
  } else {
    console.log(`Admin already exists: ${adminEmail}`);
  }

  console.log("Seeding complete.");
  await mongoose.connection.close();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
