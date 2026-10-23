import { useCallback, useState, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import Login from "./pages/Login";
import ApplyLeave from "./pages/ApplyLeave";
import ApplicationStatus from "./pages/ApplicationStatus";
import Attendance from "./pages/Attendance";
import { getAttendanceSummary, getLeaves, getNotifications, setNotificationRead, setAllNotificationsRead } from "./api";
import "./App.css";

function readSavedUser() {
  try { return JSON.parse(localStorage.getItem("user") || "null"); }
  catch { localStorage.removeItem("user"); return null; }
}

function App() {
  const navigate = useNavigate();
  const [user, setUser] = useState(readSavedUser);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const loadData = useCallback(async () => {
    try {
      const [summary, requests, messages] = await Promise.all([getAttendanceSummary(), getLeaves(), getNotifications()]);
      setAttendanceSummary(summary);
      setLeaves(Array.isArray(requests) ? requests : []);
      setNotifications(Array.isArray(messages) ? messages : []);
      setDashboardError("");
    } catch (error) { setDashboardError(error.message || "Unable to load dashboard data."); }
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    Promise.all([getAttendanceSummary(), getLeaves(), getNotifications()])
      .then(([summary, requests, messages]) => {
        if (!active) return;
        setAttendanceSummary(summary);
        setLeaves(Array.isArray(requests) ? requests : []);
        setNotifications(Array.isArray(messages) ? messages : []);
        setDashboardError("");
      })
      .catch((error) => { if (active) setDashboardError(error.message || "Unable to load dashboard data."); });
    return () => { active = false; };
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
    navigate("/");
  };

  if (!user) {
    return <Login onLoginSuccess={(userData) => setUser(userData)} />;
  }

  const username = user.username || user.name || user.user?.username || user.user?.name || "User";
  const role = user.role || user.user?.role || "USER";

  const approvedCount = leaves.filter((leave) => leave.status === "Approved").length;
  const pendingCount = leaves.filter((leave) => leave.status === "Pending").length;
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const markNotificationRead = async (id) => {
    try {
      await setNotificationRead(id);
      setNotifications((items) => items.map((item) => item._id === id ? { ...item, readAt: new Date().toISOString() } : item));
    } catch (error) { setDashboardError(error.message || "Unable to update notification."); }
  };
  const markAllNotificationsRead = async () => {
    try {
      await setAllNotificationsRead();
      setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    } catch (error) { setDashboardError(error.message || "Unable to update notifications."); }
  };

  return (
    <div style={styles.page}>
      {/* STREAMLINED HEADER */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Automated Student OD & Leave Approval</h1>
          <p style={styles.subtitle}>
            Welcome back, <strong>{username}</strong> ({role})
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button style={styles.refreshHeaderBtn} onClick={loadData}>
            🔄 Refresh Data
          </button>
          
          <button type="button" style={styles.notificationBtn} aria-expanded={notificationOpen} onClick={() => setNotificationOpen((open) => !open)}>
            Notifications <span style={styles.badge} aria-label={`${unreadCount} unread notifications`}>{unreadCount}</span>
          </button>

          <button style={styles.logoutButton} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* ROUTED PAGES */}
      <main style={styles.container}>
        <Routes>
          <Route
            path="/"
            element={
              <div>
                {/* STATISTICS GRID */}
                {dashboardError && <p role="alert" style={styles.error}>{dashboardError}</p>}
                <section style={styles.statsGrid}>
                  <div style={{ ...styles.statCard, borderTop: "5px solid #2563EB" }}>
                    <p style={styles.statLabel}>Total Attendance</p>
                    <h2 style={{ ...styles.statValue, color: "#2563EB" }}>{attendanceSummary ? `${attendanceSummary.attendancePercentage}%` : "—"}</h2>
                    <p style={styles.statText}>{attendanceSummary ? `${attendanceSummary.attendedClasses} of ${attendanceSummary.totalClasses} classes` : "Attendance summary"}</p>
                  </div>

                  <div style={{ ...styles.statCard, borderTop: "5px solid #16A34A" }}>
                    <p style={styles.statLabel}>Approved Leaves</p>
                    <h2 style={{ ...styles.statValue, color: "#16A34A" }}>{approvedCount}</h2>
                    <p style={styles.statText}>Successfully processed</p>
                  </div>

                  <div style={{ ...styles.statCard, borderTop: "5px solid #F59E0B" }}>
                    <p style={styles.statLabel}>Pending Leaves</p>
                    <h2 style={{ ...styles.statValue, color: "#F59E0B" }}>{pendingCount}</h2>
                    <p style={styles.statText}>Awaiting faculty review</p>
                  </div>

                  <div style={{ ...styles.statCard, borderTop: "5px solid #7C3AED" }}>
                    <p style={styles.statLabel}>Attendance Rule</p>
                    <h2 style={{ ...styles.statValue, color: "#7C3AED" }}>{attendanceSummary?.minimumRequired ?? 75}%</h2>
                    <p style={styles.statText}>{attendanceSummary ? (attendanceSummary.isEligible ? "Eligible" : "Below minimum") : "Minimum required"}</p>
                  </div>
                </section>

                {notificationOpen && <section aria-label="Notifications" style={styles.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2>Notifications</h2>
                    {unreadCount > 0 && <button type="button" onClick={markAllNotificationsRead}>Mark all as read</button>}
                  </div>
                  {notifications.length === 0 ? <p>No notifications yet.</p> : notifications.map((item) => (
                    <div key={item._id} style={styles.notificationRow}>
                      <p>{item.message}</p>
                      {!item.readAt && <button type="button" onClick={() => markNotificationRead(item._id)}>Mark as read</button>}
                    </div>
                  ))}
                </section>}

                {/* CENTRALIZED MANAGEMENT HUB */}
                <section style={styles.card}>
                  <div style={{ textAlign: "center", padding: "24px" }}>
                    <h2 style={{ color: "#0F172A", margin: "0 0 10px 0" }}>
                      Centralized Management Hub
                    </h2>
                    <p style={{ color: "#64748B", marginBottom: "24px" }}>
                      Select an option below to submit a new leave/OD application or track historical status and download approval certificates.
                    </p>
                    <div style={{ display: "flex", justifyContent: "center", gap: "16px" }}>
                      {(role === "STUDENT" || role === "ADMIN") && (
                        <button style={styles.actionBtnPrimary} onClick={() => navigate("/apply")}>
                          + Apply New Leave / OD
                        </button>
                      )}
                      <button style={styles.actionBtnSecondary} onClick={() => navigate("/status")}>
                        View Status History and PDF
                      </button>
                      <button style={styles.actionBtnSecondary} onClick={() => navigate("/attendance")}>View Attendance</button>
                    </div>
                  </div>
                </section>
              </div>
            }
          />
          <Route path="/apply" element={<ApplyLeave />} />
          <Route path="/status" element={<ApplicationStatus user={user} />} />
          <Route path="/attendance" element={<Attendance />} />
        </Routes>
      </main>

      {/* FOOTER */}
      <footer style={styles.footer}>
        <p>Automated Student OD and Leave Approval with Attendance Integration</p>
        <p>React • Node.js • Express • MongoDB</p>
      </footer>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#F8FAFC",
    color: "#0F172A",
    fontFamily: "Poppins, Arial, sans-serif",
    padding: "30px",
    boxSizing: "border-box",
  },
  container: { maxWidth: "1200px", margin: "0 auto" },
  header: {
    background: "#FFFFFF",
    padding: "24px 32px",
    borderRadius: "18px",
    marginBottom: "24px",
    border: "1px solid #E2E8F0",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
  },
  title: { margin: 0, color: "#1D4ED8", fontSize: "28px", fontWeight: "700" },
  subtitle: { color: "#64748B", marginTop: "6px", marginBottom: 0, fontSize: "14px" },
  refreshHeaderBtn: {
    background: "#F1F5F9",
    color: "#334155",
    border: "1px solid #CBD5E1",
    padding: "10px 16px",
    borderRadius: "8px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
  },
  notificationBtn: {
    background: "#EFF6FF",
    color: "#1E40AF",
    border: "1px solid #BFDBFE",
    padding: "10px 16px",
    borderRadius: "8px",
    fontWeight: "600",
    fontSize: "14px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  badge: {
    background: "#2563EB",
    color: "#FFFFFF",
    padding: "2px 8px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: "700",
  },
  logoutButton: {
    background: "#EF4444",
    color: "#FFFFFF",
    border: "none",
    padding: "10px 18px",
    borderRadius: "8px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "18px",
    marginBottom: "24px",
  },
  statCard: {
    background: "#FFFFFF",
    borderRadius: "16px",
    padding: "22px",
    border: "1px solid #E2E8F0",
    boxShadow: "0 6px 18px rgba(15, 23, 42, 0.06)",
  },
  statLabel: { margin: 0, color: "#64748B", fontSize: "13px", fontWeight: "600" },
  statValue: { margin: "8px 0", color: "#1D4ED8", fontSize: "30px", fontWeight: "700" },
  statText: { margin: 0, color: "#64748B", fontSize: "13px" },
  card: {
    background: "#FFFFFF",
    borderRadius: "16px",
    padding: "24px",
    border: "1px solid #E2E8F0",
    boxShadow: "0 6px 18px rgba(15, 23, 42, 0.06)",
    marginBottom: "24px",
  },
  actionBtnPrimary: {
    background: "#2563EB",
    color: "#FFFFFF",
    border: "none",
    padding: "13px 24px",
    borderRadius: "9px",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "14px",
  },
  actionBtnSecondary: {
    background: "#F1F5F9",
    color: "#334155",
    border: "1px solid #CBD5E1",
    padding: "13px 24px",
    borderRadius: "9px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
  },
  footer: { textAlign: "center", padding: "25px", color: "#64748B", fontSize: "13px" },
  error: { color: "#b91c1c", background: "#fee2e2", padding: "12px", borderRadius: "8px" },
  notificationRow: { display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #E2E8F0", padding: "8px 0" },
};

export default App;
