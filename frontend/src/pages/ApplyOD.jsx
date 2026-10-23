function ApplyOD() {
  return (
    <div className="form-page">

      <div className="form-header">
        <div>
          <h1>Apply for On-Duty</h1>
          <p>Submit your OD application for approval</p>
        </div>

        <div className="form-icon">
          📝
        </div>
      </div>

      <div className="application-form">

        <div className="form-section">
          <h2>OD Application Details</h2>

          <div className="form-row">

            <div className="input-group">
              <label>Register Number</label>
              <input
                type="text"
                placeholder="Enter register number"
              />
            </div>

            <div className="input-group">
              <label>Student Name</label>
              <input
                type="text"
                placeholder="Enter student name"
              />
            </div>

          </div>

          <div className="form-row">

            <div className="input-group">
              <label>OD Date</label>
              <input type="date" />
            </div>

            <div className="input-group">
              <label>Event / Activity</label>
              <input
                type="text"
                placeholder="Enter event or activity"
              />
            </div>

          </div>

          <div className="input-group">
            <label>Reason for OD</label>

            <textarea
              rows="4"
              placeholder="Enter the reason for your OD request"
            ></textarea>
          </div>

          <div className="input-group">
            <label>Supporting Document</label>

            <input type="file" />
          </div>

        </div>

        <div className="form-actions">
          <button className="cancel-button">
            Cancel
          </button>

          <button className="submit-button">
            Submit OD Application
          </button>
        </div>

      </div>

    </div>
  );
}

export default ApplyOD;