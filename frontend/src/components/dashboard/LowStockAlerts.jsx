import { useState } from "react";
import Icon from "../common/Icons";

/**
 * Low Stock Alerts Component
 * 
 * Flags medications nearing depletion so patients never run out
 * of essential maintenance supplies.
 */
export default function LowStockAlerts({ stockAlerts }) {
  // Local state to track which refills have been requested
  const [requestedRefills, setRequestedRefills] = useState({});

  const handleRequestRefill = (id) => {
    setRequestedRefills((prev) => ({
      ...prev,
      [id]: true,
    }));
  };

  return (
    <div className="content-card">
      <div className="card-header">
        <div className="card-header-left">
          <div className="card-header-icon" style={{ color: "#f59e0b" }}>
            <Icon name="alertTriangle" size={20} />
          </div>
          <div>
            <h2 className="card-title">Low Stock Alerts</h2>
            <p className="card-header-subtitle">
              Medications below recommended 7-day reserve
            </p>
          </div>
        </div>

        <span
          className="card-header-badge"
          style={{
            backgroundColor: "#fffbeb",
            color: "#b45309",
            border: "1px solid #fde68a",
          }}
        >
          {stockAlerts.length} Action Needed
        </span>
      </div>

      <div className="low-stock-list">
        {stockAlerts.map((item) => {
          const isRequested = requestedRefills[item.id];
          // Calculate percentage of safety threshold remaining
          const percent = Math.min(100, Math.round((item.remainingUnits / item.threshold) * 100));

          return (
            <div key={item.id} className="low-stock-item">
              <div className="low-stock-item-header">
                <div>
                  <div className="stock-med-title">
                    <Icon name="pill" size={16} color="#0284c7" />
                    <span>{item.medicineName}</span>
                    <span className="schedule-dose-pill">{item.dosage}</span>
                  </div>
                  <div className="stock-pharmacy-sub">
                    {item.pharmacy}
                  </div>
                </div>

                <div className="stock-count-badge">
                  <span className="remaining-pills">
                    {item.remainingUnits} {item.unitType}
                  </span>
                  <span className="days-left-label">
                    ~{item.daysRemaining} days left
                  </span>
                </div>
              </div>

              {/* Depletion indicator bar */}
              <div className="stock-progress-track" title={`${percent}% of recommended stock`}>
                <div
                  className="stock-progress-fill"
                  style={{ width: `${percent}%` }}
                />
              </div>

              <div className="low-stock-footer">
                <span className="rx-id">Rx: {item.refillRxNumber}</span>
                <button
                  className={`refill-action-btn ${isRequested ? "ordered" : ""}`}
                  onClick={() => handleRequestRefill(item.id)}
                  disabled={isRequested}
                >
                  <Icon
                    name={isRequested ? "check" : "refresh"}
                    size={14}
                    color={isRequested ? "#065f46" : "#0284c7"}
                  />
                  {isRequested ? "Refill Requested" : "Request Refill"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
