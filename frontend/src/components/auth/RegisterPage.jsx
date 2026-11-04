import { useState } from "react";
import Icon from "../common/Icons";
import { signUpWithEmail } from "../../services/authService";
import { isSupabaseConfigured } from "../../lib/supabase";

/**
 * MedSage AI - Registration Page Component (Connected to Supabase)
 * 
 * NOTE FOR BEGINNERS:
 * This component registers a new patient in Supabase:
 * 1. Validates form inputs before sending request
 * 2. Transmits full name and mobile number as user metadata
 * 3. Handles loading spinner and real-time validation error alerts
 */
export default function RegisterPage({ onSwitchToLogin, onRegisterSuccess }) {
  // Form fields state
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
  });

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [globalError, setGlobalError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Update a single form field
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    }
    if (globalError) setGlobalError("");
  };

  // Comprehensive client validation
  const validateForm = () => {
    const errors = {};

    if (!formData.fullName.trim()) {
      errors.fullName = "Full name is required.";
    } else if (formData.fullName.trim().length < 2) {
      errors.fullName = "Please enter your full name (at least 2 letters).";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      errors.email = "Email address is required.";
    } else if (!emailRegex.test(formData.email.trim())) {
      errors.email = "Please enter a valid email address (e.g. name@domain.com).";
    }

    const rawDigits = formData.mobile.replace(/\D/g, "");
    if (!formData.mobile.trim()) {
      errors.mobile = "Mobile number is required.";
    } else if (rawDigits.length < 10) {
      errors.mobile = "Please enter a valid mobile number with at least 10 digits.";
    }

    if (!formData.password) {
      errors.password = "Password is required.";
    } else if (formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters long.";
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = "Confirm password is required.";
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match. Please recheck.";
    }

    if (!formData.agreeTerms) {
      errors.agreeTerms = "You must agree to the Terms and Conditions to create an account.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit registration via Supabase
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setGlobalError("");
    setSuccessMessage("");

    const isValid = validateForm();
    if (!isValid) return;

    setIsLoading(true);
    try {
      const result = await signUpWithEmail({
        fullName: formData.fullName,
        email: formData.email,
        mobile: formData.mobile,
        password: formData.password,
      });

      if (result.success) {
        setSuccessMessage(result.message);
        // Wait 1.8 seconds so user can read message before redirecting to login
        setTimeout(() => {
          onRegisterSuccess(result.user, result.requiresEmailConfirmation);
        }, 1800);
      } else {
        setGlobalError(result.error);
      }
    } catch (err) {
      setGlobalError(err.message || "An unexpected error occurred during registration.");
    } finally {
      setIsLoading(false);
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

          <h1 className="auth-heading">Create Account</h1>
          <p className="auth-subtitle">
            Join MedSage AI for safe and intelligent medication management.
          </p>
        </div>

        {/* Supabase Status Indicator Badge */}
        <div className="auth-demo-badge">
          <Icon name="shieldCheck" size={16} color="#0d9488" />
          <div>
            <strong>Supabase Authentication:</strong> {isSupabaseConfigured ? "Connected to Cloud Auth API." : "Configuration pending in .env.local"}
          </div>
        </div>

        {/* Global Success Banner */}
        {successMessage && (
          <div className="auth-alert success" role="status">
            <Icon name="checkCircle" size={16} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Global Error Banner */}
        {globalError && (
          <div className="auth-alert error" role="alert">
            <Icon name="alertTriangle" size={16} />
            <span>{globalError}</span>
          </div>
        )}

        {/* Registration Form */}
        <form className="auth-form" onSubmit={handleRegisterSubmit} noValidate>
          {/* Full Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-name">
              Full Name
            </label>
            <div className="form-input-wrapper">
              <span className="input-icon-left">
                <Icon name="user" size={17} />
              </span>
              <input
                id="reg-name"
                type="text"
                className={`auth-input ${fieldErrors.fullName ? "input-error" : ""}`}
                placeholder="e.g. John Doe"
                value={formData.fullName}
                onChange={(e) => handleInputChange("fullName", e.target.value)}
                autoComplete="name"
                disabled={isLoading}
                required
              />
            </div>
            {fieldErrors.fullName && (
              <span className="field-error-msg">{fieldErrors.fullName}</span>
            )}
          </div>

          {/* Email Address */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">
              Email Address
            </label>
            <div className="form-input-wrapper">
              <span className="input-icon-left">
                <Icon name="mail" size={17} />
              </span>
              <input
                id="reg-email"
                type="email"
                className={`auth-input ${fieldErrors.email ? "input-error" : ""}`}
                placeholder="name@example.com"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                autoComplete="email"
                disabled={isLoading}
                required
              />
            </div>
            {fieldErrors.email && (
              <span className="field-error-msg">{fieldErrors.email}</span>
            )}
          </div>

          {/* Mobile Number */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-mobile">
              Mobile Number
            </label>
            <div className="form-input-wrapper">
              <span className="input-icon-left">
                <Icon name="phone" size={17} />
              </span>
              <input
                id="reg-mobile"
                type="tel"
                className={`auth-input ${fieldErrors.mobile ? "input-error" : ""}`}
                placeholder="(555) 000-0000"
                value={formData.mobile}
                onChange={(e) => handleInputChange("mobile", e.target.value)}
                autoComplete="tel"
                disabled={isLoading}
                required
              />
            </div>
            {fieldErrors.mobile && (
              <span className="field-error-msg">{fieldErrors.mobile}</span>
            )}
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">
              Password
            </label>
            <div className="form-input-wrapper">
              <span className="input-icon-left">
                <Icon name="lock" size={17} />
              </span>
              <input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                className={`auth-input has-right-icon ${
                  fieldErrors.password ? "input-error" : ""
                }`}
                placeholder="Minimum 6 characters"
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                autoComplete="new-password"
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
            {fieldErrors.password && (
              <span className="field-error-msg">{fieldErrors.password}</span>
            )}
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-confirm-password">
              Confirm Password
            </label>
            <div className="form-input-wrapper">
              <span className="input-icon-left">
                <Icon name="lock" size={17} />
              </span>
              <input
                id="reg-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                className={`auth-input has-right-icon ${
                  fieldErrors.confirmPassword ? "input-error" : ""
                }`}
                placeholder="Re-type your password"
                value={formData.confirmPassword}
                onChange={(e) =>
                  handleInputChange("confirmPassword", e.target.value)
                }
                autoComplete="new-password"
                disabled={isLoading}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
                title={showConfirmPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                <Icon name={showConfirmPassword ? "eyeOff" : "eye"} size={17} />
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <span className="field-error-msg">
                {fieldErrors.confirmPassword}
              </span>
            )}
          </div>

          {/* Terms & Conditions Checkbox */}
          <div className="form-group" style={{ marginTop: "4px" }}>
            <label className="checkbox-label" htmlFor="reg-terms">
              <input
                id="reg-terms"
                type="checkbox"
                checked={formData.agreeTerms}
                onChange={(e) =>
                  handleInputChange("agreeTerms", e.target.checked)
                }
                disabled={isLoading}
              />
              <span>
                I agree to the Terms and Conditions and Patient Safety Policy
              </span>
            </label>
            {fieldErrors.agreeTerms && (
              <span className="field-error-msg">{fieldErrors.agreeTerms}</span>
            )}
          </div>

          {/* Create Account Submit Button with Spinner */}
          <button type="submit" className="auth-submit-btn" disabled={isLoading}>
            <Icon name={isLoading ? "refresh" : "user"} size={16} className={isLoading ? "spin-icon" : ""} />
            <span>{isLoading ? "Creating Account..." : "Create Account"}</span>
          </button>
        </form>

        {/* Switch to Login Link */}
        <div className="auth-footer">
          <span>Already have an account? </span>
          <button
            type="button"
            className="auth-switch-link"
            onClick={onSwitchToLogin}
            disabled={isLoading}
          >
            Login
          </button>
        </div>
      </div>
    </div>
  );
}
