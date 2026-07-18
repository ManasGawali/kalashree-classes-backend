const express = require("express");
const Batch = require("../models/Batch");
const { verifyToken, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Public - used on registration form & general resources page
router.get("/", async (req, res) => {
  const batches = await Batch.find().sort({ monthlyFee: 1 });
  res.json(batches);
});

// Admin - update a batch's monthly fee
router.put("/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { monthlyFee } = req.body;
    if (monthlyFee == null || monthlyFee < 0) {
      return res.status(400).json({ message: "Valid monthlyFee required" });
    }
    const batch = await Batch.findByIdAndUpdate(
      req.params.id,
      { monthlyFee },
      { new: true }
    );
    if (!batch) return res.status(404).json({ message: "Batch not found" });
    res.json(batch);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
