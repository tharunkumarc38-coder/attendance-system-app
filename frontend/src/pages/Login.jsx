import { useState } from "react";
import { getLogin } from "../api";

function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const userData = await getLogin({ username, password });
      localStorage.setItem("user", JSON.stringify(userData));
      onLoginSuccess(userData);
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <div className="login-container">
        <div className="login-left">
          <div className="brand">
            <div className="brand-icon">🎓</div>
            <div>
              <h1>OD & Leave</h1>
              <p>Management System</p>
            </div>
          </div>

          <div className="welcome-section">
            <h2>Welcome Back!</h2>
            <p>
              Manage your On-Duty requests, leave applications and attendance
              from one centralized platform.
            </p>
          </div>

          <div className="features">
            <div className="feature">
              <span>✓</span>
              <p>Online OD & Leave Applications</p>
            </div>
            <div className="feature">
              <span>✓</span>
              <p>Real-Time Attendance Integration</p>
            </div>
            <div className="feature">
              <span>✓</span>
              <p>Faculty & HOD Approval Workflow</p>
            </div>
          </div>
        </div>

        <div className="login-right">
          <div className="login-card">
            <div className="login-heading">
              <h2>Sign In</h2>
              <p>Enter your credentials to continue</p>
            </div>

            {error && (
              <div role="alert" style={{ color: "#dc2626", marginBottom: "1rem", fontSize: "0.875rem", fontWeight: "600", textAlign: "center" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="username">Register Number / Username</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    style={{ width: "100%", paddingRight: "50px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "#3b82f6",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "600",
                    }}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="login-options">
                <label className="remember">
                  <input type="checkbox" />
                  <span>Remember me</span>
                </label>

                <button type="button" className="forgot-button">
                  Forgot Password?
                </button>
              </div>

              <button type="submit" className="login-button" disabled={loading}>
                {loading ? "Signing In..." : "Sign In"}
              </button>
            </form>

            <p className="demo-note">
              Student OD & Leave Approval with Attendance Integration
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
