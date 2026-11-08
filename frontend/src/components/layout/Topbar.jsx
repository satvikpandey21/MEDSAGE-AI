import Icon from "../common/Icons";


/**
 * Topbar Header Component
 * 
 * NOTE FOR BEGINNERS:
 * The Topbar provides quick global actions like searching, opening the
 * mobile navigation, and checking patient adherence at a glance.
 */
export default function Topbar({
  onToggleSidebar,
  currentUser,
  onNavSelect,
  adherenceRate = null,
}) {
  const displayName = currentUser?.name || "Patient";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
  return (
    <header className="app-topbar">
      <div className="topbar-left">
        {/* Mobile menu button (hidden on desktop) */}
        <button
          className="mobile-menu-btn"
          onClick={onToggleSidebar}
          aria-label="Open menu"
        >
          <Icon name="menu" size={22} />
        </button>

        {/* Global Search Bar */}
        <div className="topbar-search-box">
          <Icon name="search" size={17} className="topbar-search-icon" />
          <input
            type="text"
            className="topbar-search-input"
            placeholder="Search medications, prescriptions..."
            aria-label="Search medications"
          />
        </div>
      </div>

      <div className="topbar-right">
        {/* Quick Adherence Badge */}
        <div
  className="topbar-adherence-pill"
  title="Today's medication adherence"
>
  <Icon name="checkCircle" size={16} color="#0d9488" />
  <span>
    {adherenceRate === null ? "—" : `${adherenceRate}%`} Adherence Today
  </span>
</div>

        {/* Notifications Icon */}
        <button
          className="notification-bell-btn"
          title="2 new medication alerts"
          aria-label="Notifications"
        >
          <Icon name="bell" size={19} />
          <span className="notification-dot" />
        </button>

        {/* Patient Profile Pill */}
        <div
          className="topbar-patient-pill"
          onClick={() => onNavSelect && onNavSelect("profile")}
          style={{ cursor: onNavSelect ? "pointer" : "default" }}
          title="View & Edit Patient Profile"
        >
          <div className="topbar-avatar-small">{initials}</div>
          <span className="topbar-patient-name">{displayName}</span>
        </div>
      </div>
    </header>
  );
}
