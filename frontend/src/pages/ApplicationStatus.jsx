import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getCertificate, getLeaves, updateLeaveStatus as saveLeaveStatus } from "../api";

function ApplicationStatus({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    try {
      const data = await getLeaves();
      setLeaves(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load leave requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getLeaves()
      .then((data) => { if (active) setLeaves(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err.message || "Unable to load leave requests."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // Safely normalize user role to uppercase for robust comparison
  const role = String(user?.role || user?.user?.role || "").toUpperCase();
  const isStaff = ["FACULTY", "ADMIN"].includes(role);

  const updateLeaveStatus = async (id, status) => {
    try {
      await saveLeaveStatus(id, status);
      await loadData();
    } catch (err) { setError(err.message || "Failed to update leave status."); }
  };

  const handleDownloadPDF = async (leave) => {
    setError("");
    try {
      const response = await getCertificate(leave._id);
      const href = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `od-leave-certificate-${leave._id}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (err) { setError(err.message || "Unable to download certificate."); }
  };

  return (
    <div style={styles.card}>
      <div style={styles.sectionHeader}>
        <button style={styles.backButton} onClick={() => navigate("/")}>← Back to Dashboard</button>
        <h2 style={styles.sectionTitle}>{role === "STUDENT" ? "My Leave & OD Applications" : "All Student Applications"}</h2>
        <p style={styles.sectionDescription}>Track status history and download approval certificates</p>
      </div>
      {location.state?.submitted && <p role="status" style={styles.success}>Leave request submitted successfully.</p>}
      {error && <p role="alert" style={styles.error}>{error}</p>}
      {loading ? <p role="status">Loading leave requests...</p> : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead><tr>{["Student ID", "Type", "From", "To", "Reason", "Status", "Actions / PDF"].map((label) => <th key={label} style={styles.th}>{label}</th>)}</tr></thead>
            <tbody>
              {leaves.length === 0 ? <tr><td colSpan="7" style={styles.empty}>No leave applications found.</td></tr> : leaves.map((leave) => (
                <tr key={leave._id}>
                  <td style={styles.td}>{leave.studentId || "-"}</td>
                  <td style={styles.td}>{leave.type || leave.leaveType || "-"}</td>
                  <td style={styles.td}>{leave.from || leave.fromDate || "-"}</td>
                  <td style={styles.td}>{leave.to || leave.toDate || "-"}</td>
                  <td style={styles.td}>{leave.reason || "-"}</td>
                  <td style={styles.td}><span style={leave.status === "Approved" ? styles.approvedBadge : leave.status === "Rejected" ? styles.rejectedBadge : styles.pendingBadge}>{leave.status}</span></td>
                  <td style={styles.td}>
                    {leave.status === "Approved" && <button style={styles.pdfBtn} onClick={() => handleDownloadPDF(leave)}>Download PDF</button>}
                    {isStaff && leave.status === "Pending" && <>
                      <button style={styles.approveBtn} onClick={() => updateLeaveStatus(leave._id, "Approved")}>Approve</button>{" "}
                      <button style={styles.rejectBtn} onClick={() => updateLeaveStatus(leave._id, "Rejected")}>Reject</button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles = {
  card: { background: "#FFFFFF", borderRadius: "16px", padding: "32px", border: "1px solid #E2E8F0", boxShadow: "0 6px 18px rgba(15, 23, 42, 0.06)", maxWidth: "1150px", margin: "30px auto" },
  sectionHeader: { marginBottom: "24px" },
  backButton: { background: "none", border: "none", color: "#2563EB", fontWeight: "600", cursor: "pointer", padding: 0, marginBottom: "12px", fontSize: "14px" },
  sectionTitle: { color: "#0F172A", fontSize: "24px", fontWeight: "700", margin: 0 },
  sectionDescription: { color: "#64748B", fontSize: "14px", margin: "6px 0 0" },
  tableWrapper: { width: "100%", overflowX: "auto", borderRadius: "10px" },
  table: { width: "100%", borderCollapse: "collapse", background: "#FFFFFF" },
  th: { background: "#EFF6FF", color: "#1E3A8A", padding: "14px", textAlign: "left", borderBottom: "2px solid #BFDBFE", fontSize: "13px", fontWeight: "700" },
  td: { padding: "14px", borderBottom: "1px solid #E2E8F0", color: "#334155", fontSize: "13px" },
  empty: { padding: "24px", textAlign: "center", color: "#64748B" },
  approvedBadge: { background: "#DCFCE7", color: "#166534", padding: "5px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "700", display: "inline-block" },
  pendingBadge: { background: "#FEF3C7", color: "#92400E", padding: "5px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "700", display: "inline-block" },
  rejectedBadge: { background: "#FEE2E2", color: "#991B1B", padding: "5px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "700", display: "inline-block" },
  pdfBtn: { background: "#1E40AF", color: "#FFFFFF", border: "none", padding: "6px 12px", borderRadius: "6px", fontWeight: "600", cursor: "pointer", fontSize: "12px" },
  approveBtn: { background: "#16A34A", color: "#FFFFFF", border: "none", padding: "6px 12px", borderRadius: "6px", fontWeight: "600", cursor: "pointer", fontSize: "12px" },
  rejectBtn: { background: "#DC2626", color: "#FFFFFF", border: "none", padding: "6px 12px", borderRadius: "6px", fontWeight: "600", cursor: "pointer", fontSize: "12px" },
  error: { color: "#b91c1c", background: "#fee2e2", padding: "12px", borderRadius: "8px" },
  success: { color: "#166534", background: "#DCFCE7", padding: "12px", borderRadius: "8px" },
};

export default ApplicationStatus;