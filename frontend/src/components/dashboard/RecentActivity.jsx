import Icon from "../common/Icons";

/**
 * Recent Prescription Activity Component
 * 
 * Shows a chronological audit trail of prescription modifications,
 * dose confirmations, and caretaker interactions.
 */
export default function RecentActivity({ activities }) {
  const getIconForType = (type) => {
    switch (type) {
      case "dose_taken":
        return "checkCircle";
      case "prescription_renewed":
        return "prescriptions";
      case "stock_warning":
        return "alertTriangle";
      case "caretaker_view":
        return "caretaker";
      default:
        return "info";
    }
  };

  return (
    <div className="content-card">
      <div className="card-header">
        <div className="card-header-left">
          <div className="card-header-icon" style={{ color: "#0d9488" }}>
            <Icon name="heartPulse" size={20} />
          </div>
          <div>
            <h2 className="card-title">Recent Activity</h2>
            <p className="card-header-subtitle">
              Audit trail of doses, refills, and caretaker reviews
            </p>
          </div>
        </div>
      </div>

      <div className="activity-list">
        {activities.map((item) => (
          <div key={item.id} className="activity-item">
            <div className={`activity-icon-bullet ${item.badgeType}`}>
              <Icon name={getIconForType(item.type)} size={16} />
            </div>

            <div className="activity-content">
              <div className="activity-title-row">
                <span className="activity-title">{item.title}</span>
                <span className="activity-time">{item.timeAgo}</span>
              </div>
              <p className="activity-desc">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
