import Icon from "../common/Icons";
import { patientProfile } from "../../data/mockData";

/**
 * Sidebar Navigation Component
 * 
 * NOTE FOR BEGINNERS:
 * This component displays the main menu of the MedSage AI application.
 * It takes props (inputs):
 * - activeNav: which menu item is currently clicked
 * - onNavSelect: a function to change the active view
 * - isOpen: whether the mobile drawer is open or closed
 * - onClose: a function to close the mobile drawer
 */
export default function Sidebar({ activeNav, onNavSelect, isOpen, onClose, currentUser, navItems = [], badgesLoading = false, badgesError = "" }) {
  const displayName = currentUser?.name || patientProfile.name;
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
  const displayId = currentUser?.id || patientProfile.id;
  return (
    <>
      {/* Dark backdrop overlay for mobile when sidebar is open */}
      <div
        className={`sidebar-overlay ${isOpen ? "active" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`app-sidebar ${isOpen ? "open" : ""}`}>
        {/* Brand Header */}
        <div className="sidebar-header">
          <div className="brand-wrapper">
            <div className="brand-icon-box">
              <Icon name="heartPulse" size={24} color="#ffffff" />
            </div>
            <div className="brand-text">
              <div className="brand-title">
                MedSage<span>AI</span>
              </div>
              <span className="brand-subtitle">Patient Safety</span>
            </div>
          </div>

          {/* Close button visible only on mobile screens */}
          <button
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Close sidebar"
            title="Close sidebar"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* Platform Status Pill */}
        <div className="safety-badge-wrapper">
          <div className="safety-badge">
            <span className="safety-pulse-dot" />
            <span>Platform Active & Safe</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="sidebar-nav">
          <span className="nav-section-label">Main Menu</span>
          {badgesLoading && <span role="status" style={{ padding: "0 20px", fontSize: 12 }}>Updating counts...</span>}
          {badgesError && <span role="status" title={badgesError} style={{ padding: "0 20px", fontSize: 12 }}>Counts unavailable</span>}

          {navItems.map((item) => {
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavSelect(item.id);
                  if (onClose) onClose();
                }}
                className={`nav-item-btn ${isActive ? "active" : ""}`}
              >
                <div className="nav-item-content">
                  <span className="nav-icon">
                    <Icon name={item.icon} size={19} />
                  </span>
                  <span>{item.label}</span>
                </div>

                {/* Optional notification or status badge */}
                {item.badge && (
                  <span
                    className={`nav-badge ${
                      item.badge.includes("Low")
                        ? "alert"
                        : item.badge === "AI" || item.badge === "New"
                        ? "ai-badge"
                        : ""
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Patient Card */}
        <div className="sidebar-footer">
          <div
            className="patient-profile-card"
            onClick={() => {
              onNavSelect("profile");
              if (onClose) onClose();
            }}
            style={{ cursor: "pointer" }}
            title="View & Edit Patient Profile"
          >
            <div className="patient-avatar">
              {initials}
            </div>
            <div className="patient-info">
              <span className="patient-name">{displayName}</span>
              <span className="patient-role">ID: {displayId}</span>
            </div>
            <div
              className="patient-status-indicator"
              title="Active Patient Monitoring"
            />
          </div>
        </div>
      </aside>
    </>
  );
}
