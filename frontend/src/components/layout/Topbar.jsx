import { useEffect, useRef, useState } from "react";
import useNotifications from "../../hooks/useNotifications";
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
  const notifications = useNotifications(currentUser?.rawId);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const panelRef = useRef(null);
  const bellRef = useRef(null);
  useEffect(() => {
    if (!notificationsOpen) return;
    panelRef.current?.focus();
    const close = (event) => {
      if (event.type === "keydown" && event.key === "Escape") {
        setNotificationsOpen(false);
        bellRef.current?.focus();
      } else if (event.type === "pointerdown" && !panelRef.current?.contains(event.target) && !bellRef.current?.contains(event.target)) setNotificationsOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, [notificationsOpen]);
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
          ref={bellRef}
          title={`${notifications.unread} unread notifications`}
          aria-label={`Notifications, ${notifications.unread} unread`}
          aria-expanded={notificationsOpen}
          aria-controls="notification-panel"
          onClick={() => setNotificationsOpen((open) => !open)}
        >
          <Icon name="bell" size={19} />
          {notifications.unread > 0 && <span className="notification-dot" style={{ width: "auto", height: "auto", minWidth: 14, padding: "1px 3px", fontSize: 9, lineHeight: "12px", color: "white", textAlign: "center" }}>{notifications.unread > 99 ? "99+" : notifications.unread}</span>}
        </button>

        {notificationsOpen && <section id="notification-panel" ref={panelRef} tabIndex={-1} role="region" aria-label="Notifications" style={{ position: "fixed", top: 70, right: 16, width: "min(380px, calc(100vw - 32px))", maxHeight: "min(540px, calc(100dvh - 90px))", overflowY: "auto", background: "white", color: "#1e293b", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 8px 28px #0002", padding: 16, zIndex: 1000 }}>
          <h3 style={{ marginTop: 0 }}>Notifications</h3>
          <button type="button" onClick={() => notifications.markRead()} disabled={!notifications.unread}>Mark all as read</button>
          <button type="button" onClick={() => { setNotificationsOpen(false); bellRef.current?.focus(); }}>Close</button>
          {notifications.error && <p role="alert">{notifications.error}</p>}
          {!notifications.error && !notifications.items.length && <p>No notifications yet. Medication and stock alerts will appear here.</p>}
          {notifications.items.map((item) => <article key={item.id} style={{ padding: "12px 0", borderBottom: "1px solid #e2e8f0" }}>
            <button type="button" style={{ border: 0, background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer", width: "100%" }} onClick={() => { notifications.markRead(item.id); onNavSelect(item.target); setNotificationsOpen(false); }}>
              <strong>{!item.read_at && "Unread: "}{item.title}</strong>
              <p style={{ margin: "6px 0" }}>{item.body}</p>
              <small>{new Date(item.created_at).toLocaleString()}</small>
            </button>
            {!item.read_at && <button type="button" onClick={() => notifications.markRead(item.id)}>Mark as read</button>}
          </article>)}
        </section>}

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
