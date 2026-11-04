import PatientWelcome from "./PatientWelcome";
import MetricCard from "./MetricCard";
import MedicationSchedule from "./MedicationSchedule";
import LowStockAlerts from "./LowStockAlerts";
import RecentActivity from "./RecentActivity";
import Icon from "../common/Icons";

/**
 * Main Dashboard View Component
 * 
 * NOTE FOR BEGINNERS:
 * This is the parent component for the dashboard screen.
 * It brings together the welcome banner, the 4 top metric cards,
 * today's medication schedule, low stock alerts, and recent activity.
 */
export default function DashboardView({
  metrics,
  schedule,
  stockAlerts,
  activities,
  onMarkTaken,
  currentUser,
}) {
  const takenCount = schedule.filter((item) => item.status === "taken").length;
  const missedCount = schedule.filter((item) => item.status === "missed").length;
  const upcomingCount = schedule.filter(
    (item) => item.status === "due-soon" || item.status === "upcoming"
  ).length;

  return (
    <div className="dashboard-container">
      {/* 1. Welcome Message & Patient Banner */}
      <PatientWelcome currentUser={currentUser} />

      {/* 2. Today's Medication Summary (4 Metric Cards) */}
      <section className="metrics-grid" aria-label="Medication summary metrics">
        {/* Metric 1: Total Active Prescriptions */}
        <MetricCard
          title="Active Prescriptions"
          value={metrics.activePrescriptions}
          tagText="All Verified"
          tagType="blue"
          iconName="prescriptions"
          footerText="5 total maintenance regimens"
        />

        {/* Metric 2: Upcoming Doses Today */}
        <MetricCard
          title="Upcoming Doses Today"
          value={`${upcomingCount} Remaining`}
          tagText={upcomingCount > 0 ? "Next at 7:30 PM" : "Done for Today"}
          tagType="teal"
          iconName="clock"
          footerText="2 doses left to complete"
        />

        {/* Metric 3: Taken & Missed Dose Summary */}
        <MetricCard
          title="Taken & Missed Summary"
          value={`${takenCount} Taken`}
          tagText={missedCount === 0 ? "0 Missed" : `${missedCount} Missed`}
          tagType="green"
          iconName="checkCircle"
          footerText="100% adherence achieved today"
        />

        {/* Metric 4: Low Stock Alerts */}
        <MetricCard
          title="Low Stock Alerts"
          value={`${stockAlerts.length} Needs Refill`}
          tagText="Critical Buffer"
          tagType="amber"
          iconName="alertTriangle"
          footerText="Lisinopril & Atorvastatin low"
        />
      </section>

      {/* 3. Main Dashboard 2-Column Split Layout */}
      <div className="dashboard-split-layout">
        {/* Left Column: Upcoming Medicine Schedule */}
        <div className="dashboard-column">
          <MedicationSchedule schedule={schedule} onMarkTaken={onMarkTaken} />

          {/* Educational Safety Notice */}
          <div className="safety-notice-banner">
            <div className="safety-notice-icon">
              <Icon name="shieldCheck" size={20} />
            </div>
            <div className="safety-notice-text">
              <strong>Patient Safety Reminder:</strong> Always take medications
              as instructed by your physician or pharmacist. Never double up on a
              dose if missed. For dosage questions or unexpected side effects,
              contact your healthcare provider immediately.
            </div>
          </div>
        </div>

        {/* Right Column: Low Stock Alerts & Recent Activity */}
        <div className="dashboard-column">
          <LowStockAlerts stockAlerts={stockAlerts} />
          <RecentActivity activities={activities} />
        </div>
      </div>
    </div>
  );
}
