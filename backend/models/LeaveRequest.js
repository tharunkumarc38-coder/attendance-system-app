const mongoose = require("mongoose");

const leaveRequestSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  studentUserId: { type: String },
  type: { type: String, required: true, trim: true, maxlength: 80 },
  from: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  to: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  reason: { type: String, required: true, trim: true, maxlength: 2000 },
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending",
    required: true
  },
  reviewedBy: { type: String },
  reviewedAt: { type: Date },
  facultyComment: { type: String, trim: true, maxlength: 1000 }
});

module.exports = mongoose.model("LeaveRequest", leaveRequestSchema);
