import PatientWelcome from "./PatientWelcome";
import MetricCard from "./MetricCard";
import MedicationSchedule from "./MedicationSchedule";
import LowStockAlerts from "./LowStockAlerts";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import RecentActivity from "./RecentActivity";
import Icon from "../common/Icons";
export default function DashboardView({
  currentUser,
  dashboardData,
}) {
  const [recordingDoseId, setRecordingDoseId] = useState(null);
const [doseError, setDoseError] = useState("");
const [doseMessage, setDoseMessage] = useState("");
  const {
    metrics,
    schedule,
    stockAlerts,
    activities,
    loading,
    error,
    refreshDashboard,
  } = dashboardData;

  const takenCount = schedule.filter(
    (item) => item.status === "taken"
  ).length;

  const missedCount = schedule.filter(
    (item) => item.status === "missed"
  ).length;

  const upcomingCount = schedule.filter(
    (item) =>
      item.status === "upcoming" ||
      item.status === "due-soon"
  ).length;

  const completedCount = schedule.filter(
    (item) => item.status === "taken"
  ).length;

  const adherence =
    schedule.length > 0
      ? Math.round((completedCount / schedule.length) * 100)
      : 0;
async function handleRecordDose(dose, status) {
  if (recordingDoseId) return;

  if (dose.hasRecordedLog || dose.status === "missed") {
    setDoseError("This dose has already been recorded or missed.");
    return;
  }

  try {
    setRecordingDoseId(dose.id);
    setDoseError("");
    setDoseMessage("");

    const { error } = await supabase.rpc(
      "record_medication_dose",
      {
        p_schedule_id: dose.scheduleId,
        p_scheduled_for: dose.scheduledDate,
        p_status: status,
      }
    );

    if (error) throw error;

    await refreshDashboard();

    setDoseMessage(
      `${dose.medicineName} successfully marked as ${status}.`
    );
  } catch (error) {
    console.error("DOSE RECORDING ERROR:", error);
    setDoseError(
      error.code === "23505"
        ? "This dose has already been recorded."
        : error.message || "Unable to record this dose."
    );
    await refreshDashboard();
  } finally {
    setRecordingDoseId(null);
  }
}
  return (
    <div className="dashboard-container">
      <PatientWelcome
  currentUser={currentUser}
  adherenceRate={
    schedule.length > 0 && !loading && !error
      ? adherence
      : null
  }
/>

      {error && (
        <div
          style={{
            padding: 15,
            background: "#fee2e2",
            color: "#b91c1c",
            borderRadius: 10,
            marginBottom: 20,
          }}
        >
          {error}
          <button
            onClick={refreshDashboard}
            style={{ marginLeft: 12 }}
          >
            Retry
          </button>
        </div>
      )}

      {loading && (
        <p style={{ color: "#64748b" }}>
          Loading your medication dashboard...
        </p>
      )}

      <section
        className="metrics-grid"
        aria-label="Medication summary metrics"
      >
        <MetricCard
          title="Analyzed Prescriptions"
          value={metrics.activePrescriptions}
          tagText="AI Analyzed"
          tagType="blue"
          iconName="prescriptions"
          footerText={`${metrics.totalPrescriptions} total uploaded prescriptions`}
        />

        <MetricCard
          title="Upcoming Doses Today"
          value={`${upcomingCount} Remaining`}
          tagText={
            upcomingCount > 0
              ? "Scheduled Today"
              : "No Upcoming Doses"
          }
          tagType="teal"
          iconName="clock"
          footerText={`${schedule.length} total doses scheduled today`}
        />

        <MetricCard
          title="Taken & Missed Summary"
          value={`${takenCount} Taken`}
          tagText={`${missedCount} Missed`}
          tagType="green"
          iconName="checkCircle"
          footerText={`${adherence}% of today's scheduled doses taken`}
        />

        <MetricCard
          title="Low Stock Alerts"
          value={`${stockAlerts.length} Needs Refill`}
          tagText={
            stockAlerts.length > 0
              ? "Attention Needed"
              : "Stock Healthy"
          }
          tagType="amber"
          iconName="alertTriangle"
          footerText={
            stockAlerts.length > 0
              ? `${stockAlerts.length} medicine(s) need attention`
              : "No low-stock medicines"
          }
        />
      </section>

      <div className="dashboard-split-layout">
        <div className="dashboard-column">
          {doseError && (
  <p
    role="alert"
    style={{
      color: "#b91c1c",
      background: "#fee2e2",
      padding: 12,
      borderRadius: 8,
    }}
  >
    {doseError}
  </p>
)}

{doseMessage && (
  <p
    role="status"
    style={{
      color: "#166534",
      background: "#dcfce7",
      padding: 12,
      borderRadius: 8,
    }}
  >
    {doseMessage}
  </p>
)}
          <MedicationSchedule
  schedule={schedule}
  onRecordDose={handleRecordDose}
  recordingDoseId={recordingDoseId}
/>

          <div className="safety-notice-banner">
            <div className="safety-notice-icon">
              <Icon name="shieldCheck" size={20} />
            </div>

            <div className="safety-notice-text">
              <strong>Patient Safety Reminder:</strong>{" "}
              Follow your healthcare provider's medication
              instructions. If a dose is missed, consult the
              prescribed instructions or your healthcare provider
              before taking another dose.
            </div>
          </div>
        </div>

        <div className="dashboard-column">
          <LowStockAlerts stockAlerts={stockAlerts} />
          <RecentActivity activities={activities} />
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <button
          onClick={refreshDashboard}
          disabled={loading}
          style={{
            padding: "10px 18px",
            background: "#0284c7",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          {loading ? "Refreshing..." : "Refresh Dashboard"}
        </button>
      </div>
    </div>
  );
}