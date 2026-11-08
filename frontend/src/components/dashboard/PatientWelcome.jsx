import Icon from "../common/Icons";

/**
 * Patient Welcome Banner
 * Uses authenticated patient information and real dose statistics.
 */
export default function PatientWelcome({
  currentUser,
  adherenceRate = null,
}) {
  const patientName = currentUser?.name || "Patient";

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const hasAdherenceData =
    typeof adherenceRate === "number" &&
    Number.isFinite(adherenceRate);

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
            Your Medication Dashboard
          </span>
        </div>
      </div>

      <div className="welcome-stats-badge">
        <span className="badge-score">
          {hasAdherenceData ? `${adherenceRate}%` : "—"}
        </span>

        <span className="badge-label">
          Today's Adherence
        </span>

        <span className="badge-sub">
          {hasAdherenceData
            ? "Based on today's scheduled doses"
            : "No scheduled doses"}
        </span>
      </div>
    </section>
  );
}