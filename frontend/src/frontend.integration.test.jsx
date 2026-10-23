import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { createRequire } from "node:module";
import process from "node:process";
import path from "node:path";
import Module from "node:module";
import App from "./App";
import { getApiBaseUrl } from "./api";

const require = createRequire(import.meta.url);
const backendPath = path.resolve(process.cwd(), "..", "backend");
const backendFile = (name) => path.join(backendPath, name);
const originalModuleLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "dotenv") return { config: () => ({}) };
  if (request === "../services/certificate") {
    return { createApprovalCertificate: () => {
      const { PassThrough } = require("node:stream");
      const document = new PassThrough();
      document.end = () => PassThrough.prototype.end.call(document, "%PDF-mock certificate");
      return document;
    } };
  }
  return originalModuleLoad.call(this, request, parent, isMain);
};
const { createApp } = require(backendFile("server.js"));
Module._load = originalModuleLoad;
const User = require(backendFile("models/User.js"));
const LeaveRequest = require(backendFile("models/LeaveRequest.js"));
const Attendance = require(backendFile("models/Attendance.js"));
const Notification = require(backendFile("models/Notification.js"));
const bcrypt = require(backendFile("node_modules/bcryptjs"));
const SECRET = "frontend-test-only-secret-long-enough-to-sign-tokens";
const passwordHash = bcrypt.hashSync("test-password", 4);
let leaveRows;
let notificationRows;
let httpServer;
let apiBase;
let previousSecret;
const attendanceRows = [
  { _id: "attendance-fixture-1", studentId: "test-student", date: "2026-10-22", status: "Present" },
  { _id: "attendance-fixture-2", studentId: "test-student", date: "2026-10-21", status: "Absent" },
];

function rowsQuery(rows) {
  return { select() { return this; }, lean() { return Promise.resolve(rows); }, sort() { return this; }, limit() { return Promise.resolve(rows); } };
}

function stubBackendModels() {
  vi.spyOn(User, "findOne").mockImplementation(async (query) => {
    const identifier = query.$or?.[0]?.username || query.$or?.[1]?.registerNumber;
    if (identifier !== "test-user") return null;
    return { _id: "test-user-id", username: "test-user", password: passwordHash, role: "STUDENT", studentId: "test-student", name: "Test User" };
  });
  vi.spyOn(User, "find").mockImplementation(() => rowsQuery([]));
  vi.spyOn(LeaveRequest, "find").mockImplementation(() => ({ sort: async () => leaveRows }));
  vi.spyOn(LeaveRequest, "create").mockImplementation(async (document) => {
    const row = { _id: `leave-created-${leaveRows.length}`, ...document };
    leaveRows.push(row);
    return row;
  });
  vi.spyOn(LeaveRequest, "findById").mockImplementation(async (id) => leaveRows.find((row) => row._id === id) || null);
  vi.spyOn(Attendance, "find").mockImplementation(() => ({ sort: async () => attendanceRows }));
  vi.spyOn(Attendance, "countDocuments").mockImplementation(async (query) => query.status
    ? attendanceRows.filter((row) => row.status === query.status).length : attendanceRows.length);
  vi.spyOn(Notification, "find").mockImplementation(() => rowsQuery(notificationRows));
  vi.spyOn(Notification, "countDocuments").mockImplementation(async () => notificationRows.filter((item) => !item.readAt).length);
  vi.spyOn(Notification, "findOneAndUpdate").mockImplementation(async ({ _id, recipientId }) => {
    const item = notificationRows.find((row) => row._id === _id && row.recipientId === recipientId);
    if (item) item.readAt = new Date().toISOString();
    return item || null;
  });
  vi.spyOn(Notification, "updateMany").mockImplementation(async () => ({ modifiedCount: 0 }));
  vi.spyOn(Notification, "insertMany").mockImplementation(async () => []);
}

async function login(user = userEvent.setup()) {
  await user.type(screen.getByLabelText("Register Number / Username"), "test-user");
  await user.type(screen.getByLabelText("Password", { selector: "input" }), "test-password");
  await user.click(screen.getByRole("button", { name: "Sign In" }));
  await screen.findByRole("button", { name: "Logout" });
  return user;
}

function renderApp() { return render(<MemoryRouter><App /></MemoryRouter>); }

beforeAll(async () => {
  previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = SECRET;
  httpServer = require("node:http").createServer(createApp());
  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(0, "127.0.0.1", resolve);
  });
  apiBase = `http://127.0.0.1:${httpServer.address().port}/api`;
});

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", apiBase);
  process.env.JWT_SECRET = SECRET;
  localStorage.clear();
  leaveRows = [
    { _id: "leave-pending", studentId: "test-student", type: "Medical", from: "2026-11-01", to: "2026-11-02", reason: "Test fixture", status: "Pending" },
    { _id: "leave-approved", studentId: "test-student", type: "OD", from: "2026-10-10", to: "2026-10-10", reason: "Test fixture", status: "Approved", reviewedAt: new Date("2026-10-09T00:00:00Z") },
  ];
  notificationRows = [{ _id: "notification-fixture", recipientId: "test-user-id", category: "LEAVE_APPROVED", message: "Your test leave was approved.", relatedRequestId: "leave-approved", readAt: null }];
  stubBackendModels();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  localStorage.clear();
});

afterAll(async () => {
  if (httpServer?.listening) await new Promise((resolve) => httpServer.close(resolve));
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
});

describe("TC-21: frontend API configuration and connectivity", () => {
  it("uses the configured API base and reaches local Express login and dashboard routes", async () => {
    expect(getApiBaseUrl()).toBe(apiBase);
    const nativeFetch = globalThis.fetch;
    const urls = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((...args) => {
      urls.push(String(args[0]));
      return nativeFetch(...args);
    });
    renderApp();
    await login();
    await screen.findByText("50%");
    expect(urls).toContain(`${apiBase}/auth/login`);
    expect(urls).toContain(`${apiBase}/attendance/summary`);
    expect(urls).toContain(`${apiBase}/leave`);
    expect(urls).toContain(`${apiBase}/notifications`);
  });
});

describe("TC-22: login and leave form behavior", () => {
  it("validates required fields, submits a valid leave request, and displays the API result", async () => {
    const user = userEvent.setup();
    renderApp();
    await login(user);
    await user.click(screen.getByRole("button", { name: /Apply New Leave/ }));
    const from = screen.getByLabelText("From Date");
    const to = screen.getByLabelText("To Date");
    const reason = screen.getByLabelText("Reason");
    expect(from.required && to.required && reason.required).toBe(true);
    await user.click(screen.getByRole("button", { name: "Submit Application" }));
    expect(from.validity.valid).toBe(false);
    await user.type(from, "2026-11-05");
    await user.type(to, "2026-11-06");
    await user.type(reason, "Test fixture request");
    await user.click(screen.getByRole("button", { name: "Submit Application" }));
    expect(await screen.findByText("Leave request submitted successfully.")).toBeTruthy();
    expect(await screen.findByText("Test fixture request")).toBeTruthy();
  });

  it("shows login and leave API errors and blocks reversed dates", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText("Register Number / Username"), "unknown");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Invalid credentials");
    await user.clear(screen.getByLabelText("Register Number / Username"));
    await user.type(screen.getByLabelText("Register Number / Username"), "test-user");
    await user.clear(screen.getByLabelText("Password", { selector: "input" }));
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "test-password");
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    await screen.findByRole("button", { name: "Logout" });
    await user.click(screen.getByRole("button", { name: /Apply New Leave/ }));
    await user.type(screen.getByLabelText("From Date"), "2026-11-07");
    const to = screen.getByLabelText("To Date");
    await user.type(to, "2026-11-06");
    expect(to.validity.valid).toBe(false);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(LeaveRequest, "create").mockRejectedValueOnce(new Error("mock database write failure"));
    await user.clear(to);
    await user.type(to, "2026-11-08");
    await user.type(screen.getByLabelText("Reason"), "Test error fixture");
    await user.click(screen.getByRole("button", { name: "Submit Application" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Unable to create leave request.");
  });
});

describe("TC-23: attendance, notifications, and certificate", () => {
  it("renders API data, marks a notification read, and downloads the backend PDF", async () => {
    const user = userEvent.setup();
    let downloadedName;
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
      downloadedName = this.download;
    });
    const oldCreate = URL.createObjectURL;
    const oldRevoke = URL.revokeObjectURL;
    let certificateBlob;
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn((blob) => {
      certificateBlob = blob;
      return "blob:test-certificate";
    }) });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    try {
      renderApp();
      await login(user);
      expect(await screen.findByText("50%")).toBeTruthy();
      await user.click(screen.getByRole("button", { name: /Notifications/ }));
      expect(await screen.findByText("Your test leave was approved.")).toBeTruthy();
      await user.click(screen.getByRole("button", { name: "Mark as read" }));
      await waitFor(() => expect(screen.getByLabelText("0 unread notifications")).toBeTruthy());
      await user.click(screen.getByRole("button", { name: "View Attendance" }));
      expect(await screen.findByText("2026-10-22")).toBeTruthy();
      expect(screen.getByText("Present", { selector: "strong" })).toBeTruthy();
      await user.click(screen.getByRole("button", { name: "← Back to Dashboard" }));
      await user.click(screen.getByRole("button", { name: "View Status History and PDF" }));
      await user.click(await screen.findByRole("button", { name: "Download PDF" }));
      await waitFor(() => expect(anchorClick).toHaveBeenCalled());
      expect(downloadedName).toBe("od-leave-certificate-leave-approved.pdf");
      expect(await certificateBlob.text()).toContain("%PDF-mock certificate");
    } finally {
      if (oldCreate) Object.defineProperty(URL, "createObjectURL", { configurable: true, value: oldCreate });
      else delete URL.createObjectURL;
      if (oldRevoke) Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: oldRevoke });
      else delete URL.revokeObjectURL;
    }
  });
});
