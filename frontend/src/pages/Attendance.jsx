import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAttendance, getAttendanceSummary } from "../api";

function Attendance() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchStudentId, setSearchStudentId] = useState("");

  // Get user role from local storage or wherever auth state is kept
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isStaff = ["FACULTY", "ADMIN"].includes(user.role);

  const fetchData = async (studentQuery = "") => {
    setLoading(true);
    try {
      const queryParam = studentQuery ? { studentId: studentQuery } : {};
      const [result, entries] = await Promise.all([
        getAttendanceSummary(queryParam),
        getAttendance(queryParam)
      ]);
      setSummary(result);
      setRecords(Array.isArray(entries) ? entries : []);
    } catch (err) {
      setError(err.message || "Unable to load attendance.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchData(searchStudentId);
  };

  if (loading && records.length === 0) return (
    <section className="attendance-page">
      <div className="attendance-container">
        <p className="loading-state" role="status">Loading attendance records...</p>
      </div>
    </section>
  );

  return (
    <section className="attendance-page">
      <div className="attendance-container">
        {/* Header Section */}
        <div className="attendance-header">
          <div className="header-left">
            <button type="button" className="back-btn" onClick={() => navigate("/")}>
              ← Back to Dashboard
            </button>
            <h1>{isStaff ? "Faculty Attendance Management" : "Attendance Overview"}</h1>
            <p>{isStaff ? "Manage and view student attendance logs across the system" : "Daily attendance records and eligibility summary"}</p>
          </div>
          <div className="attendance-icon" aria-hidden="true">📊</div>
        </div>

        {/* Faculty Search Filter */}
        {isStaff && (
          <div className="faculty-filter-card" style={{ background: "#ffffff", padding: "20px 30px", borderRadius: "16px", marginBottom: "24px", boxShadow: "0 4px 15px rgba(0,0,0,0.04)" }}>
            <form onSubmit={handleSearch} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <input 
                type="text" 
                placeholder="Filter by Student ID (e.g. 2)..." 
                value={searchStudentId}
                onChange={(e) => setSearchStudentId(e.target.value)}
                style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", flex: 1, outline: "none" }}
              />
              <button type="submit" className="login-button" style={{ width: "auto", padding: "10px 20px" }}>Search</button>
              {searchStudentId && (
                <button type="button" onClick={() => { setSearchStudentId(""); fetchData(""); }} style={{ background: "#64748b", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "8px", cursor: "pointer" }}>Reset</button>
              )}
            </form>
          </div>
        )}

        {/* Overview Stat Cards */}
        <div className="attendance-overview">
          <div className="attendance-summary-card">
            <p className="summary-label">{isStaff ? "System Overall Attendance" : "Overall Attendance"}</p>
            <h2 className="summary-percentage">{summary?.attendancePercentage ?? 0}%</h2>
            {summary?.isEligible !== null && summary?.isEligible !== undefined && (
              <span className={`eligibility-badge ${summary?.isEligible ? "eligible" : "ineligible"}`}>
                {summary?.isEligible ? "Eligible" : "Below Minimum"} · Min {summary?.minimumRequired ?? 75}%
              </span>
            )}
          </div>

          <div className="attendance-stat-card present">
            <div className="stat-content">
              <strong>{summary?.attendedClasses ?? 0}</strong>
              <span>Present</span>
            </div>
          </div>

          <div className="attendance-stat-card absent">
            <div className="stat-content">
              <strong>{summary?.totalClasses ? Math.max(summary.totalClasses - (summary?.attendedClasses ?? 0), 0) : 0}</strong>
              <span>Absent</span>
            </div>
          </div>

          <div className="attendance-stat-card total">
            <div className="stat-content">
              <strong>{summary?.totalClasses ?? 0}</strong>
              <span>Total Classes</span>
            </div>
          </div>
        </div>

        {/* Attendance Records Table */}
        <div className="subject-attendance">
          <div className="section-heading">
            <h2>Attendance Records</h2>
            <p>{isStaff ? "System-wide student attendance logs" : "Detailed log supplied by the attendance service"}</p>
          </div>

          {records.length === 0 ? (
            <p className="no-records" style={{ padding: "20px 0", color: "#64748b" }}>No attendance records found.</p>
          ) : (
            <div className="attendance-table-wrapper">
              <div className="attendance-table">
                <div className="table-header">
                  <span>Date</span>
                  <span>Student ID</span>
                  <span>Status</span>
                </div>
                {records.map((record) => {
                  const isPresent = String(record.status).toLowerCase() === "present";
                  return (
                    <div className="table-row" key={record._id || `${record.studentId}-${record.date}`}>
                      <span className="row-date">{record.date}</span>
                      <span className="row-id">{record.studentId}</span>
                      <span className="row-status">
                        <strong className={`status-badge ${isPresent ? "present" : "absent"}`}>
                          {record.status}
                        </strong>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default Attendance;