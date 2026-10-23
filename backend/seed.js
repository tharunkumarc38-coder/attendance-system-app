require("dotenv").config();

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("./models/User");

let Attendance, Leave;
try {
  Attendance = require("./models/Attendance");
} catch (e) {}
try {
  Leave = require("./models/Leave");
} catch (e) {}

async function seedDatabase() {
  const mongoUri = process.env.MONGO_URI;
  const studentPassword = process.env.SEED_STUDENT_PASSWORD;
  const facultyPassword = process.env.SEED_FACULTY_PASSWORD;

  if (!mongoUri || !studentPassword || !facultyPassword) {
    throw new Error(
      "Set MONGO_URI, SEED_STUDENT_PASSWORD, and SEED_FACULTY_PASSWORD before seeding."
    );
  }

  await mongoose.connect(mongoUri);

  // 1. Seed Users (Multiple Students & Faculty)
  const users = [
    {
      username: "Tharun",
      registerNumber: "Tharun",
      password: await bcrypt.hash(studentPassword, 12),
      role: "STUDENT",
      name: "Tharun Kumar",
      studentId: "2",
      department: "CSE",
      year: "3"
    },
    {
      username: "Rahul",
      registerNumber: "Rahul",
      password: await bcrypt.hash(studentPassword, 12),
      role: "STUDENT",
      name: "Rahul Sharma",
      studentId: "1",
      department: "CSE",
      year: "3"
    },
    {
      username: "Priya",
      registerNumber: "Priya",
      password: await bcrypt.hash(studentPassword, 12),
      role: "STUDENT",
      name: "Priya Ramesh",
      studentId: "3",
      department: "CSE",
      year: "3"
    },
    {
      username: "vimal",
      password: await bcrypt.hash(facultyPassword, 12),
      role: "FACULTY",
      name: "Dr. Vimal",
      department: "CSE"
    }
  ];

  for (const user of users) {
    await User.updateOne(
      { username: user.username },
      { $set: user },
      { upsert: true, runValidators: true }
    );
  }
  console.log("Users seeded successfully (Multiple Students & Faculty).");

  // 2. Seed Attendance Records for Multiple Students (IDs: "1", "2", "3")
  if (Attendance) {
    const studentIds = ["1", "2", "3"];
    await Attendance.deleteMany({ studentId: { $in: studentIds } });

    const attendanceRecords = [];

    studentIds.forEach((sId) => {
      // Give different students slightly different attendance ratios
      const presentLimit = sId === "2" ? 17 : (sId === "1" ? 15 : 19);
      
      for (let i = 1; i <= 20; i++) {
        const dayStr = i < 10 ? `0${i}` : `${i}`;
        const isPresent = i <= presentLimit;

        attendanceRecords.push({
          studentId: sId,
          totalClasses: 1,
          presentClasses: isPresent ? 1 : 0,
          absentClasses: isPresent ? 0 : 1,
          percentage: isPresent ? 100 : 0,
          recordedBy: "Dr. Vimal",
          status: isPresent ? "Present" : "Absent",
          date: `2026-10-${dayStr}`
        });
      }
    });

    await Attendance.insertMany(attendanceRecords);
    console.log("Attendance records seeded successfully for students 1, 2, and 3.");
  }

  // 3. Seed Sample Leave Requests for Multiple Students
  if (Leave) {
    await Leave.deleteMany({ studentId: { $in: ["1", "2", "3"] } });
    
    const leaveRequests = [
      {
        studentId: "2",
        studentName: "Tharun Kumar",
        leaveType: "Sick Leave",
        startDate: "2026-10-25",
        endDate: "2026-10-26",
        reason: "Not feeling well, need rest.",
        status: "APPROVED",
        reviewedBy: "Dr. Vimal"
      },
      {
        studentId: "1",
        studentName: "Rahul Sharma",
        leaveType: "On Duty",
        startDate: "2026-10-24",
        endDate: "2026-10-24",
        reason: "Attending technical symposium.",
        status: "PENDING",
        reviewedBy: null
      },
      {
        studentId: "3",
        studentName: "Priya Ramesh",
        leaveType: "Casual Leave",
        startDate: "2026-10-27",
        endDate: "2026-10-27",
        reason: "Personal work.",
        status: "APPROVED",
        reviewedBy: "Dr. Vimal"
      }
    ];

    await Leave.insertMany(leaveRequests);
    console.log("Sample leave requests seeded successfully for multiple students.");
  }

  console.log("Database seeding completed successfully!");
}

seedDatabase()
  .catch((error) => {
    console.error("Database seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });