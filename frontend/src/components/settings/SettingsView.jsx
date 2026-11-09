import { useState } from "react";
import Icon from "../common/Icons";

/**
 * Settings & Account Management View
 * 
 * NOTE FOR BEGINNERS:
 * This component displays user profile settings and provides a safe,
 * confirmed logout mechanism.
 */
export default function SettingsView({ currentUser, onLogout }) {
  // Confirmation modal state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Settings Header */}
      <div>
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 800,
            color: "var(--text-main)",
            letterSpacing: "-0.02em",
          }}
        >
          Account & Platform Settings
        </h1>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "0.95rem",
            marginTop: "4px",
          }}
        >
          Manage your patient profile, notification preferences, and active demo session.
        </p>
      </div>

      {/* Grid of Settings Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "20px",
        }}
      >
        {/* 1. Patient Profile Card */}
        <div className="content-card" style={{ padding: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "20px",
              paddingBottom: "14px",
              borderBottom: "1px solid var(--border-light)",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-primary-light)",
                color: "var(--color-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="user" size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                Patient Profile
              </h2>
              <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                Verified Personal Information
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}
              >
                Full Name
              </span>
              <p
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: "var(--text-main)",
                }}
              >
                {currentUser?.name || "Sarah Jenkins"}
              </p>
            </div>

            <div>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}
              >
                Email Address
              </span>
              <p
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: "var(--text-main)",
                }}
              >
                {currentUser?.email || "demo@medsage.ai"}
              </p>
            </div>

            <div>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}
              >
                Mobile Contact
              </span>
              <p
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: "var(--text-main)",
                }}
              >
                {currentUser?.mobile || "(555) 019-2834"}
              </p>
            </div>

            <div>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}
              >
                Patient Identifier
              </span>
              <p
                style={{
                  fontSize: "0.9rem",
                  fontFamily: "monospace",
                  color: "var(--color-primary)",
                  fontWeight: 700,
                }}
              >
                {currentUser?.id || "MED-88492"}
              </p>
            </div>
          </div>
        </div>

        {/* 2. Notification Preferences */}
        <div className="content-card" style={{ padding: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "20px",
              paddingBottom: "14px",
              borderBottom: "1px solid var(--border-light)",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-teal-light)",
                color: "var(--color-teal)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="bell" size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                Alert Preferences
              </h2>
              <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                Notification Safety Triggers
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "0.88rem",
                color: "var(--text-main)",
                cursor: "pointer",
              }}
            >
              <div>
                <strong>Dose Reminders</strong>
                <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                  Receive prompt reminders before scheduled medication times
                </p>
              </div>
              <input
                type="checkbox"
                defaultChecked
                style={{ width: "18px", height: "18px", accentColor: "var(--color-teal)" }}
              />
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "0.88rem",
                color: "var(--text-main)",
                cursor: "pointer",
              }}
            >
              <div>
                <strong>Low Stock Warnings</strong>
                <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                  Trigger warning when supply drops below 7 days
                </p>
              </div>
              <input
                type="checkbox"
                defaultChecked
                style={{ width: "18px", height: "18px", accentColor: "var(--color-teal)" }}
              />
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "0.88rem",
                color: "var(--text-main)",
                cursor: "pointer",
              }}
            >
              <div>
                <strong>Caretaker Sync</strong>
                <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                  Notify designated caretaker if dose is missed
                </p>
              </div>
              <input
                type="checkbox"
                defaultChecked
                style={{ width: "18px", height: "18px", accentColor: "var(--color-teal)" }}
              />
            </label>
          </div>
        </div>

        {/* 3. Security & Logout Option */}
        <div
          className="content-card"
          style={{
            padding: "24px",
            border: "1px solid #fecaca",
            backgroundColor: "#fffafa",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "16px",
              paddingBottom: "14px",
              borderBottom: "1px solid #fee2e2",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--status-danger-bg)",
                color: "var(--status-danger)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="logout" size={22} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: "var(--status-danger-text)",
                }}
              >
                Session & Logout
              </h2>
              <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                Active Supabase Authentication Session
              </span>
            </div>
          </div>

          <p
            style={{
              fontSize: "0.86rem",
              color: "var(--text-secondary)",
              lineHeight: "1.5",
              marginBottom: "20px",
            }}
          >
            Logging out clears your active authenticated session from this browser. You will
            be returned to the Login screen and will need to log in again to view your dashboard.
          </p>

          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              backgroundColor: "var(--status-danger)",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "0.9rem",
              borderRadius: "var(--radius-md)",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(239, 68, 68, 0.25)",
              transition: "background-color 0.2s",
            }}
          >
            <Icon name="logout" size={16} color="#ffffff" />
            <span>Log Out of MedSage AI</span>
          </button>
        </div>
      </div>

      {/* Logout Confirmation Dialog Modal */}
      {showLogoutConfirm && (
        <div
          className="auth-modal-backdrop"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="auth-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="auth-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    backgroundColor: "var(--status-danger-bg)",
                    color: "var(--status-danger)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="logout" size={18} />
                </div>
                <h2 className="auth-modal-title">Confirm Logout</h2>
                {logoutError && <p role="alert">{logoutError}</p>}
              </div>
              <button
                type="button"
                className="sidebar-close-btn"
                onClick={() => setShowLogoutConfirm(false)}
                style={{ display: "flex" }}
                aria-label="Cancel"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <p className="auth-modal-body">
              Are you sure you want to log out of <strong>MedSage AI</strong>?
              <br />
              <br />
              Your active demo session will be cleared from this browser. You will
              be redirected to the Login page immediately.
            </p>

            <div className="auth-modal-footer">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  padding: "9px 18px",
                  backgroundColor: "var(--bg-card-subtle)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-secondary)",
                  borderRadius: "var(--radius-md)",
                  fontWeight: 600,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={loggingOut}
                onClick={async () => {
                  setLoggingOut(true); setLogoutError("");
                  try {
                    const result = await onLogout();
                    if (!result?.success) setLogoutError(result?.error || "Unable to sign out. Please retry.");
                    else setShowLogoutConfirm(false);
                  } catch { setLogoutError("Unable to sign out. Please retry."); }
                  finally { setLoggingOut(false); }
                }}
                style={{
                  padding: "9px 20px",
                  backgroundColor: "var(--status-danger)",
                  border: "none",
                  color: "#ffffff",
                  borderRadius: "var(--radius-md)",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 4px rgba(239, 68, 68, 0.25)",
                }}
              >
                <Icon name="logout" size={15} color="#ffffff" />
                <span>Yes, Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
