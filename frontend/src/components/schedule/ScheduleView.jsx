import { validateMedication } from "../../lib/medicationValidation";
import { updateStockSafely } from "../../lib/updateStockSafely";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export default function ScheduleView() {
  const [medicines, setMedicines] = useState([]);
  const [doseLogs, setDoseLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [patientId, setPatientId] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported"
  );
  const [verifiedPrescriptions, setVerifiedPrescriptions] = useState([]);
  const [selectedVerifiedSource, setSelectedVerifiedSource] = useState(null);
  const [patientConfirmed, setPatientConfirmed] = useState(false);
  const [stockDrafts, setStockDrafts] = useState({});

  const [form, setForm] = useState({
    medicine_name: "",
    dosage: "",
    frequency: "Once daily",
    times: ["09:00"],
    start_date: todayKey(),
    end_date: "",
    instructions: "",
    stock_quantity: "",
    low_stock_threshold: "5",
    stock_unit: "tablets",
  });

  const loadMedicines = useCallback(async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error("Please login again.");
    setPatientId(authData.user.id);

    const { data, error: queryError } = await supabase
      .from("medication_schedules")
      .select("*")
      .eq("patient_id", authData.user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (queryError) throw queryError;
    setMedicines(data || []);
    return authData.user.id;
  }, []);

  const loadDoseLogs = useCallback(async (userId = patientId) => {
    if (!userId) return;
    const from = new Date();
    from.setDate(from.getDate() - 7);
    from.setHours(0, 0, 0, 0);

    const { data, error: queryError } = await supabase
      .from("medication_dose_logs")
      .select("*")
      .eq("patient_id", userId)
      .gte("scheduled_for", from.toISOString())
      .order("scheduled_for", { ascending: false })
      .limit(150);

    if (queryError) throw queryError;
    setDoseLogs(data || []);
  }, [patientId]);

  async function loadVerifiedPrescriptions() {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Please login again.");

      const { data: verifications, error: verificationError } = await supabase
        .from("prescription_bill_verifications")
        .select("*")
        .eq("patient_id", authData.user.id)
        .eq("status", "matched")
        .order("created_at", { ascending: false });
      if (verificationError) throw verificationError;

      if (!verifications?.length) {
        setVerifiedPrescriptions([]);
        return;
      }

      const prescriptionIds = [...new Set(verifications.map((item) => item.prescription_id))];
      const { data: prescriptions, error: prescriptionError } = await supabase
        .from("patient_prescriptions")
        .select("*")
        .in("id", prescriptionIds);
      if (prescriptionError) throw prescriptionError;

      const combined = verifications.map((verification) => ({
        ...verification,
        prescription: prescriptions.find((item) => item.id === verification.prescription_id),
      }));
      setVerifiedPrescriptions(combined.filter((item) => item.prescription?.analysis_result &&
        !item.prescription.ocr_review_required &&
        item.prescription.analysis_status !== "pending_review" &&
        item.prescription.analysis_result.analysis_status !== "pending_review" &&
        item.prescription.analysis_result.extraction_source !== "paddleocr"));
    } catch (err) {
      console.error("LOAD VERIFIED PRESCRIPTIONS ERROR:", err);
    }
  }

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const userId = await loadMedicines();
      await loadDoseLogs(userId);
    } catch (err) {
      setError(err.message || "Could not load medication data.");
    } finally {
      setLoading(false);
    }
  }, [loadMedicines, loadDoseLogs]);

  useEffect(() => {
    refreshAll();
    loadVerifiedPrescriptions();
    const timer = window.setInterval(() => {
      loadMedicines().then((id) => loadDoseLogs(id)).catch(() => {});
    }, 30000);
    return () => window.clearInterval(timer);
  }, [refreshAll, loadMedicines, loadDoseLogs]);

  const lowStockMedicines = useMemo(
    () => medicines.filter((medicine) =>
      medicine.stock_quantity !== null &&
      medicine.stock_quantity !== undefined &&
      Number(medicine.stock_quantity) <= Number(medicine.low_stock_threshold ?? 5)
    ),
    [medicines]
  );

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") setMessage("Dose reminders enabled on this browser.");
  }

  function updateField(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
    setFieldErrors((previous) => ({ ...previous, [field]: "" }));
  }

  function updateTime(index, value) {
    const updated = [...form.times];
    updated[index] = value;
    updateField("times", updated);
  }

  function addTime() {
    updateField("times", [...form.times, "18:00"]);
  }

  function removeTime(index) {
    if (form.times.length === 1) return;
    updateField("times", form.times.filter((_, i) => i !== index));
  }

  async function handleSave(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const validation = validateMedication(form.medicine_name, form.dosage);
    setFieldErrors(validation.errors);
    if (Object.keys(validation.errors).length) return;
    if (selectedVerifiedSource && !patientConfirmed) {
      setError("Please review and confirm the medication schedule.");
      return;
    }
    if (!event.currentTarget.reportValidity()) return;
    if (!form.frequency) {
      setError("Please select the medicine frequency.");
      return;
    }
    if (!form.times.length || form.times.some((time) => !time)) {
      setError("Please select all medicine timings.");
      return;
    }
    if (form.stock_quantity !== "" && (!Number.isFinite(Number(form.stock_quantity)) || Number(form.stock_quantity) < 0)) {
      setError("Enter a valid non-negative stock quantity.");
      return;
    }
    if (!Number.isFinite(Number(form.low_stock_threshold)) || Number(form.low_stock_threshold) < 0) {
      setError("Enter a valid low-stock threshold.");
      return;
    }

    setSaving(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Please login again.");

      const { error: insertError } = await supabase.from("medication_schedules").insert({
        patient_id: authData.user.id,
        medicine_name: validation.name,
        dosage: validation.dosage,
        frequency: form.frequency,
        times: form.times,
        start_date: form.start_date,
        end_date: form.end_date || null,
        instructions: form.instructions.trim() || null,
        stock_quantity: form.stock_quantity === "" ? null : Number(form.stock_quantity),
        low_stock_threshold: Number(form.low_stock_threshold),
        stock_unit: form.stock_unit,
        prescription_id: selectedVerifiedSource?.prescription_id || null,
        verification_id: selectedVerifiedSource?.verification_id || null,
        patient_confirmed: selectedVerifiedSource ? patientConfirmed : false,
      });
      if (insertError) throw insertError;

      setForm({
        medicine_name: "",
        dosage: "",
        frequency: "Once daily",
        times: ["09:00"],
        start_date: todayKey(),
        end_date: "",
        instructions: "",
        stock_quantity: "",
        low_stock_threshold: "5",
        stock_unit: "tablets",
      });
      setSelectedVerifiedSource(null);
      setPatientConfirmed(false);
      setMessage("Medication schedule saved successfully.");
      await refreshAll();
    } catch (err) {
      setError(err.message || "Could not save medicine.");
    } finally {
      setSaving(false);
    }
  }

  async function recordDose(dose, status) {
    if (!patientId) return;
    setActionLoading(`${dose.medicine.id}-${dose.scheduledDate.getTime()}`);
    setError("");
    setMessage("");

    try {
      const { error: recordError } = await supabase.rpc("record_medication_dose", {
        p_schedule_id: dose.medicine.id,
        p_scheduled_for: dose.scheduledDate.toISOString(),
        p_status: status,
      });
      if (recordError) {
        if (recordError.code === "23505") throw new Error("This dose has already been recorded.");
        throw recordError;
      }
      setMessage(`Dose marked ${status}.`);

      await refreshAll();
    } catch (err) {
      setError(err.message || "Could not record this dose.");
    } finally {
      setActionLoading("");
    }
  }

  async function updateStock(medicine) {
    const value = stockDrafts[medicine.id] ?? String(medicine.stock_quantity ?? "");
    if (value.trim() === "" || !Number.isFinite(Number(value)) || Number(value) < 0) {
      setError("Enter a valid stock quantity.");
      return;
    }
    try {
      await updateStockSafely(supabase, medicine, patientId, { stock_quantity: Number(value) });
      setMessage(`${medicine.medicine_name} stock updated.`);
      setStockDrafts((previous) => ({ ...previous, [medicine.id]: "" }));
      await refreshAll();
    } catch (err) { setError(err.message); }
  }

  async function deleteMedicine(id) {
    if (!window.confirm("Delete this medication schedule and its dose history?")) return;
    const { error: deleteError } = await supabase
      .from("medication_schedules")
      .delete()
      .eq("id", id)
      .eq("patient_id", patientId);
    if (deleteError) setError(deleteError.message);
    else await refreshAll();
  }

  const cardStyle = {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "22px",
    marginBottom: "20px",
    color: "#1e293b",
  };

  const inputStyle = {
    width: "100%",
    padding: "11px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    marginTop: "6px",
    marginBottom: "12px",
    boxSizing: "border-box",
  };

  const buttonStyle = {
    padding: "9px 13px",
    border: "none",
    borderRadius: "7px",
    cursor: "pointer",
    marginRight: "7px",
    marginTop: "6px",
  };

  return (
    <div style={{ maxWidth: "950px", margin: "0 auto", color: "#1e293b" }}>
      <h2>Medication Management</h2>
      <p style={{ color: "#64748b" }}>Manage schedules, dose reminders, dose history and medicine stock.</p>

      <div style={cardStyle}>
        <h3>⏰ Dose Reminders</h3>
        <p style={{ color: "#64748b" }}>Browser reminders work while MedSage AI is open in this browser.</p>
        <button type="button" style={{ ...buttonStyle, background: "#0284c7", color: "white" }} onClick={enableNotifications}>
          {notificationPermission === "granted" ? "Notifications Enabled ✓" : "Enable Browser Notifications"}
        </button>
        <span style={{ fontSize: "13px", color: "#64748b" }}>
          {notificationPermission === "denied" ? "Permission blocked. Allow notifications in browser site settings." :
            notificationPermission === "unsupported" ? "This browser does not support notifications." :
              notificationPermission === "granted" ? "You will receive dose alerts while MedSage AI is open." : "Permission not enabled yet."}
        </span>
       
      </div>

      <div style={cardStyle}>
        <h3>⚠️ Medication Stock Alerts</h3>
        {lowStockMedicines.length === 0 ? <p style={{ color: "#15803d" }}>No low-stock alerts. Medicines without a stock count are not included.</p> : lowStockMedicines.map((medicine) => (
          <div key={medicine.id} style={{ padding: "12px", marginTop: "9px", borderRadius: "8px", background: Number(medicine.stock_quantity) <= 0 ? "#fee2e2" : "#fef3c7", border: "1px solid #f59e0b" }}>
            <strong>{medicine.medicine_name}</strong>
            <p style={{ margin: "6px 0" }}>{Number(medicine.stock_quantity) <= 0 ? "🚨 OUT OF STOCK" : "⚠️ LOW STOCK"}</p>
            <p>Remaining: {medicine.stock_quantity} {medicine.stock_unit || "units"} · Alert limit: {medicine.low_stock_threshold}</p>
          </div>
        ))}
      </div>

      <div style={cardStyle}>
        <h3>📋 Recent Dose History</h3>
        {doseLogs.length === 0 ? <p>No dose history recorded yet.</p> : doseLogs.slice(0, 30).map((log) => {
          const medicine = medicines.find((item) => item.id === log.schedule_id);
          return (
            <div key={log.id} style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", borderBottom: "1px solid #e2e8f0", padding: "9px 0" }}>
              <span>{medicine?.medicine_name || "Medicine"} · {new Date(log.scheduled_for).toLocaleString()}</span>
              <strong style={{ color: log.status === "taken" ? "#15803d" : log.status === "missed" ? "#dc2626" : "#64748b" }}>{log.status.toUpperCase()}</strong>
            </div>
          );
        })}
      </div>

      <div style={cardStyle}>
        <h3>✅ Verified Prescription Medicines</h3>
        {verifiedPrescriptions.length === 0 ? <p style={{ color: "#64748b" }}>No matched prescriptions available yet.</p> : verifiedPrescriptions.map((verification) => {
          const prescriptionMedicines = verification.prescription.analysis_result.medicines || [];
          return (
            <div key={verification.id} style={{ border: "1px solid #bbf7d0", borderRadius: "9px", padding: "14px", marginTop: "12px" }}>
              <strong>{verification.prescription.file_name}</strong>
              <p style={{ color: "#15803d" }}>Verification: MATCHED</p>
              {prescriptionMedicines.map((medicine, index) => (
                <div key={index} style={{ padding: "10px", marginTop: "8px", background: "#f8fafc", borderRadius: "7px" }}>
                  <strong>{medicine.name || "Name unclear"}</strong>
                  <p>Strength: {medicine.strength || "Not identified"}</p>
                  <p>Dosage: {medicine.dosage || "Not identified"}</p>
                  <button type="button" style={{ ...buttonStyle, background: "#0284c7", color: "white" }} onClick={() => {
                    setSelectedVerifiedSource({ prescription_id: verification.prescription_id, verification_id: verification.id });
                    setPatientConfirmed(false);
                    setForm((previous) => ({ ...previous, medicine_name: medicine.name || "", dosage: medicine.dosage || "", frequency: "", times: [""], end_date: "", instructions: "" }));
                  }}>Review & Add to Schedule</button>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <form noValidate onSubmit={handleSave} style={cardStyle}>
        <h3>Add New Medicine</h3>
        <label htmlFor="schedule-medicine-name">Medicine Name</label>
        <input id="schedule-medicine-name" aria-invalid={Boolean(fieldErrors.medicine_name)} aria-describedby="medicine-name-error" style={inputStyle} value={form.medicine_name} onChange={(e) => updateField("medicine_name", e.target.value)} placeholder="e.g. Paracetamol" required />
        {fieldErrors.medicine_name && <p id="medicine-name-error" role="alert" style={{ color: "#dc2626" }}>{fieldErrors.medicine_name}</p>}
        <label htmlFor="schedule-dosage">Dosage</label>
        <input id="schedule-dosage" aria-invalid={Boolean(fieldErrors.dosage)} aria-describedby="dosage-error" style={inputStyle} value={form.dosage} onChange={(e) => updateField("dosage", e.target.value)} placeholder="e.g. 500 mg" required />

        {fieldErrors.dosage && <p id="dosage-error" role="alert" style={{ color: "#dc2626" }}>{fieldErrors.dosage}</p>}
        <label>Available Stock (optional)</label>
        <input type="number" min="0" step="0.01" style={inputStyle} value={form.stock_quantity} onChange={(e) => updateField("stock_quantity", e.target.value)} placeholder="e.g. 30" />
        <label>Stock Unit</label>
        <select style={inputStyle} value={form.stock_unit} onChange={(e) => updateField("stock_unit", e.target.value)}>
          <option value="tablets">Tablets</option><option value="capsules">Capsules</option><option value="ml">ML</option><option value="units">Units</option>
        </select>
        <label>Low Stock Alert Limit</label>
        <input type="number" min="0" step="0.01" style={inputStyle} value={form.low_stock_threshold} onChange={(e) => updateField("low_stock_threshold", e.target.value)} required />

        {selectedVerifiedSource && <label style={{ display: "flex", gap: "10px", marginTop: "10px", alignItems: "center" }}>
          <input type="checkbox" checked={patientConfirmed} onChange={(e) => setPatientConfirmed(e.target.checked)} />
          I have reviewed the prescription details and confirm this schedule.
        </label>}

        <label>Frequency</label>
        <select style={inputStyle} value={form.frequency} onChange={(e) => updateField("frequency", e.target.value)} required>
          <option value="">Select frequency (check prescription)</option><option value="Once daily">Once daily</option><option value="Twice daily">Twice daily</option><option value="Three times daily">Three times daily</option><option value="Four times daily">Four times daily</option><option value="As needed">As needed</option>
        </select>

        <label>Medicine Timings</label>
        {form.times.map((time, index) => <div key={index} style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
          <input type="time" style={inputStyle} value={time} onChange={(e) => updateTime(index, e.target.value)} required />
          <button type="button" onClick={() => removeTime(index)}>Remove</button>
        </div>)}
        <button type="button" onClick={addTime} style={{ ...buttonStyle, background: "#e2e8f0" }}>+ Add another time</button>

        <label style={{ display: "block", marginTop: "12px" }}>Start Date</label>
        <input type="date" style={inputStyle} value={form.start_date} onChange={(e) => updateField("start_date", e.target.value)} required />
        <label>End Date (Optional)</label>
        <input type="date" style={inputStyle} value={form.end_date} min={form.start_date} onChange={(e) => updateField("end_date", e.target.value)} />
        <label>Instructions (Optional)</label>
        <textarea style={inputStyle} value={form.instructions} onChange={(e) => updateField("instructions", e.target.value)} placeholder="e.g. Take after food" rows="3" />

        {error && <p style={{ color: "#dc2626", whiteSpace: "pre-wrap" }}>{error}</p>}
        {message && <p style={{ color: "#15803d", whiteSpace: "pre-wrap" }}>{message}</p>}
        <button type="submit" disabled={saving} style={{ ...buttonStyle, marginTop: "10px", padding: "12px 22px", background: "#0284c7", color: "white" }}>{saving ? "Saving..." : "Save Medication"}</button>
      </form>

      <div style={cardStyle}>
        <h3>Active Medication Schedules</h3>
        {loading ? <p>Loading medicines...</p> : medicines.length === 0 ? <p style={{ color: "#64748b" }}>No medicines added yet.</p> : medicines.map((medicine) => (
          <div key={medicine.id} style={{ border: "1px solid #e2e8f0", borderRadius: "9px", padding: "15px", marginTop: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
              <strong>{medicine.medicine_name}</strong>
              <button type="button" onClick={() => deleteMedicine(medicine.id)}>Delete</button>
            </div>
            <p>Dosage: {medicine.dosage}</p>
            <p>Frequency: {medicine.frequency}</p>
            <p>Timings: {medicine.times?.join(", ")}</p>
            <p>Stock: {medicine.stock_quantity === null || medicine.stock_quantity === undefined ? "Not added" : `${medicine.stock_quantity} ${medicine.stock_unit || "units"}`}</p>
            <p>Low-stock limit: {medicine.low_stock_threshold}</p>
            {medicine.instructions && <p>Instructions: {medicine.instructions}</p>}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
              <input type="number" min="0" step="0.01" placeholder="New stock quantity" style={{ ...inputStyle, maxWidth: "220px", margin: 0 }} value={stockDrafts[medicine.id] ?? ""} onChange={(e) => setStockDrafts((previous) => ({ ...previous, [medicine.id]: e.target.value }))} />
              <button type="button" onClick={() => updateStock(medicine)}>Update Stock</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
