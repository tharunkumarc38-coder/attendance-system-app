import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { submitLeave } from "../api";

function ApplyLeave() {
  const navigate = useNavigate();
  const [leaveType, setLeaveType] = useState("Medical");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submitLeaveRequest = async (event) => {
    event.preventDefault();
    if (loading) return;

    if (!fromDate || !toDate || !reason) {
      setMessage("Please fill all leave request fields.");
      return;
    }
    if (toDate < fromDate) {
      setMessage("To Date must be on or after From Date.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      await submitLeave({
        type: leaveType,
        from: fromDate,
        to: toDate,
        reason,
      });
      setMessage("Leave request submitted successfully!");
      navigate("/status", { state: { submitted: true } });
    } catch (error) {
      setMessage(error.message || "Unable to submit leave request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.card}>
      <div style={styles.sectionHeader}>
        <button style={styles.backButton} onClick={() => navigate("/")}>
          ← Back to Dashboard
        </button>
        <h2 style={styles.sectionTitle}>Submit Leave / OD Application</h2>
        <p style={styles.sectionDescription}>
          Fill in your details below to request On-Duty or Leave approval
        </p>
      </div>

      <form onSubmit={submitLeaveRequest} style={styles.form}>
        <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="leave-type">Leave Type</label>
          <select
              id="leave-type"
              name="type"
            style={styles.select}
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value)}
          >
            <option value="Medical">Medical</option>
            <option value="Personal">Personal</option>
            <option value="OD">OD (On-Duty)</option>
            <option value="Emergency">Emergency</option>
          </select>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="from-date">From Date</label>
            <input
              id="from-date"
              name="from"
              style={styles.input}
              type="date"
              required
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="to-date">To Date</label>
            <input
              id="to-date"
              name="to"
              style={styles.input}
              type="date"
              min={fromDate || undefined}
              required
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label} htmlFor="reason">Reason</label>
          <textarea
            id="reason"
            name="reason"
            style={styles.textarea}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter full reason for leave/OD"
            required
            rows="4"
          />
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            style={{ ...styles.submitButton, opacity: loading ? 0.7 : 1 }}
            type="submit"
            disabled={loading}
          >
            {loading ? "Submitting..." : "Submit Application"}
          </button>
          <button
            type="button"
            style={styles.cancelButton}
            onClick={() => navigate("/")}
          >
            Cancel
          </button>
        </div>

        {message && <div role={message.includes("successfully") ? "status" : "alert"} style={styles.message}>{message}</div>}
      </form>
    </div>
  );
}

const styles = {
  card: {
    background: "#FFFFFF",
    borderRadius: "16px",
    padding: "32px",
    border: "1px solid #E2E8F0",
    boxShadow: "0 6px 18px rgba(15, 23, 42, 0.06)",
    maxWidth: "800px",
    margin: "30px auto",
  },
  sectionHeader: { marginBottom: "24px" },
  backButton: {
    background: "none",
    border: "none",
    color: "#2563EB",
    fontWeight: "600",
    cursor: "pointer",
    padding: 0,
    marginBottom: "12px",
    fontSize: "14px",
  },
  sectionTitle: { color: "#0F172A", fontSize: "24px", fontWeight: "700", margin: 0 },
  sectionDescription: { color: "#64748B", fontSize: "14px", margin: "6px 0 0 0" },
  form: { display: "flex", flexDirection: "column", gap: "18px" },
  formRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" },
  formGroup: { display: "flex", flexDirection: "column", gap: "7px" },
  label: { fontSize: "14px", fontWeight: "600", color: "#334155" },
  input: {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
    fontSize: "14px",
    boxSizing: "border-box",
    cursor: "pointer",
  },
  textarea: {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
    fontSize: "14px",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  submitButton: {
    background: "#2563EB",
    color: "#FFFFFF",
    border: "none",
    padding: "13px 24px",
    borderRadius: "9px",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "14px",
  },
  cancelButton: {
    background: "#F1F5F9",
    color: "#475569",
    border: "1px solid #CBD5E1",
    padding: "13px 24px",
    borderRadius: "9px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px",
  },
  message: {
    padding: "13px",
    borderRadius: "9px",
    background: "#EFF6FF",
    color: "#1E40AF",
    border: "1px solid #BFDBFE",
    fontSize: "14px",
    fontWeight: "600",
  },
};

export default ApplyLeave;
