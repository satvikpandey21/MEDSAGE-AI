import Icon from "../common/Icons";
import { patientProfile } from "../../data/mockData";

/**
 * Welcome Banner Component
 * 
 * Displays the primary welcoming message, patient context, and
 * the 30-day compliance indicator.
 */
export default function PatientWelcome({ currentUser }) {
  const patientName = currentUser?.name || patientProfile.name;
  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <section className="welcome-banner" aria-label="Welcome section">
      <div className="welcome-text-group">
        <h1 className="welcome-title">
          Welcome to <span className="highlight">MedSage AI</span>
        </h1>
        <p className="welcome-subtitle">
          Your intelligent medication companion.
        </p>

        <div className="welcome-meta-chips">
          <span className="meta-chip">
            <Icon name="clock" size={14} color="#0284c7" />
            {currentDate}
          </span>
          <span className="meta-chip">
            <Icon name="heartPulse" size={14} color="#0d9488" />
            Patient: {patientName}
          </span>
          <span className="meta-chip">
            <Icon name="shieldCheck" size={14} color="#10b981" />
            Supervised by {patientProfile.primaryPhysician}
          </span>
        </div>
      </div>

      <div className="welcome-stats-badge">
        <span className="badge-score">{patientProfile.adherenceRate}%</span>
        <span className="badge-label">Monthly Adherence</span>
        <span className="badge-sub">Excellent Record</span>
      </div>
    </section>
  );
}
