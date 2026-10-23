const express = require("express");
const Notification = require("../models/Notification");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

router.use(verifyToken);

router.get("/unread-count", async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({
      recipientId: String(req.user.id),
      readAt: null
    });
    return res.status(200).json({ unreadCount });
  } catch (error) {
    console.error("Failed to count notifications:", error);
    return res.status(500).json({ error: "Unable to load notification count." });
  }
});

router.patch("/read-all", async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { recipientId: String(req.user.id), readAt: null },
      { $set: { readAt: new Date() } }
    );
    return res.status(200).json({ updatedCount: result.modifiedCount });
  } catch (error) {
    console.error("Failed to mark notifications as read:", error);
    return res.status(500).json({ error: "Unable to update notifications." });
  }
});

router.get("/", async (req, res) => {
  const unreadOnly = req.query.unreadOnly;
  if (unreadOnly !== undefined && unreadOnly !== "true" && unreadOnly !== "false") {
    return res.status(400).json({ error: "unreadOnly must be either true or false." });
  }

  try {
    const query = { recipientId: String(req.user.id) };
    if (unreadOnly === "true") query.readAt = null;
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50);
    return res.status(200).json(notifications);
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return res.status(500).json({ error: "Unable to load notifications." });
  }
});

router.patch("/:id/read", async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: String(req.user.id) },
      { $set: { readAt: new Date() } },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ error: "Notification not found." });
    }
    return res.status(200).json(notification);
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid notification ID." });
    }
    console.error("Failed to mark notification as read:", error);
    return res.status(500).json({ error: "Unable to update notification." });
  }
});

module.exports = router;
