require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const batchRoutes = require("./routes/batchRoutes");
const userRoutes = require("./routes/userRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

connectDB();

// Support a comma-separated list of allowed origins, e.g.
// "https://www.kalashreemusic.com,https://admin.kalashreemusic.com"
const allowedOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || "*")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (curl, mobile apps, server-to-server) and dev tools
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (req, res) => res.json({ status: "ok", time: new Date() }));

app.use("/api/auth", authRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/user", userRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong on the server" });
});
const { startScheduler, runStudentReminders, runAdminUnpaidReport, runAdminCumulativeReport } = require("./utils/scheduler");

/* ---------- Cron Webhook (for Render free tier / external cron services) ---------- */
// External cron services (e.g. cron-job.org) can call these to trigger jobs
// even when Render has spun down the server. Protected by CRON_SECRET.
app.post("/api/cron/:job", async (req, res) => {
  const { job } = req.params;
  console.log("═══════════════════════════════════════════");
  console.log(`[Cron Webhook] Received request for job: '${job}'`);
  console.log(`[Cron Webhook] Time: ${new Date().toISOString()}`);

  const secret = req.headers["x-cron-secret"] || req.query.secret;
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    console.warn("[Cron Webhook] ❌ Unauthorized — secret mismatch");
    return res.status(401).json({ message: "Unauthorized" });
  }
  console.log("[Cron Webhook] ✅ Auth passed");

  try {
    if (job === "reminders") {
      console.log("[Cron Webhook] Executing: runStudentReminders...");
      await runStudentReminders();
    } else if (job === "unpaid-report") {
      console.log("[Cron Webhook] Executing: runAdminUnpaidReport...");
      await runAdminUnpaidReport();
    } else if (job === "cumulative-report") {
      console.log("[Cron Webhook] Executing: runAdminCumulativeReport...");
      await runAdminCumulativeReport();
    } else {
      console.warn(`[Cron Webhook] ❌ Unknown job: '${job}'`);
      return res.status(400).json({ message: "Unknown job. Use: reminders, unpaid-report, or cumulative-report" });
    }
    console.log(`[Cron Webhook] ✅ Job '${job}' completed successfully`);
    res.json({ message: `Job '${job}' executed successfully` });
  } catch (err) {
    console.error(`[Cron Webhook] ❌ Job '${job}' FAILED:`, err.message);
    console.error(`[Cron Webhook] Stack:`, err.stack);
    res.status(500).json({ message: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startScheduler();
});
