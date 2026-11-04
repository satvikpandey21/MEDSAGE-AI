import { useState } from "react";
import Icon from "../common/Icons";
import { signInWithEmail, sendPasswordResetEmail } from "../../services/authService";
import { isSupabaseConfigured } from "../../lib/supabase";

/**
 * MedSage AI - Login Page Component (Connected to Supabase)
 * 
 * NOTE FOR BEGINNERS:
 * This component authenticates users securely through the Supabase Authentication API:
 * 1. Collects email and password inputs
 * 2. Manages loading states while awaiting network response
 * 3. Shows clear, descriptive feedback for any authentication errors
 * 4. Passes verified user profile to the parent App component
 */
export default function LoginPage({
  onSwitchToRegister,
  onLoginSuccess,
  initialEmail = "",
  registrationNotice = "",
}) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetStatus, setResetStatus] = useState({ loading: false, message: "", error: "" });

  // Form submission handler using Supabase
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email.trim() || !password) {
      setErrorMessage("Please enter both your email address and password.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await signInWithEmail(email, password);
      if (result.success) {
        onLoginSuccess(result.user, result.session);
      } else {
        setErrorMessage(result.error);
      }
    } catch (err) {
      setErrorMessage(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Password reset handler via Supabase
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setResetStatus({ loading: false, message: "", error: "Please enter your email address." });
      return;
    }

    setResetStatus({ loading: true, message: "", error: "" });
    const res = await sendPasswordResetEmail(resetEmail);
    if (res.success) {
      setResetStatus({ loading: false, message: res.message, error: "" });
    } else {
      setResetStatus({ loading: false, message: "", error: res.error });
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-container">
        {/* Branding & Header */}
        <div className="auth-header">
          <div className="auth-brand-badge">
            <div className="auth-brand-icon">
              <Icon name="heartPulse" size={24} color="#ffffff" />
            </div>
            <div className="auth-brand-text">
              <div className="auth-brand-name">
                MedSage<span>AI</span>
              </div>
              <span className="auth-brand-tag">Patient Safety Platform</span>
            </div>
          </div>

          <h1 className="auth-heading">Welcome Back!</h1>
          <p className="auth-subtitle">
            Login to manage your medications safely.
          </p>
        </div>

        {/* Supabase Status Indicator Badge */}
        <div className="auth-demo-badge">
          <Icon name="shieldCheck" size={16} color="#0d9488" />
          <div>
            <strong>Supabase Authentication:</strong> {isSupabaseConfigured ? "Connected to Cloud Auth API." : "Configuration pending in .env.local"}
          </div>
        </div>

        {/* Registration Notice if redirected from signup */}
        {registrationNotice && (
          <div className="auth-alert success" role="status">
            <Icon name="checkCircle" size={16} />
            <span>{registrationNotice}</span>
          </div>
        )}

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="auth-alert error" role="alert">
            <Icon name="alertTriangle" size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form className="auth-form" onSubmit={handleLoginSubmit} noValidate>
          {/* Email Address Field */}
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Email Address
            </label>
            <div className="form-input-wrapper">
              <span className="input-icon-left">
                <Icon name="mail" size={17} />
              </span>
              <input
                id="login-email"
                type="email"
                className={`auth-input ${errorMessage ? "input-error" : ""}`}
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage("");
                }}
                autoComplete="email"
                disabled={isLoading}
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Password
            </label>
            <div className="form-input-wrapper">
              <span className="input-icon-left">
                <Icon name="lock" size={17} />
              </span>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                className={`auth-input has-right-icon ${
                  errorMessage ? "input-error" : ""
                }`}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage("");
                }}
                autoComplete="current-password"
                disabled={isLoading}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                <Icon name={showPassword ? "eyeOff" : "eye"} size={17} />
              </button>
            </div>
          </div>

          {/* Options: Remember Me & Forgot Password */}
          <div className="auth-options-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isLoading}
              />
              <span>Remember me</span>
            </label>

            <button
              type="button"
              className="forgot-password-link"
              onClick={() => {
                setResetEmail(email);
                setResetStatus({ loading: false, message: "", error: "" });
                setShowForgotPasswordModal(true);
              }}
              disabled={isLoading}
            >
              Forgot password?
            </button>
          </div>

          {/* Login Submit Button with Loading State */}
          <button type="submit" className="auth-submit-btn" disabled={isLoading}>
            <Icon name={isLoading ? "refresh" : "lock"} size={16} className={isLoading ? "spin-icon" : ""} />
            <span>{isLoading ? "Signing in..." : "Login to MedSage AI"}</span>
          </button>
        </form>

        {/* Switch to Registration */}
        <div className="auth-footer">
          <span>Don't have an account? </span>
          <button
            type="button"
            className="auth-switch-link"
            onClick={onSwitchToRegister}
            disabled={isLoading}
          >
            Create Account
          </button>
        </div>
      </div>

      {/* Forgot Password Modal (Connected to Supabase) */}
      {showForgotPasswordModal && (
        <div
          className="auth-modal-backdrop"
          onClick={() => setShowForgotPasswordModal(false)}
        >
          <div
            className="auth-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="auth-modal-header">
              <h2 className="auth-modal-title">Reset Your Password</h2>
              <button
                type="button"
                className="sidebar-close-btn"
                onClick={() => setShowForgotPasswordModal(false)}
                style={{ display: "flex" }}
                aria-label="Close dialog"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <p className="auth-modal-body">
              Enter your registered email address below. We will send you a secure password reset link via Supabase.
            </p>

            {resetStatus.message && (
              <div className="auth-alert success" style={{ marginBottom: "16px" }}>
                <Icon name="checkCircle" size={16} />
                <span>{resetStatus.message}</span>
              </div>
            )}

            {resetStatus.error && (
              <div className="auth-alert error" style={{ marginBottom: "16px" }}>
                <Icon name="alertTriangle" size={16} />
                <span>{resetStatus.error}</span>
              </div>
            )}

            {!resetStatus.message && (
              <form onSubmit={handleResetPassword}>
                <div className="form-group" style={{ marginBottom: "16px" }}>
                  <label className="form-label" htmlFor="reset-email">
                    Account Email
                  </label>
                  <div className="form-input-wrapper">
                    <span className="input-icon-left">
                      <Icon name="mail" size={17} />
                    </span>
                    <input
                      id="reset-email"
                      type="email"
                      className="auth-input"
                      placeholder="name@example.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="auth-modal-footer">
                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordModal(false)}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "var(--bg-card-subtle)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--radius-md)",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="auth-submit-btn"
                    style={{ width: "auto", margin: 0, padding: "8px 18px", fontSize: "0.85rem" }}
                    disabled={resetStatus.loading}
                  >
                    {resetStatus.loading ? "Sending link..." : "Send Reset Link"}
                  </button>
                </div>
              </form>
            )}

            {resetStatus.message && (
              <div className="auth-modal-footer">
                <button
                  type="button"
                  className="auth-submit-btn"
                  style={{ width: "auto", margin: 0, padding: "8px 18px", fontSize: "0.85rem" }}
                  onClick={() => setShowForgotPasswordModal(false)}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
