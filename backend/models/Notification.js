const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipientId: { type: String, required: true, index: true },
    category: {
      type: String,
      enum: ["LEAVE_SUBMITTED", "LEAVE_APPROVED", "LEAVE_REJECTED"],
      required: true
    },
    message: { type: String, required: true, maxlength: 240 },
    relatedRequestId: { type: String, required: true },
    readAt: { type: Date, default: null }
  },
  { timestamps: true }
);

notificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
