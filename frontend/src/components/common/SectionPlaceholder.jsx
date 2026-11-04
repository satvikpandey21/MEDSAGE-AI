import Icon from "./Icons";

/**
 * Placeholder View for Inactive/Upcoming Sections
 * 
 * NOTE FOR BEGINNERS:
 * When the user clicks a sidebar item like "Pharmacy Bill Checker" or
 * "Caretaker", this component shows a friendly preview card rather than a blank
 * screen. This keeps the application feeling complete and responsive.
 */
export default function SectionPlaceholder({ title, icon, onReturnToDashboard }) {
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-xl)",
        padding: "48px 32px",
        textAlign: "center",
        boxShadow: "var(--shadow-sm)",
        maxWidth: "680px",
        margin: "40px auto",
      }}
    >
      <div
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "var(--radius-lg)",
          backgroundColor: "var(--color-primary-light)",
          color: "var(--color-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
        }}
      >
        <Icon name={icon || "info"} size={32} />
      </div>

      <h2
        style={{
          fontSize: "1.4rem",
          fontWeight: 700,
          color: "var(--text-main)",
          marginBottom: "8px",
        }}
      >
        {title} Module
      </h2>

      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: "0.95rem",
          lineHeight: "1.6",
          marginBottom: "24px",
        }}
      >
        This section is pre-configured in your navigation. We will build out this
        feature step-by-step after you review and approve your main dashboard!
      </p>

      <button
        onClick={onReturnToDashboard}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          backgroundColor: "var(--color-primary)",
          color: "#ffffff",
          fontWeight: 600,
          fontSize: "0.9rem",
          padding: "10px 20px",
          borderRadius: "var(--radius-md)",
          boxShadow: "0 2px 4px rgba(2, 132, 199, 0.25)",
        }}
      >
        <Icon name="dashboard" size={16} color="#ffffff" />
        Return to Dashboard
      </button>
    </div>
  );
}
