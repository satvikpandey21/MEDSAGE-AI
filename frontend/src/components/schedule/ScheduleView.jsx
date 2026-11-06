import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function ScheduleView() {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [verifiedPrescriptions, setVerifiedPrescriptions] = useState([]);
const [selectedVerifiedSource, setSelectedVerifiedSource] = useState(null);
const [patientConfirmed, setPatientConfirmed] = useState(false);

  const [form, setForm] = useState({
    medicine_name: "",
    dosage: "",
    frequency: "Once daily",
    times: ["09:00"],
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    instructions: "",
  });

  async function loadMedicines() {
    setLoading(true);

    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      setError("Please login again.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("medication_schedules")
      .select("*")
      .eq("patient_id", authData.user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    else setMedicines(data || []);

    setLoading(false);
  }
  async function loadVerifiedPrescriptions() {
  try {
    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      throw new Error("Please login again.");
    }

    const { data: verifications, error: verificationError } =
      await supabase
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

    const prescriptionIds = [
      ...new Set(verifications.map((item) => item.prescription_id)),
    ];

    const { data: prescriptions, error: prescriptionError } =
      await supabase
        .from("patient_prescriptions")
        .select("*")
        .in("id", prescriptionIds);

    if (prescriptionError) throw prescriptionError;

    const combined = verifications.map((verification) => ({
      ...verification,
      prescription: prescriptions.find(
        (item) => item.id === verification.prescription_id
      ),
    }));

    setVerifiedPrescriptions(
      combined.filter((item) => item.prescription?.analysis_result)
    );
  } catch (err) {
    console.error("LOAD VERIFIED PRESCRIPTIONS ERROR:", err);
  }
}

  useEffect(() => {
    loadMedicines();
    loadVerifiedPrescriptions();
  }, []);

  function updateField(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
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
    updateField(
      "times",
      form.times.filter((_, i) => i !== index)
    );
  }

  async function handleSave(event) {
    event.preventDefault();
    setError("");

    if (!form.medicine_name.trim() || !form.dosage.trim()) {
      setError("Medicine name and dosage are required.");
      return;
    }
    if (selectedVerifiedSource && !patientConfirmed) {
  setError("Please review and confirm the medication schedule.");
  return;
}

    if (!form.times.length || form.times.some((time) => !time)) {
      setError("Please select all medicine timings.");
      return;
    }

    setSaving(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Please login again.");
      }

      const { error: insertError } = await supabase
        .from("medication_schedules")
        .insert({
          patient_id: authData.user.id,
          medicine_name: form.medicine_name.trim(),
          dosage: form.dosage.trim(),
          frequency: form.frequency,
          times: form.times,
          start_date: form.start_date,
          end_date: form.end_date || null,
          instructions: form.instructions.trim() || null,
                    instructions: form.instructions.trim() || null,

          // Verified prescription tracking
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
        start_date: new Date().toISOString().split("T")[0],
        end_date: "",
        instructions: "",
      });
            setSelectedVerifiedSource(null);
      setPatientConfirmed(false);

      await loadMedicines();
    } catch (err) {
      setError(err.message || "Could not save medicine.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteMedicine(id) {
    if (!window.confirm("Delete this medication schedule?")) return;

    const { error } = await supabase
      .from("medication_schedules")
      .delete()
      .eq("id", id);

    if (error) setError(error.message);
    else loadMedicines();
  }

  const cardStyle = {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "22px",
    marginBottom: "20px",
  };

  const inputStyle = {
    width: "100%",
    padding: "11px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    marginTop: "6px",
    boxSizing: "border-box",
  };

  return (
    <div style={{ maxWidth: "950px", margin: "0 auto" }}>
      <h2>Medication Schedule</h2>
      <div style={cardStyle}>
  <h3>âœ… Verified Prescription Medicines</h3>

  {verifiedPrescriptions.length === 0 ? (
    <p style={{ color: "#64748b" }}>
      No matched prescriptions available yet.
    </p>
  ) : (
    verifiedPrescriptions.map((verification) => {
      const medicines =
        verification.prescription.analysis_result.medicines || [];

      return (
        <div
          key={verification.id}
          style={{
            border: "1px solid #bbf7d0",
            borderRadius: "9px",
            padding: "14px",
            marginTop: "12px",
          }}
        >
          <strong>
            {verification.prescription.file_name}
          </strong>

          <p style={{ color: "#15803d" }}>
            Verification: MATCHED
          </p>

          {medicines.map((medicine, index) => (
            <div
              key={index}
              style={{
                padding: "10px",
                marginTop: "8px",
                background: "#f8fafc",
                borderRadius: "7px",
              }}
            >
              <strong>{medicine.name || "Name unclear"}</strong>

              <p>
                Strength: {medicine.strength || "Not identified"}
              </p>

              <p>
                Dosage: {medicine.dosage || "Not identified"}
              </p>

              <button
                type="button"
                style={{
                  padding: "8px 12px",
                  background: "#0284c7",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setSelectedVerifiedSource({

                    prescription_id: verification.prescription_id,
                    verification_id: verification.id,
                  });
                  setPatientConfirmed(false);
                  setForm((previous) => ({
                    ...previous,
                    medicine_name: medicine.name || "",
                    dosage: medicine.dosage || "",
                    frequency: "",
                    times: [""],
                    end_date: "",
                    instructions: "",
                  }));
                }}
              >
                Review & Add to Schedule
              </button>
            </div>
          ))}
        </div>
      );
    })
  )}
</div>
      <p style={{ color: "#64748b" }}>
        Manage your medicines and daily medication timings.
      </p>

      <form onSubmit={handleSave} style={cardStyle}>
        <h3>Add New Medicine</h3>

        <label>Medicine Name</label>
        <input
          style={inputStyle}
          value={form.medicine_name}
          onChange={(e) => updateField("medicine_name", e.target.value)}
          placeholder="e.g. Paracetamol"
          required
        />

        <label>Dosage</label>
        <input
          style={inputStyle}
          value={form.dosage}
          onChange={(e) => updateField("dosage", e.target.value)}
          placeholder="e.g. 500 mg"
          required
        />

{selectedVerifiedSource && (
  <label
    style={{
      display: "flex",
      gap: "10px",
      marginTop: "15px",
      alignItems: "center",
    }}
  >
    <input
      type="checkbox"
      checked={patientConfirmed}
      onChange={(e) => setPatientConfirmed(e.target.checked)}
    />
    I have reviewed the prescription details and confirm this schedule.
  </label>
)}
      <label>Frequency</label>

<select
  style={inputStyle}
  value={form.frequency}
  onChange={(e) => updateField("frequency", e.target.value)}
  required
>
  <option value="">Select frequency (check prescription)</option>
  <option value="Once daily">Once daily</option>
  <option value="Twice daily">Twice daily</option>
  <option value="Three times daily">Three times daily</option>
  <option value="Four times daily">Four times daily</option>
  <option value="As needed">As needed</option>
</select>

        <label>Medicine Timings</label>

        {form.times.map((time, index) => (
          <div
            key={index}
            style={{ display: "flex", gap: "10px", marginTop: "8px" }}
          >
            <input
              type="time"
              style={inputStyle}
              value={time}
              onChange={(e) => updateTime(index, e.target.value)}
              required
            />

            <button type="button" onClick={() => removeTime(index)}>
              Remove
            </button>
          </div>
        ))}

        <button type="button" onClick={addTime} style={{ marginTop: "10px" }}>
          + Add another time
        </button>

        <label style={{ display: "block", marginTop: "15px" }}>
          Start Date
        </label>
        <input
          type="date"
          style={inputStyle}
          value={form.start_date}
          onChange={(e) => updateField("start_date", e.target.value)}
          required
        />

        <label style={{ display: "block", marginTop: "15px" }}>
          End Date (Optional)
        </label>
        <input
          type="date"
          style={inputStyle}
          value={form.end_date}
          min={form.start_date}
          onChange={(e) => updateField("end_date", e.target.value)}
        />

        <label style={{ display: "block", marginTop: "15px" }}>
          Instructions (Optional)
        </label>
        <textarea
          style={inputStyle}
          value={form.instructions}
          onChange={(e) => updateField("instructions", e.target.value)}
          placeholder="e.g. Take after food"
          rows="3"
        />

        {error && <p style={{ color: "#dc2626" }}>{error}</p>}

        <button
          type="submit"
          disabled={saving}
          style={{
            marginTop: "18px",
            padding: "12px 22px",
            background: "#0284c7",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          {saving ? "Saving..." : "Save Medication"}
        </button>
      </form>

      <div style={cardStyle}>
        <h3>Active Medication Schedules</h3>

        {loading ? (
          <p>Loading medicines...</p>
        ) : medicines.length === 0 ? (
          <p style={{ color: "#64748b" }}>No medicines added yet.</p>
        ) : (
          medicines.map((medicine) => (
            <div
              key={medicine.id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "9px",
                padding: "15px",
                marginTop: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{medicine.medicine_name}</strong>
                <button onClick={() => deleteMedicine(medicine.id)}>
                  Delete
                </button>
              </div>

              <p>Dosage: {medicine.dosage}</p>
              <p>Frequency: {medicine.frequency}</p>
              <p>Timings: {medicine.times?.join(", ")}</p>
              <p>Start: {medicine.start_date}</p>
              {medicine.end_date && <p>End: {medicine.end_date}</p>}
              {medicine.instructions && <p>{medicine.instructions}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}