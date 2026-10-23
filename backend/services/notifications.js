const Notification = require("../models/Notification");
const User = require("../models/User");

async function notifyFacultyOfSubmission(request) {
  const recipients = await User.find({ role: { $in: ["FACULTY", "ADMIN"] } })
    .select("_id")
    .lean();

  if (recipients.length === 0) return;

  await Notification.insertMany(
    recipients.map(({ _id }) => ({
      recipientId: String(_id),
      category: "LEAVE_SUBMITTED",
      message: "A new leave / OD application is waiting for review.",
      relatedRequestId: String(request._id)
    }))
  );
}

async function notifyStudentOfDecision(request) {
  let recipientId = request.studentUserId;
  if (!recipientId) {
    const student = await User.findOne({ studentId: request.studentId, role: "STUDENT" })
      .select("_id")
      .lean();
    recipientId = student?._id;
  }
  if (!recipientId) return;

  const approved = request.status === "Approved";
  await Notification.create({
    recipientId: String(recipientId),
    category: approved ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
    message: `Your leave / OD application was ${approved ? "approved" : "rejected"}.`,
    relatedRequestId: String(request._id)
  });
}

module.exports = { notifyFacultyOfSubmission, notifyStudentOfDecision };
