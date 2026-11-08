import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function getTodayKey() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function getScheduledDate(dateKey, time) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);

  return new Date(year, month - 1, day, hours, minutes);
}

function getTimePeriod(hour) {
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  if (hour < 21) return "Evening";
  return "Night";
}

function formatActivityTime(date) {
  return new Date(date).toLocaleString();
}

export default function useDashboardData(enabled = true) {
  const [schedule, setSchedule] = useState([]);
  const [stockAlerts, setStockAlerts] = useState([]);
  const [activities, setActivities] = useState([]);

  const [metrics, setMetrics] = useState({
    totalPrescriptions: 0,
    activePrescriptions: 0,
    upcomingDosesToday: 0,
    dosesTakenToday: 0,
    dosesMissedToday: 0,
    totalDosesToday: 0,
    lowStockItemsCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Please log in again.");
      }

      const userId = authData.user.id;

      const [
        medicinesResult,
        logsResult,
        prescriptionsResult,
      ] = await Promise.all([
        supabase
          .from("medication_schedules")
          .select("*")
          .eq("patient_id", userId)
          .eq("is_active", true),

        supabase
          .from("medication_dose_logs")
          .select("*")
          .eq("patient_id", userId)
          .order("scheduled_for", { ascending: false })
          .limit(500),

        supabase
          .from("patient_prescriptions")
          .select("id,file_name,created_at,analysis_status")
          .eq("patient_id", userId)
          .order("created_at", { ascending: false }),
      ]);

      if (medicinesResult.error) {
        throw medicinesResult.error;
      }

      if (logsResult.error) {
        throw logsResult.error;
      }

      if (prescriptionsResult.error) {
        throw prescriptionsResult.error;
      }

      const medicines = medicinesResult.data || [];
      const logs = logsResult.data || [];
      const prescriptions = prescriptionsResult.data || [];

      const today = getTodayKey();
      const now = new Date();

      // Generate today's real medication schedule
      const todaySchedule = medicines.flatMap((medicine) => {
        if (medicine.frequency === "As needed") return [];

        if (medicine.start_date && medicine.start_date > today) {
          return [];
        }

        if (medicine.end_date && medicine.end_date < today) {
          return [];
        }

        return (medicine.times || [])
          .filter((time) => /^\d{2}:\d{2}$/.test(time))
          .map((time) => {
            const scheduledDate = getScheduledDate(today, time);

            const existingLog = logs.find(
              (log) =>
                log.schedule_id === medicine.id &&
                new Date(log.scheduled_for).getTime() ===
                  scheduledDate.getTime()
            );

            const minutesUntil =
              (scheduledDate.getTime() - now.getTime()) / 60000;

            let status = existingLog?.status || "upcoming";

            if (!existingLog && minutesUntil < -30) {
              status = "missed";
            } else if (!existingLog && minutesUntil <= 0) {
              status = "due-soon";
            }

            return {
              id: `${medicine.id}-${scheduledDate.getTime()}`,
              scheduleId: medicine.id,
              scheduledDate: scheduledDate.toISOString(),
              time: scheduledDate.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              timePeriod: getTimePeriod(scheduledDate.getHours()),
              medicineName: medicine.medicine_name,
              dosage: medicine.dosage,
              instruction: medicine.instructions || "",
              status,
              stockQuantity: medicine.stock_quantity,
              stockUnit: medicine.stock_unit,
              hasRecordedLog: Boolean(existingLog),
            };
          });
      });

      todaySchedule.sort(
        (a, b) =>
          new Date(a.scheduledDate) - new Date(b.scheduledDate)
      );

      setSchedule(todaySchedule);

      // Actual low-stock medicines
      const lowStock = medicines
        .filter(
          (medicine) =>
            medicine.stock_quantity !== null &&
            medicine.stock_quantity !== undefined &&
            Number(medicine.stock_quantity) <=
              Number(medicine.low_stock_threshold ?? 5)
        )
        .map((medicine) => ({
          id: medicine.id,
          medicineName: medicine.medicine_name,
          dosage: medicine.dosage,
          remainingUnits: Number(medicine.stock_quantity),
          unitType: medicine.stock_unit || "units",
          threshold: Number(medicine.low_stock_threshold ?? 5),
          isOutOfStock: Number(medicine.stock_quantity) <= 0,
        }));

      setStockAlerts(lowStock);

      // Real recent activity
      const doseActivities = logs.slice(0, 20).map((log) => {
        const medicine = medicines.find(
          (item) => item.id === log.schedule_id
        );

        return {
          id: `dose-${log.id}`,
          type: log.status === "taken" ? "dose_taken" : "dose_status",
          title: `Dose ${log.status}`,
          description: `${medicine?.medicine_name || "Medication"} — ${log.status}`,
          timeAgo: formatActivityTime(log.recorded_at || log.created_at),
          badgeType:
            log.status === "taken"
              ? "success"
              : log.status === "missed"
              ? "warning"
              : "neutral",
          timestamp: log.recorded_at || log.created_at,
        };
      });

      const prescriptionActivities = prescriptions
        .slice(0, 10)
        .map((prescription) => ({
          id: `prescription-${prescription.id}`,
          type: "prescription_renewed",
          title: "Prescription Uploaded",
          description: prescription.file_name || "Prescription",
          timeAgo: formatActivityTime(prescription.created_at),
          badgeType: "info",
          timestamp: prescription.created_at,
        }));

      const recentActivities = [
        ...doseActivities,
        ...prescriptionActivities,
      ]
        .sort(
          (a, b) =>
            new Date(b.timestamp) - new Date(a.timestamp)
        )
        .slice(0, 10);

      setActivities(recentActivities);

      // Real dashboard metrics
      const taken = todaySchedule.filter(
        (dose) => dose.status === "taken"
      ).length;

      const missed = todaySchedule.filter(
        (dose) => dose.status === "missed"
      ).length;

      const upcoming = todaySchedule.filter(
        (dose) =>
          dose.status === "upcoming" ||
          dose.status === "due-soon"
      ).length;

      setMetrics({
        totalPrescriptions: prescriptions.length,
        activePrescriptions: prescriptions.filter(
          (prescription) =>
            prescription.analysis_status === "analyzed"
        ).length,
        upcomingDosesToday: upcoming,
        dosesTakenToday: taken,
        dosesMissedToday: missed,
        totalDosesToday: todaySchedule.length,
        lowStockItemsCount: lowStock.length,
      });
    } catch (err) {
      console.error("DASHBOARD LOAD ERROR:", err);
      setError(err.message || "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
  if (!enabled) {
    setSchedule([]);
    setStockAlerts([]);
    setActivities([]);
    setError("");
    return;
  }

  loadDashboard();

  const interval = setInterval(loadDashboard, 60000);

  return () => clearInterval(interval);
}, [enabled, loadDashboard]);

  return {
    schedule,
    stockAlerts,
    activities,
    metrics,
    loading,
    error,
    refreshDashboard: loadDashboard,
  };
}