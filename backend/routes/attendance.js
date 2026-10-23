const express = require("express");
const Attendance = require("../models/Attendance");
const { verifyRole, verifyToken } = require("../middleware/auth");

const router = express.Router();
const staffRoles = ["FACULTY", "ADMIN"];
const ALLOWED_ATTENDANCE_STATUSES = new Set(["Present", "Absent"]);
const MINIMUM_ATTENDANCE_PERCENT = 75;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isValidIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

router.get("/summary", verifyToken, async (req, res) => {
  const isStaff = staffRoles.includes(req.user.role);
  const requestedStudentId = req.query.studentId;

  if (isStaff && requestedStudentId !== undefined &&
      (typeof requestedStudentId !== "string" || !requestedStudentId.trim())) {
    return res.status(400).json({
      error: "studentId must be a non-empty string."
    });
  }

  // Students use their own studentId/id. 
  // Staff view system-wide records unless a specific studentId is queried.
  const studentId = isStaff
    ? requestedStudentId?.trim()
    : req.user.studentId || req.user.id;

  const query = studentId ? { studentId } : {};

  try {
    const [totalClasses, attendedClasses] = await Promise.all([
      Attendance.countDocuments(query),
      Attendance.countDocuments({ ...query, status: "Present" })
    ]);
    const attendancePercentage = totalClasses === 0
      ? 0
      : Math.round((attendedClasses / totalClasses) * 10000) / 100;

    // Faculty/Staff viewing system-wide summary don't have personal student eligibility
    const isEligible = studentId ? attendancePercentage >= MINIMUM_ATTENDANCE_PERCENT : null;

    return res.status(200).json({
      studentId: studentId || null,
      scope: studentId ? "student" : "all-system",
      totalClasses,
      attendedClasses,
      attendancePercentage,
      minimumRequired: MINIMUM_ATTENDANCE_PERCENT,
      isEligible
    });
  } catch (error) {
    console.error("Failed to calculate attendance summary:", error);
    return res.status(500).json({ error: "Unable to calculate attendance summary." });
  }
});

router.get("/", verifyToken, async (req, res) => {
  if (
    staffRoles.includes(req.user.role) &&
    req.query.studentId !== undefined &&
    (typeof req.query.studentId !== "string" || !req.query.studentId.trim())
  ) {
    return res.status(400).json({ error: "studentId must be a non-empty string." });
  }

  try {
    const query = staffRoles.includes(req.user.role)
      ? (req.query.studentId ? { studentId: req.query.studentId.trim() } : {})
      : { studentId: req.user.studentId || req.user.id };
      
    const records = await Attendance.find(query).sort({ date: -1, _id: -1 });
    return res.status(200).json(records);
  } catch (error) {
    console.error("Failed to fetch attendance records:", error);
    return res.status(500).json({ error: "Unable to fetch attendance records." });
  }
});

router.post("/", verifyToken, verifyRole(staffRoles), async (req, res) => {
  if (!isObject(req.body)) {
    return res.status(400).json({ error: "Request body must be a JSON object." });
  }

  const studentId = typeof req.body.studentId === "string" ? req.body.studentId.trim() : "";
  const date = req.body.date;
  const status = req.body.status;
  const details = {};

  if (!studentId) details.studentId = "Student ID is required.";
  if (!isValidIsoDate(date)) details.date = "Date must be a real date in YYYY-MM-DD format.";
  if (!ALLOWED_ATTENDANCE_STATUSES.has(status)) {
    details.status = "Status must be Present or Absent.";
  }
  if (Object.keys(details).length) {
    return res.status(400).json({ error: "Invalid attendance record.", details });
  }

  try {
    const record = await Attendance.create({
      studentId,
      date,
      status,
      recordedBy: req.user.id
    });
    return res.status(201).json(record);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: "Attendance has already been recorded for this student and date."
      });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: "Invalid attendance record." });
    }
    console.error("Failed to record attendance:", error);
    return res.status(500).json({ error: "Unable to record attendance." });
  }
});

module.exports = router;