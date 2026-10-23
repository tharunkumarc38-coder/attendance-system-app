const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).json({
    id: 3,
    name: "Tharun",
    username: "Tharun",
    department: "Computer Science"
  });
});

module.exports = router;