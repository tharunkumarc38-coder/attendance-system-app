const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  registerNumber: { type: String, unique: true, sparse: true },
  password: { type: String, required: true },
  name: { type: String },
  role: { 
    type: String, 
    enum: ["STUDENT", "FACULTY", "ADMIN"], 
    default: "STUDENT",
    required: true 
  },
  studentId: { type: String },
  department: { type: String },
  year: { type: String }
});

module.exports = mongoose.model("User", userSchema);
