import { useNavigate } from "react-router-dom";

function StudentDashboard() {
  const navigate = useNavigate();

  return (
    <div className="dashboard">

      <header className="dashboard-header">
        <div>
          <h1>Student Dashboard</h1>
          <p>OD & Leave Management System</p>
        </div>

        <div className="student-profile">
          <div className="profile-icon">🎓</div>

          <div>
            <strong>Student</strong>
            <span>Student Portal</span>
          </div>
        </div>
      </header>

      <main className="dashboard-content">

        <section className="welcome-card">
          <h2>Welcome, Student! 👋</h2>

          <p>
            Manage your OD requests, leave applications and attendance
            from one place.
          </p>
        </section>

        <section className="dashboard-cards">

          {/* APPLY OD */}
          <div className="dashboard-card">
            <div className="card-icon">📝</div>

            <h3>Apply OD</h3>

            <p>
              Submit a new On-Duty application.
            </p>

            <button
              onClick={() => navigate("/student/apply-od")}
            >
              Apply Now
            </button>
          </div>

          {/* APPLY LEAVE */}
          <div className="dashboard-card">
            <div className="card-icon">📅</div>

            <h3>Apply Leave</h3>

            <p>
              Submit your leave application.
            </p>

            <button onClick={() => navigate("/student/apply-leave")}>
              Apply Now
            </button>
          </div>

          {/* ATTENDANCE */}
          <div className="dashboard-card">
            <div className="card-icon">📊</div>

            <h3>Attendance</h3>

            <p>
              View your current attendance details.
            </p>

            <button onClick={() => navigate("/student/attendance")}>
              View Attendance
            </button>
          </div>

          {/* APPLICATION STATUS */}
          <div className="dashboard-card">
            <div className="card-icon">🔍</div>

            <h3>Application Status</h3>

            <p>
              Track your OD and leave requests.
            </p>

            <button onClick={() => navigate("/student/application-status")}>
              View Status
            </button>
          </div>

        </section>

      </main>
    </div>
  );
}

export default StudentDashboard;