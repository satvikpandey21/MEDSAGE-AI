import { useState, useEffect } from "react";
import Icon from "../common/Icons";
import { getPatientProfile, updatePatientProfile } from "../../services/profileService";

/**
 * MedSage AI - Patient Profile View
 * 
 * NOTE FOR BEGINNERS:
 * This component fetches and updates the logged-in patient's record
 * stored in the `public.patient_profiles` table in Supabase.
 * 
 * Security:
 * - Uses the authenticated user's ID (`auth.uid()`).
 * - Supabase Row Level Security (RLS) ensures users cannot access or modify
 *   any other patient's record.
 */
export default function PatientProfileView({ currentUser, onProfileUpdated }) {
  const userId = currentUser?.rawId || currentUser?.id;
  const userEmail = currentUser?.email || "";

  // Profile form state
  const [formData, setFormData] = useState({
    patientId: "",
    fullName: "",
    age: "",
    gender: "",
    phone: "",
  });

  const [isLoading, setIsLoading] = useState(Boolean(userId));
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [validationErrors, setValidationErrors] = useState({});

  // Fetch patient profile from Supabase on mount
  useEffect(() => {
    if (!userId) return;
    let isMounted = true;

    async function loadProfile() {
      const result = await getPatientProfile(userId, currentUser);

      if (isMounted) {
        if (result.success && result.profile) {
          setFormData({
            patientId: result.profile.patientId || "",
            fullName: result.profile.fullName || currentUser?.name || "",
            age: result.profile.age || "",
            gender: result.profile.gender || "",
            phone: result.profile.phone || currentUser?.mobile || "",
          });
        } else {
          setErrorMessage(result.error || "Failed to load profile from database.");
        }
        setIsLoading(false);
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [userId, currentUser]);

  // Field change handler
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: "" }));
    }
    if (successMessage) setSuccessMessage("");
    if (errorMessage) setErrorMessage("");
  };

  // Form validation
  const validateForm = () => {
    const errors = {};

    if (!formData.fullName.trim()) {
      errors.fullName = "Full name is required.";
    } else if (formData.fullName.trim().length < 2) {
      errors.fullName = "Please enter a valid name (at least 2 letters).";
    }

    if (formData.age) {
      const ageNum = parseInt(formData.age, 10);
      if (isNaN(ageNum) || ageNum < 1 || ageNum > 130) {
        errors.age = "Please enter a valid age between 1 and 130.";
      }
    }

    if (formData.phone) {
      const rawDigits = formData.phone.replace(/\D/g, "");
      if (rawDigits.length > 0 && rawDigits.length < 10) {
        errors.phone = "Phone number must have at least 10 digits.";
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save changes to Supabase
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSuccessMessage("");
    setErrorMessage("");

    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const result = await updatePatientProfile(userId, formData);

      if (result.success) {
        setSuccessMessage(result.message || "Profile successfully updated!");
        // Update local form state with any database-assigned values
        setFormData((prev) => ({
          ...prev,
          patientId: result.profile.patientId,
          fullName: result.profile.fullName,
          age: result.profile.age,
          gender: result.profile.gender,
          phone: result.profile.phone,
        }));

        // Notify parent App component to update the user header/sidebar across the app
        if (onProfileUpdated) {
          onProfileUpdated({
            name: result.profile.fullName,
            id: result.profile.patientId,
            mobile: result.profile.phone,
          });
        }
      } else {
        setErrorMessage(result.error || "Failed to update profile.");
      }
    } catch (err) {
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  // Check if clinical profile has missing fields
  const isIncomplete = !formData.age || !formData.gender || !formData.phone;

  // Compute initials for display avatar
  const displayName = formData.fullName || currentUser?.name || "Patient";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  if (isLoading) {
    return (
      <div className="profile-page-container">
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-xl)",
            padding: "60px 24px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <Icon name="refresh" size={24} className="spin-icon" color="#0284c7" />
          <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-secondary)" }}>
            Loading patient profile from Supabase...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page-container">
      {/* Page Header */}
      <div className="profile-page-header">
        <div>
          <h1 className="profile-header-title">Patient Profile</h1>
          <p className="profile-header-subtitle">
            Manage your personal medical identification and clinical contact records.
          </p>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.78rem",
            fontWeight: 600,
            color: "#0f766e",
            backgroundColor: "var(--color-teal-light)",
            padding: "6px 14px",
            borderRadius: "var(--radius-full)",
            border: "1px solid #99f6e4",
          }}
        >
          <Icon name="shieldCheck" size={16} color="#0d9488" />
          <span>RLS Protected Record</span>
        </div>
      </div>

      {/* Main Grid: Summary Card (Left) & Form Card (Right) */}
      <div className="profile-grid-layout">
        {/* Left Column: Summary Card */}
        <aside className="profile-summary-card">
          <div className="profile-avatar-large">
            {initials || "PT"}
          </div>

          <h2 className="profile-summary-name">{displayName}</h2>
          <span className="profile-id-pill">
            <Icon name="lock" size={12} color="#0284c7" />
            {formData.patientId || "MED-PENDING"}
          </span>

          <div className="profile-meta-divider" />

          <div className="profile-info-list">
            <div className="profile-info-item">
              <span className="profile-info-label">Account Email:</span>
              <span className="profile-info-value" style={{ wordBreak: "break-all" }}>
                {userEmail || "Not available"}
              </span>
            </div>

            <div className="profile-info-item">
              <span className="profile-info-label">Gender:</span>
              <span className="profile-info-value">
                {formData.gender || "Not specified"}
              </span>
            </div>

            <div className="profile-info-item">
              <span className="profile-info-label">Age:</span>
              <span className="profile-info-value">
                {formData.age ? `${formData.age} years` : "Not specified"}
              </span>
            </div>

            <div className="profile-info-item">
              <span className="profile-info-label">Phone:</span>
              <span className="profile-info-value">
                {formData.phone || "Not specified"}
              </span>
            </div>
          </div>

          {/* Incomplete Profile Alert Banner */}
          {isIncomplete && (
            <div className="profile-completion-notice">
              <Icon name="alertTriangle" size={16} color="#b45309" style={{ flexShrink: 0 }} />
              <div>
                <strong>Incomplete Profile:</strong> Please specify your age, gender, and phone number
                so your healthcare providers have complete emergency identification.
              </div>
            </div>
          )}
        </aside>

        {/* Right Column: Edit Profile Form */}
        <main className="profile-form-card">
          <div className="profile-section-heading">
            <Icon name="user" size={20} color="#0284c7" />
            <span>Clinical Identification Details</span>
          </div>

          {/* Success Banner */}
          {successMessage && (
            <div className="profile-alert-banner success" role="status">
              <Icon name="checkCircle" size={18} />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="profile-alert-banner error" role="alert">
              <Icon name="alertTriangle" size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} noValidate>
            <div className="profile-form-grid">
              {/* 1. Patient ID (Auto-generated; Read-only) */}
              <div className="form-group">
                <label className="profile-field-label" htmlFor="profile-patient-id">
                  <span>Patient ID</span>
                  <span className="profile-field-hint">Auto-generated</span>
                </label>
                <div className="profile-input-wrapper">
                  <span className="profile-input-icon">
                    <Icon name="lock" size={16} />
                  </span>
                  <input
                    id="profile-patient-id"
                    type="text"
                    className="profile-text-input readonly"
                    value={formData.patientId || "Assigned on save"}
                    readOnly
                    tabIndex={-1}
                    aria-label="Patient ID (Read-only)"
                  />
                  <span className="profile-input-right-badge">Read-only</span>
                </div>
              </div>

              {/* 2. Email (Read-only, fetched from authenticated user) */}
              <div className="form-group">
                <label className="profile-field-label" htmlFor="profile-email">
                  <span>Registered Email</span>
                  <span className="profile-field-hint">Auth account</span>
                </label>
                <div className="profile-input-wrapper">
                  <span className="profile-input-icon">
                    <Icon name="mail" size={16} />
                  </span>
                  <input
                    id="profile-email"
                    type="email"
                    className="profile-text-input readonly"
                    value={userEmail}
                    readOnly
                    tabIndex={-1}
                    aria-label="Email address (Read-only from authentication)"
                  />
                  <span className="profile-input-right-badge">Verified</span>
                </div>
              </div>

              {/* 3. Full Name (Editable) */}
              <div className="form-group-full">
                <label className="profile-field-label" htmlFor="profile-fullname">
                  <span>Full Name</span>
                  <span className="profile-field-hint" style={{ color: "var(--color-primary)" }}>* Required</span>
                </label>
                <div className="profile-input-wrapper">
                  <span className="profile-input-icon">
                    <Icon name="user" size={16} />
                  </span>
                  <input
                    id="profile-fullname"
                    type="text"
                    className="profile-text-input"
                    placeholder="Enter your full legal name"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange("fullName", e.target.value)}
                    required
                  />
                </div>
                {validationErrors.fullName && (
                  <span style={{ fontSize: "0.75rem", color: "var(--status-danger)", marginTop: "4px", display: "block" }}>
                    {validationErrors.fullName}
                  </span>
                )}
              </div>

              {/* 4. Age (Editable) */}
              <div className="form-group">
                <label className="profile-field-label" htmlFor="profile-age">
                  <span>Age (Years)</span>
                </label>
                <div className="profile-input-wrapper">
                  <span className="profile-input-icon">
                    <Icon name="clock" size={16} />
                  </span>
                  <input
                    id="profile-age"
                    type="number"
                    min="1"
                    max="130"
                    className="profile-text-input"
                    placeholder="e.g. 48"
                    value={formData.age}
                    onChange={(e) => handleInputChange("age", e.target.value)}
                  />
                </div>
                {validationErrors.age && (
                  <span style={{ fontSize: "0.75rem", color: "var(--status-danger)", marginTop: "4px", display: "block" }}>
                    {validationErrors.age}
                  </span>
                )}
              </div>

              {/* 5. Gender (Select Dropdown) */}
              <div className="form-group">
                <label className="profile-field-label" htmlFor="profile-gender">
                  <span>Gender</span>
                </label>
                <div className="profile-input-wrapper">
                  <span className="profile-input-icon">
                    <Icon name="user" size={16} />
                  </span>
                  <select
                    id="profile-gender"
                    className="profile-select-input"
                    value={formData.gender}
                    onChange={(e) => handleInputChange("gender", e.target.value)}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              {/* 6. Phone Number (Editable) */}
              <div className="form-group-full">
                <label className="profile-field-label" htmlFor="profile-phone">
                  <span>Primary Contact Phone</span>
                  <span className="profile-field-hint">Mobile or landline</span>
                </label>
                <div className="profile-input-wrapper">
                  <span className="profile-input-icon">
                    <Icon name="phone" size={16} />
                  </span>
                  <input
                    id="profile-phone"
                    type="tel"
                    className="profile-text-input"
                    placeholder="(555) 000-0000"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                  />
                </div>
                {validationErrors.phone && (
                  <span style={{ fontSize: "0.75rem", color: "var(--status-danger)", marginTop: "4px", display: "block" }}>
                    {validationErrors.phone}
                  </span>
                )}
              </div>
            </div>

            {/* Action Row */}
            <div className="profile-action-row">
              <button
                type="submit"
                className="profile-save-btn"
                disabled={isSaving}
              >
                <Icon
                  name={isSaving ? "refresh" : "check"}
                  size={16}
                  className={isSaving ? "spin-icon" : ""}
                />
                <span>{isSaving ? "Saving to Supabase..." : "Save Profile Changes"}</span>
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
