import Icon from "../common/Icons";

/**
 * Medication Schedule Component
 *
 * Lists today's doses ordered by time. Allows the patient or caretaker
 * to mark pending doses as taken.
 */
export default function MedicationSchedule({
  schedule,
  onRecordDose,
  recordingDoseId,
}) {
  const takenCount = schedule.filter((item) => item.status === "taken").length;
  const totalCount = schedule.length;

  return (
    <div className="content-card">
      <div className="card-header">
        <div className="card-header-left">
          <div className="card-header-icon">
            <Icon name="schedule" size={20} color="#0284c7" />
          </div>
          <div>
            <h2 className="card-title">Today's Medication Schedule</h2>
            <p className="card-header-subtitle">
              Adherence progress: {takenCount} of {totalCount} doses completed today
            </p>
          </div>
        </div>

        <span
          className="card-header-badge"
          style={{
            backgroundColor: takenCount === totalCount ? "#ecfdf5" : "#e0f2fe",
            color: takenCount === totalCount ? "#065f46" : "#0369a1",
          }}
        >
        {totalCount === 0
  ? "No Doses Scheduled"
  : takenCount === totalCount
  ? "All Doses Taken"
  : `${totalCount - takenCount} Not Taken`}
        </span>
      </div>

      <div className="schedule-list">
        {schedule.map((item) => {
          const isTaken = item.status === "taken";
const isDueSoon = item.status === "due-soon";
const isUpcoming = item.status === "upcoming";
const isSkipped = item.status === "skipped";
const isMissed = item.status === "missed";
const isRecording = recordingDoseId === item.id;
const canRecord =
  !item.hasRecordedLog &&
  !isTaken &&
  !isSkipped &&
  !isMissed;

          return (
            <div
              key={item.id}
              className={`schedule-item ${isTaken ? "taken" : ""} ${
                isDueSoon ? "due-soon" : ""
              }`}
            >
              <div className="schedule-item-left">
                <div className="schedule-time-box">
                  <span className="time-val">{item.time}</span>
                  <span className="time-period">{item.timePeriod}</span>
                </div>

                <div className="schedule-details">
                  <div className="schedule-med-name">
                    <span>{item.medicineName}</span>
                    <span className="schedule-dose-pill">{item.dosage}</span>
                  </div>
                  <span className="schedule-instruction">{item.instruction}</span>
                  <span className="schedule-doctor">
                    Prescribed for: {item.prescribedFor} • {item.doctor}
                  </span>
                </div>
              </div>

             <div className="schedule-action-zone">
  {isTaken && (
    <span className="status-badge taken">
      <Icon name="check" size={14} color="#065f46" />
      Taken
    </span>
  )}

  {isSkipped && (
    <span className="status-badge upcoming">
      Skipped
    </span>
  )}

  {isMissed && (
    <span
      className="status-badge"
      style={{
        background: "#fee2e2",
        color: "#b91c1c",
      }}
    >
      Missed
    </span>
  )}

  {canRecord && (
    <>
      {isDueSoon && (
        <span className="status-badge due-soon">
          Due
        </span>
      )}

      {isUpcoming && (
        <span className="status-badge upcoming">
          Upcoming
        </span>
      )}

      <button
        type="button"
        className="mark-taken-btn"
        disabled={Boolean(recordingDoseId)}
        onClick={() => onRecordDose(item, "taken")}
      >
        <Icon name="check" size={14} color="#ffffff" />
        {isRecording ? "Saving..." : "Taken"}
      </button>

      <button
        type="button"
        disabled={Boolean(recordingDoseId)}
        onClick={() => onRecordDose(item, "skipped")}
        style={{
          padding: "7px 12px",
          borderRadius: 7,
          border: "1px solid #cbd5e1",
          background: "#f1f5f9",
          color: "#334155",
          cursor: "pointer",
        }}
      >
        Skipped
      </button>
    </>
  )}
</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
