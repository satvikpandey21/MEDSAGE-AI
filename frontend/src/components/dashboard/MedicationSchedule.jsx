import Icon from "../common/Icons";

/**
 * Medication Schedule Component
 * 
 * Lists today's doses ordered by time. Allows the patient or caretaker
 * to mark pending doses as taken.
 */
export default function MedicationSchedule({ schedule, onMarkTaken }) {
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
          {takenCount === totalCount ? "All Doses Taken" : `${totalCount - takenCount} Remaining`}
        </span>
      </div>

      <div className="schedule-list">
        {schedule.map((item) => {
          const isTaken = item.status === "taken";
          const isDueSoon = item.status === "due-soon";

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

                {isDueSoon && (
                  <>
                    <span className="status-badge due-soon">
                      <Icon name="clock" size={14} color="#92400e" />
                      Due Soon
                    </span>
                    <button
                      className="mark-taken-btn"
                      onClick={() => onMarkTaken(item.id)}
                      title="Log this dose as completed"
                    >
                      <Icon name="check" size={14} color="#ffffff" />
                      Mark Taken
                    </button>
                  </>
                )}

                {item.status === "upcoming" && (
                  <span className="status-badge upcoming">
                    <Icon name="clock" size={14} color="#64748b" />
                    Upcoming
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
