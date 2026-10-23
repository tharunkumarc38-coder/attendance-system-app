const express = require("express");
const LeaveRequest = require("../models/LeaveRequest");
const User = require("../models/User");
const { verifyRole, verifyToken } = require("../middleware/auth");
const { createApprovalCertificate } = require("../services/certificate");
const { notifyFacultyOfSubmission, notifyStudentOfDecision } = require("../services/notifications");

const router = express.Router();

// Allow both UPPERCASE and lowercase staff roles to avoid token mismatch errors
const staffRoles = ["FACULTY", "ADMIN", "faculty", "admin"];
const ALLOWED_STATUS_UPDATES = new Set(["Approved", "Rejected"]);
const ALLOWED_STATUSES = new Set(["Pending", ...ALLOWED_STATUS_UPDATES]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isStaffUser(role) {
  if (!role) return false;
  return staffRoles.includes(String(role).toUpperCase()) || staffRoles.includes(role);
}

function getLeaveRequestInput(body) {
  if (!isObject(body)) {
    return { errors: { body: "Request body must be a JSON object." } };
  }

  const type = normalizeText(body.type || body.leaveType);
  const from = normalizeText(body.from || body.fromDate || body.startDate);
  const to = normalizeText(body.to || body.toDate || body.endDate);
  const reason = normalizeText(body.reason);
  const errors = {};

  if (!type) errors.type = "Leave type is required.";
  else if (type.length > 80) errors.type = "Leave type must be 80 characters or fewer.";

  if (!isValidIsoDate(from)) errors.from = "Start date must be a real date in YYYY-MM-DD format.";
  if (!isValidIsoDate(to)) errors.to = "End date must be a real date in YYYY-MM-DD format.";
  if (isValidIsoDate(from) && isValidIsoDate(to) && to < from) {
    errors.to = "End date must be on or after the start date.";
  }

  if (!reason) errors.reason = "Reason is required.";
  else if (reason.length > 2000) errors.reason = "Reason must be 2000 characters or fewer.";

  if (Object.keys(errors).length > 0) return { errors };
  return { value: { type, from, to, reason } };
}

// Student Submit Leave Request
router.post("/", verifyToken, verifyRole(["STUDENT", "student"]), async (req, res) => {
  const { value, errors } = getLeaveRequestInput(req.body);
  if (errors) {
    return res.status(400).json({ error: "Invalid leave request.", details: errors });
  }

  try {
    const leaveRequest = await LeaveRequest.create({
      studentId: req.user.studentId || req.user.id,
      studentUserId: String(req.user.id),
      ...value,
      status: "Pending"
    });

    await notifyFacultyOfSubmission(leaveRequest).catch((error) => {
      console.error("Leave request saved, but faculty notifications could not be created:", error);
    });

    return res.status(201).json(leaveRequest);
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: "Required leave request fields are missing or invalid." });
    }
    console.error("Failed to create leave request:", error);
    return res.status(500).json({ error: "Unable to create leave request." });
  }
});

// Fetch Leave Requests (Role-Aware)
router.get("/", verifyToken, async (req, res) => {
  const status = req.query.status;
  if (status !== undefined && (typeof status !== "string" || !ALLOWED_STATUSES.has(status))) {
    return res.status(400).json({
      error: "Invalid status filter.",
      details: { status: "Status must be Pending, Approved, or Rejected." }
    });
  }

  try {
    const isStaff = isStaffUser(req.user.role);
    const query = isStaff
      ? {}
      : { studentId: req.user.studentId || req.user.id };
      
    if (status) query.status = status;
    const leaves = await LeaveRequest.find(query).sort({ _id: -1 });
    return res.status(200).json(leaves);
  } catch (error) {
    console.error("Failed to fetch leave requests:", error);
    return res.status(500).json({ error: "Unable to fetch leave requests." });
  }
});

// Download Approval Certificate PDF
router.get("/:id/certificate.pdf", verifyToken, async (req, res) => {
  try {
    const request = await LeaveRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: "Leave request not found." });
    }

    const isStaff = isStaffUser(req.user.role);
    if (!isStaff && String(request.studentId) !== String(req.user.studentId || req.user.id)) {
      return res.status(404).json({ error: "Leave request not found." });
    }
    if (request.status !== "Approved") {
      return res.status(409).json({ error: "A certificate is available only for approved requests." });
    }

    const reviewer = request.reviewedBy
      ? await User.findById(request.reviewedBy).select("name username")
      : null;
    const reviewerName = reviewer?.name || reviewer?.username || "Faculty reviewer";
    const institutionName = process.env.INSTITUTION_NAME || "Easwari Engineering College";
    const document = createApprovalCertificate({ institutionName, request, reviewerName });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="od-leave-certificate-${request.id}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    });
    document.on("error", (error) => {
      console.error("Failed to generate approval certificate:", error);
      if (res.headersSent) res.destroy(error);
      else res.status(500).json({ error: "Unable to generate approval certificate." });
    });
    document.pipe(res);
    document.end();
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid leave request ID." });
    }
    console.error("Failed to create approval certificate:", error);
    return res.status(500).json({ error: "Unable to generate approval certificate." });
  }
});

// Faculty Approve / Reject Leave Request Route
router.patch("/:id/status", verifyToken, verifyRole(staffRoles), async (req, res) => {
  if (!isObject(req.body) || !ALLOWED_STATUS_UPDATES.has(req.body.status)) {
    return res.status(400).json({
      error: "Invalid status.",
      details: { status: "Status must be either Approved or Rejected." }
    });
  }
  const facultyComment = req.body.facultyComment === undefined
    ? undefined
    : normalizeText(req.body.facultyComment);
  if (facultyComment !== undefined && facultyComment.length > 1000) {
    return res.status(400).json({
      error: "Invalid faculty comment.",
      details: { facultyComment: "Comment must be 1000 characters or fewer." }
    });
  }

  try {
    const updates = {
      status: req.body.status,
      reviewedBy: req.user.id,
      reviewedAt: new Date()
    };
    if (facultyComment !== undefined) updates.facultyComment = facultyComment;

    const updated = await LeaveRequest.findOneAndUpdate(
      { _id: req.params.id, status: "Pending" },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updated) {
      const existing = await LeaveRequest.findById(req.params.id).select("status");
      if (!existing) {
        return res.status(404).json({ error: "Leave request not found." });
      }
      return res.status(409).json({
        error: "Leave request has already been reviewed.",
        status: existing.status
      });
    }
    await notifyStudentOfDecision(updated).catch((error) => {
      console.error("Leave decision saved, but student notification could not be created:", error);
    });
    return res.status(200).json(updated);
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({ error: "Invalid leave request or status." });
    }
    console.error("Failed to update leave request:", error);
    return res.status(500).json({ error: "Unable to update leave request." });
  }
});

module.exports = router;