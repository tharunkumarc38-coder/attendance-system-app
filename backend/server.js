require("dotenv").config();

const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");

const authRoutes = require("./routes/auth");
const leaveRoutes = require("./routes/leave");
const studentRoutes = require("./routes/students");
const attendanceRoutes = require("./routes/attendance");
const notificationRoutes = require("./routes/notifications");

const DEFAULT_PORT = 8081;
const PORT = Number(process.env.PORT) || DEFAULT_PORT;

function createApp() {
  const app = express();

  app.use(express.json());
  app.use(cors());
  app.use("/api/auth", authRoutes);
  app.use("/api/leave", leaveRoutes);
  app.use("/api/leave-requests", leaveRoutes);
  app.use("/api/students", studentRoutes);
  app.use("/api/attendance", attendanceRoutes);
  app.use("/api/notifications", notificationRoutes);

  app.get("/", (_req, res) => {
    res.send("Express Backend is running live for OD & Leave Management System!");
  });

  return app;
}

async function startServer() {
  const mongoUri = process.env.MONGO_URI;
  const jwtSecret = process.env.JWT_SECRET;

  if (!mongoUri) {
    throw new Error("MONGO_URI must be set in the environment.");
  }
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be set to a secret of at least 32 characters.");
  }

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB successfully.");

  const app = createApp();
  return app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Server startup failed:", error);
    process.exitCode = 1;
  });
}

module.exports = { createApp, startServer };
