"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const Module = require("node:module");
const {
  after,
  afterEach,
  before,
  test
} = require("node:test");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

// Prevent server.js from loading any .env file, and fail closed if code tries
// to establish a MongoDB connection during this test process.
const originalModuleLoad = Module._load;
let connectionAttempts = 0;
mongoose.connect = async () => {
  connectionAttempts += 1;
  throw new Error("MongoDB connections are disabled in this test harness.");
};
process.env.JWT_SECRET = "test-only-secret-that-is-long-enough-for-jwt-validation";
Module._load = function (request, parent, isMain) {
  if (request === "dotenv") return { config: () => ({}) };
  return originalModuleLoad.call(this, request, parent, isMain);
};

let createApp;
try {
  ({ createApp } = require("../server"));
} finally {
  Module._load = originalModuleLoad;
}

const User = require("../models/User");
const LeaveRequest = require("../models/LeaveRequest");
const Attendance = require("../models/Attendance");
const Notification = require("../models/Notification");

const originals = [];
let httpServer;
let apiBase;
const passwordHash = bcrypt.hashSync("correct-test-password", 4);

function replace(target, key, value) {
  originals.push({ target, key, value: target[key] });
  target[key] = value;
}

function restoreMocks() {
  for (const item of originals.splice(0).reverse()) {
    item.target[item.key] = item.value;
  }
}

function token(role, id, studentId = id, expiresIn = "1h") {
  return jwt.sign({ id, studentId, role }, process.env.JWT_SECRET, { expiresIn });
}

function auth(role = "STUDENT", id = "student-a", studentId = "student-a") {
  return { Authorization: `Bearer ${token(role, id, studentId)}` };
}

async function request(path, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : Buffer.from(await response.arrayBuffer());
  return { response, payload };
}

function queryResult(value) {
  return {
    select() { return this; },
    lean() { return Promise.resolve(value); },
    sort() { return this; },
    limit() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
  };
}

before(async () => {
  const app = createApp();
  httpServer = http.createServer(app);
  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(0, "127.0.0.1", resolve);
  });
  apiBase = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
  if (httpServer?.listening) {
    await new Promise((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
  }
  assert.equal(connectionAttempts, 0, "the test harness must never connect to MongoDB");
});

afterEach(restoreMocks);

test("login accepts valid credentials and does not return the password", async () => {
  replace(User, "findOne", async () => ({
    _id: "user-student-a", username: "student-a", password: passwordHash,
    role: "STUDENT", studentId: "student-a", name: "Test Student"
  }));
  const { response, payload } = await request("/api/auth/login", {
    method: "POST", body: { username: "student-a", password: "correct-test-password" }
  });
  assert.equal(response.status, 200);
  assert.ok(payload.token);
  assert.equal(payload.user.username, "student-a");
  assert.equal(Object.hasOwn(payload, "password"), false);
  assert.equal(Object.hasOwn(payload.user, "password"), false);
});

test("login rejects an incorrect password", async () => {
  replace(User, "findOne", async () => ({ password: passwordHash }));
  const { response, payload } = await request("/api/auth/login", {
    method: "POST", body: { username: "student-a", password: "wrong-password" }
  });
  assert.equal(response.status, 400);
  assert.equal(payload.error, "Invalid credentials");
});

test("login rejects an unknown username", async () => {
  replace(User, "findOne", async () => null);
  const { response, payload } = await request("/api/auth/login", {
    method: "POST", body: { username: "unknown-user", password: "any-password" }
  });
  assert.equal(response.status, 400);
  assert.equal(payload.error, "Invalid credentials");
});

test("protected route rejects a missing bearer token", async () => {
  const { response } = await request("/api/leave/");
  assert.equal(response.status, 401);
});

test("protected route rejects a malformed token", async () => {
  const { response } = await request("/api/leave/", { headers: { Authorization: "Bearer invalid" } });
  assert.equal(response.status, 403);
});

test("protected route rejects an expired token", async () => {
  const expired = token("STUDENT", "student-a", "student-a", "-1s");
  const { response } = await request("/api/leave/", {
    headers: { Authorization: `Bearer ${expired}` }
  });
  assert.equal(response.status, 403);
});

test("student is denied faculty-only attendance creation", async () => {
  const { response, payload } = await request("/api/attendance/", {
    method: "POST", headers: auth(),
    body: { studentId: "student-a", date: "2026-10-22", status: "Present" }
  });
  assert.equal(response.status, 403);
  assert.match(payload.error, /Insufficient permissions/);
});

test("student can submit a valid leave request and records pending status", async () => {
  let created;
  replace(LeaveRequest, "create", async (document) => (created = { _id: "leave-1", ...document }));
  replace(User, "find", () => queryResult([{ _id: "faculty-1" }]));
  replace(Notification, "insertMany", async () => []);
  const { response, payload } = await request("/api/leave/", {
    method: "POST", headers: auth("STUDENT", "user-a", "student-a"),
    body: { type: "Medical", from: "2026-10-23", to: "2026-10-24", reason: "Medical rest" }
  });
  assert.equal(response.status, 201);
  assert.equal(payload.status, "Pending");
  assert.equal(created.studentId, "student-a");
  assert.equal(created.studentUserId, "user-a");
});

test("leave submission rejects missing required fields", async () => {
  const { response, payload } = await request("/api/leave/", {
    method: "POST", headers: auth(), body: { type: "Medical" }
  });
  assert.equal(response.status, 400);
  assert.equal(payload.error, "Invalid leave request.");
  assert.ok(payload.details.from && payload.details.to && payload.details.reason);
});

test("leave submission rejects impossible calendar dates", async () => {
  const { response, payload } = await request("/api/leave/", {
    method: "POST", headers: auth(),
    body: { type: "Medical", from: "2026-02-30", to: "2026-03-01", reason: "Rest" }
  });
  assert.equal(response.status, 400);
  assert.ok(payload.details.from);
});

test("leave submission rejects an end date before its start date", async () => {
  const { response, payload } = await request("/api/leave/", {
    method: "POST", headers: auth(),
    body: { type: "Medical", from: "2026-10-24", to: "2026-10-23", reason: "Rest" }
  });
  assert.equal(response.status, 400);
  assert.match(payload.details.to, /on or after/);
});

test("student leave retrieval is scoped to the authenticated student", async () => {
  let capturedQuery;
  replace(LeaveRequest, "find", (query) => {
    capturedQuery = query;
    return { sort: async () => [{ studentId: "student-a" }] };
  });
  const { response, payload } = await request("/api/leave/", {
    headers: auth("STUDENT", "user-a", "student-a")
  });
  assert.equal(response.status, 200);
  assert.deepEqual(capturedQuery, { studentId: "student-a" });
  assert.deepEqual(payload, [{ studentId: "student-a" }]);
});

test("faculty leave retrieval uses the staff-wide query", async () => {
  let capturedQuery;
  replace(LeaveRequest, "find", (query) => {
    capturedQuery = query;
    return { sort: async () => [] };
  });
  const { response } = await request("/api/leave/", {
    headers: auth("FACULTY", "faculty-a", "faculty-a")
  });
  assert.equal(response.status, 200);
  assert.deepEqual(capturedQuery, {});
});

test("faculty can approve a pending request and triggers a student notification", async () => {
  let updateQuery;
  let notification;
  replace(LeaveRequest, "findOneAndUpdate", async (query, update) => {
    updateQuery = query;
    return { _id: "leave-1", studentId: "student-a", studentUserId: "user-a", ...update.$set };
  });
  replace(Notification, "create", async (value) => (notification = value));
  const { response, payload } = await request("/api/leave/leave-1/status", {
    method: "PATCH", headers: auth("FACULTY", "faculty-a"),
    body: { status: "Approved", facultyComment: "Approved" }
  });
  assert.equal(response.status, 200);
  assert.deepEqual(updateQuery, { _id: "leave-1", status: "Pending" });
  assert.equal(payload.status, "Approved");
  assert.equal(payload.reviewedBy, "faculty-a");
  assert.equal(notification.category, "LEAVE_APPROVED");
});

test("faculty can reject a pending request and triggers a student notification", async () => {
  let notification;
  replace(LeaveRequest, "findOneAndUpdate", async (_query, update) => ({
    _id: "leave-reject-1", studentId: "student-a", studentUserId: "user-a", ...update.$set
  }));
  replace(Notification, "create", async (value) => (notification = value));
  const { response, payload } = await request("/api/leave/leave-reject-1/status", {
    method: "PATCH", headers: auth("ADMIN", "admin-a"), body: { status: "Rejected" }
  });
  assert.equal(response.status, 200);
  assert.equal(payload.status, "Rejected");
  assert.equal(payload.reviewedBy, "admin-a");
  assert.equal(notification.category, "LEAVE_REJECTED");
});

test("re-reviewing an already reviewed request returns conflict", async () => {
  replace(LeaveRequest, "findOneAndUpdate", async () => null);
  replace(LeaveRequest, "findById", () => queryResult({ status: "Rejected" }));
  const { response, payload } = await request("/api/leave/leave-1/status", {
    method: "PATCH", headers: auth("ADMIN", "admin-a"), body: { status: "Approved" }
  });
  assert.equal(response.status, 409);
  assert.equal(payload.status, "Rejected");
});

test("faculty can record attendance with valid input", async () => {
  let created;
  replace(Attendance, "create", async (value) => (created = { _id: "attendance-1", ...value }));
  const { response, payload } = await request("/api/attendance/", {
    method: "POST", headers: auth("FACULTY", "faculty-a"),
    body: { studentId: "student-a", date: "2026-10-22", status: "Present" }
  });
  assert.equal(response.status, 201);
  assert.equal(payload.status, "Present");
  assert.equal(created.recordedBy, "faculty-a");
});

test("attendance rejects duplicate student/date records", async () => {
  replace(Attendance, "create", async () => {
    const error = new Error("duplicate key");
    error.code = 11000;
    throw error;
  });
  const { response } = await request("/api/attendance/", {
    method: "POST", headers: auth("ADMIN", "admin-a"),
    body: { studentId: "student-a", date: "2026-10-22", status: "Present" }
  });
  assert.equal(response.status, 409);
});

test("attendance summary calculates the 75 percent eligibility boundary", async () => {
  replace(Attendance, "countDocuments", async (query) => query.status === "Present" ? 3 : 4);
  const { response, payload } = await request("/api/attendance/summary", {
    headers: auth("STUDENT", "user-a", "student-a")
  });
  assert.equal(response.status, 200);
  assert.equal(payload.totalClasses, 4);
  assert.equal(payload.attendedClasses, 3);
  assert.equal(payload.attendancePercentage, 75);
  assert.equal(payload.isEligible, true);
});

test("notification listing is scoped to the authenticated user", async () => {
  let capturedQuery;
  replace(Notification, "find", (query) => {
    capturedQuery = query;
    return queryResult([{ recipientId: "user-a" }]);
  });
  const { response, payload } = await request("/api/notifications/", {
    headers: auth("STUDENT", "user-a", "student-a")
  });
  assert.equal(response.status, 200);
  assert.deepEqual(capturedQuery, { recipientId: "user-a" });
  assert.deepEqual(payload, [{ recipientId: "user-a" }]);
});

test("recipient can mark one notification read", async () => {
  let capturedQuery;
  replace(Notification, "findOneAndUpdate", async (query) => {
    capturedQuery = query;
    return { _id: "notification-a", recipientId: "user-a", readAt: new Date().toISOString() };
  });
  const { response } = await request("/api/notifications/notification-a/read", {
    method: "PATCH", headers: auth("STUDENT", "user-a", "student-a")
  });
  assert.equal(response.status, 200);
  assert.deepEqual(capturedQuery, { _id: "notification-a", recipientId: "user-a" });
});

test("recipient can mark all their unread notifications read", async () => {
  let capturedQuery;
  replace(Notification, "updateMany", async (query) => {
    capturedQuery = query;
    return { modifiedCount: 2 };
  });
  const { response, payload } = await request("/api/notifications/read-all", {
    method: "PATCH", headers: auth("STUDENT", "user-a", "student-a")
  });
  assert.equal(response.status, 200);
  assert.deepEqual(capturedQuery, { recipientId: "user-a", readAt: null });
  assert.equal(payload.updatedCount, 2);
});

test("approved request certificate returns a PDF for its owner", async () => {
  replace(LeaveRequest, "findById", async () => ({
    _id: "leave-1", id: "leave-1", studentId: "student-a", studentUserId: "user-a",
    type: "Medical", from: "2026-10-23", to: "2026-10-24", reason: "Test reason",
    status: "Approved", reviewedAt: new Date("2026-10-22T00:00:00Z")
  }));
  const { response, payload } = await request("/api/leave/leave-1/certificate.pdf", {
    headers: auth("STUDENT", "user-a", "student-a")
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/pdf/);
  assert.equal(payload.subarray(0, 5).toString(), "%PDF-");
});

test("certificate is unavailable for a non-approved request", async () => {
  replace(LeaveRequest, "findById", async () => ({ _id: "leave-2", studentId: "student-a", status: "Pending" }));
  const { response, payload } = await request("/api/leave/leave-2/certificate.pdf", {
    headers: auth("STUDENT", "user-a", "student-a")
  });
  assert.equal(response.status, 409);
  assert.match(payload.error, /only for approved/);
});

test("student cannot access another student's certificate", async () => {
  replace(LeaveRequest, "findById", async () => ({ _id: "leave-3", studentId: "student-b", status: "Approved" }));
  const { response } = await request("/api/leave/leave-3/certificate.pdf", {
    headers: auth("STUDENT", "user-a", "student-a")
  });
  assert.equal(response.status, 404);
});
