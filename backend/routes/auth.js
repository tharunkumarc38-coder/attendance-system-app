const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// LOGIN ROUTE
router.post('/login', async (req, res) => {
  try {
    const { username, registerNumber, password } = req.body;
    const identifier = username || registerNumber;
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      return res.status(500).json({ error: "Authentication is not configured." });
    }

    if (typeof identifier !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Username or register number and password are required." });
    }

    // 1. Find user
    const user = await User.findOne({
      $or: [{ username: identifier }, { registerNumber: identifier }]
    });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // 2. Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // 3. Generate JWT Token
    const token = jwt.sign(
      { id: user._id, studentId: user.studentId || String(user._id), role: user.role },
      jwtSecret,
      { expiresIn: '1d' }
    );

    // 4. Send token and user details
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        studentId: user.studentId,
        department: user.department,
        year: user.year,
        role: user.role
      }
    });
  } catch (err) {
    console.error("Login failed:", err);
    res.status(500).json({ error: "Unable to complete login." });
  }
});

module.exports = router;
