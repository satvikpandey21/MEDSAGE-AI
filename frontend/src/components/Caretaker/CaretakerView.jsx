import { useEffect, useState } from "react";
import CaretakerMedicineEditor from "./CaretakerMedicineEditor";
import { supabase } from "../../lib/supabase";

function ApprovedCaretakers() {
  const [caretakers, setCaretakers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        // The RPC derives the patient from auth.uid(); no client-supplied IDs.
        const { data, error: rpcError } = await supabase.rpc(
          "get_my_approved_caretakers"
        );
        if (rpcError) throw rpcError;
        if (active) setCaretakers(data || []);
      } catch {
        if (active) setError("Unable to load approved caretakers. Please try refreshing.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, []);

  return (
    <section style={styles.card} aria-labelledby="approved-caretakers-heading">
      <h3 id="approved-caretakers-heading">Approved Caretakers</h3>
      {loading ? <p role="status">Loading approved caretakers...</p> : error ? (
        <p role="alert" style={styles.error}>{error}</p>
      ) : caretakers.length === 0 ? (
        <p>No approved caretaker connections yet.</p>
      ) : caretakers.map((caretaker) => {
        const date = caretaker.connection_date
          ? new Date(caretaker.connection_date)
          : null;
        return (
          <div key={caretaker.link_id} style={{ ...styles.patientBox, overflowWrap: "anywhere" }}>
            <h4>{caretaker.full_name?.trim() || "Name not available"}</h4>
            <p>Contact number: {caretaker.phone?.trim() || "Not available"}</p>
            <p>Status: Approved</p>
            <p>
              {caretaker.date_source === "approved_at" ? "Approved on" : "Connection created"}:{" "}
              {date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : "Not available"}
            </p>
          </div>
        );
      })}
    </section>
  );
}

export default function CaretakerView({ currentUser }) {
  const userId = currentUser?.rawId || currentUser?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [invite, setInvite] = useState(null);
  const [inviteCode, setInviteCode] = useState("");

  const [requests, setRequests] = useState([]);
  const [linkedPatients, setLinkedPatients] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [doseLogs, setDoseLogs] = useState([]);

  useEffect(() => {
    if (!userId) return;
    loadCaretakerData();
    const refresh = () => loadCaretakerData({ background: true });
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [userId]);

  async function loadCaretakerData({ background = false } = {}) {
    try {
      if (!background) setLoading(true);
      setError("");

      // Patient's pending requests
      const { data: pending, error: pendingError } = await supabase
        .from("caretaker_links")
        .select("*")
        .eq("patient_id", userId)
        .eq("status", "pending");

      if (pendingError) throw pendingError;
      setRequests(pending || []);

      // Approved patients linked to this caretaker
      const { data: links, error: linksError } = await supabase
        .from("caretaker_links")
        .select("*")
        .eq("caretaker_id", userId)
        .eq("status", "approved");

      if (linksError) throw linksError;

      const patientIds = (links || []).map((link) => link.patient_id);

      if (patientIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from("patient_profiles")
          .select("*")
          .in("id", patientIds);

        if (profileError) throw profileError;
        setLinkedPatients(profiles || []);

        const { data: schedules, error: scheduleError } = await supabase
          .from("medication_schedules")
          .select("*")
          .in("patient_id", patientIds)
          .eq("is_active", true);

        if (scheduleError) throw scheduleError;
        setMedicines(schedules || []);

        const { data: logs, error: logsError } = await supabase
          .from("medication_dose_logs")
          .select("*")
          .in("patient_id", patientIds)
          .order("scheduled_for", { ascending: false })
          .limit(50);

        if (logsError) throw logsError;
        setDoseLogs(logs || []);
      } else {
        setLinkedPatients([]);
        setMedicines([]);
        setDoseLogs([]);
      }
    } catch (err) {
      setMedicines([]);
      setError(err.message || "Unable to load caretaker data.");
    } finally {
      if (!background) setLoading(false);
    }
  }

  async function generateInvite() {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      const { data, error } = await supabase.rpc(
        "create_caretaker_invite"
      );

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;

      setInvite(result);
      setMessage("Invitation code generated successfully!");
    } catch (err) {
      setError(err.message || "Could not generate invitation.");
    } finally {
      setSaving(false);
    }
  }

  async function redeemInvite() {
    if (!inviteCode.trim()) {
      setError("Please enter an invitation code.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const { error } = await supabase.rpc(
        "redeem_caretaker_invite",
        { p_code: inviteCode.trim() }
      );

      if (error) throw error;

      setInviteCode("");
      setMessage("Request sent! Waiting for patient approval.");
      await loadCaretakerData();
    } catch (err) {
      setError(err.message || "Invalid invitation code.");
    } finally {
      setSaving(false);
    }
  }

  async function respondToRequest(linkId, approve) {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      const { error } = await supabase.rpc(
        "respond_to_caretaker_request",
        {
          p_link_id: linkId,
          p_approve: approve,
        }
      );

      if (error) throw error;

      setMessage(
        approve
          ? "Caretaker request approved!"
          : "Caretaker request rejected."
      );

      await loadCaretakerData();
    } catch (err) {
      setError(err.message || "Unable to process request.");
    } finally {
      setSaving(false);
    }
  }

  if (!userId) {
    return <p>Please log in to access Caretaker.</p>;
  }

  if (loading) {
    return <div style={styles.container}>Loading caretaker dashboard...</div>;
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>👨‍👩‍👧 Caretaker Dashboard</h2>

      <p style={styles.subtitle}>
        Connect with your family members and help them manage their medicines.
      </p>

      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={styles.success}>{message}</div>}

      {/* PATIENT SECTION */}
      <section style={styles.card}>
        <h3>🔐 Invite a Caretaker</h3>

        <p>
          Generate a one-time invitation code and share it with your caretaker.
          The code expires after 24 hours.
        </p>

        <button
          style={styles.button}
          onClick={generateInvite}
          disabled={saving}
        >
          {saving ? "Please wait..." : "Generate Invitation Code"}
        </button>

        {invite && (
          <div style={styles.inviteBox}>
            <h2>{invite.invite_code}</h2>
            <p>
              Expires:{" "}
              {new Date(invite.expires_at).toLocaleString()}
            </p>
            <button
              style={styles.secondaryButton}
              onClick={() =>
                navigator.clipboard.writeText(invite.invite_code)
              }
            >
              Copy Code
            </button>
          </div>
        )}
      </section>

      {/* PENDING REQUESTS */}
      <section style={styles.card}>
        <h3>📩 Caretaker Requests</h3>

        {requests.length === 0 ? (
          <p>No pending requests.</p>
        ) : (
          requests.map((request) => (
            <div key={request.id} style={styles.request}>
              <p>
                New caretaker request
                <br />
                <small>Account ID: {request.caretaker_id}</small>
              </p>

              <div style={styles.buttonRow}>
                <button
                  style={styles.button}
                  disabled={saving}
                  onClick={() => respondToRequest(request.id, true)}
                >
                  Approve
                </button>

                <button
                  style={styles.dangerButton}
                  disabled={saving}
                  onClick={() => respondToRequest(request.id, false)}
                >
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      <ApprovedCaretakers key={userId} />

      {/* CARETAKER SECTION */}
      <section style={styles.card}>
        <h3>🔗 Connect with a Patient</h3>

        <p>
          Enter the invitation code shared by the patient.
        </p>

        <input
          style={styles.input}
          placeholder="Enter invitation code"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
        />

        <button
          style={styles.button}
          onClick={redeemInvite}
          disabled={saving}
        >
          Send Connection Request
        </button>
      </section>

      {/* LINKED PATIENTS */}
      <section style={styles.card}>
        <h3>👤 Connected Patients</h3>

        {linkedPatients.length === 0 ? (
          <p>No approved patient connections yet.</p>
        ) : (
          linkedPatients.map((patient) => (
            <div key={patient.id} style={styles.patientBox}>
              <h3>{patient.full_name || "Patient"}</h3>
              <p>Age: {patient.age || "Not available"}</p>
              <p>Phone: {patient.phone || "Not available"}</p>

              <h4>💊 Active Medicines</h4>

              {medicines.filter(
                (medicine) => medicine.patient_id === patient.id
              ).length === 0 ? (
                <p>No active medicines.</p>
              ) : (
                medicines
                  .filter(
                    (medicine) => medicine.patient_id === patient.id
                  )
                  .map((medicine) => (
                    <div key={medicine.id} style={styles.medicine}>
                      <strong>{medicine.medicine_name}</strong>
                      <CaretakerMedicineEditor key={`${medicine.id}-${medicine.caretaker_edit_version}`} medicine={medicine} onSaved={loadCaretakerData} />
                      <p>Dosage: {medicine.dosage}</p>
                      <p>Frequency: {medicine.frequency}</p>
                      <p>
                        Timings: {medicine.times?.join(", ") || "Not set"}
                      </p>
                      <p>
                        Stock: {medicine.stock_quantity ?? "Not available"}{" "}
                        {medicine.stock_unit || ""}
                      </p>

                      {medicine.stock_quantity !== null &&
                        medicine.stock_quantity <=
                          medicine.low_stock_threshold && (
                          <p style={styles.warning}>
                            ⚠️ Low stock alert
                          </p>
                        )}
                    </div>
                  ))
              )}

              <h4>📋 Recent Dose History</h4>

              {doseLogs.filter(
                (log) => log.patient_id === patient.id
              ).length === 0 ? (
                <p>No dose history available.</p>
              ) : (
                doseLogs
                  .filter((log) => log.patient_id === patient.id)
                  .slice(0, 10)
                  .map((log) => (
                    <div key={log.id} style={styles.log}>
                      <span>
                        {new Date(log.scheduled_for).toLocaleString()}
                      </span>
                      <strong>{log.status}</strong>
                    </div>
                  ))
              )}
            </div>
          ))
        )}
      </section>

      <button
        style={styles.secondaryButton}
        onClick={loadCaretakerData}
        disabled={saving}
      >
        🔄 Refresh Dashboard
      </button>

      <p style={styles.note}>
        🔒 Caretaker access is read-only. Only the patient can manage
        medicines and medication schedules.
      </p>
    </div>
  );
}

const styles = {
  container: {
    padding: "24px",
    color: "var(--text-primary, #222)",
    maxWidth: "1000px",
    margin: "0 auto",
  },
  heading: {
    marginBottom: "8px",
  },
  subtitle: {
    color: "#777",
    marginBottom: "24px",
  },
  card: {
    background: "var(--card-bg, #fff)",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "20px",
  },
  button: {
    background: "#16834a",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 16px",
    cursor: "pointer",
    marginTop: "10px",
  },
  secondaryButton: {
    background: "#e8f5ed",
    color: "#16834a",
    border: "none",
    borderRadius: "8px",
    padding: "10px 16px",
    cursor: "pointer",
    marginTop: "10px",
  },
  dangerButton: {
    background: "#dc3545",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 16px",
    cursor: "pointer",
  },
  buttonRow: {
    display: "flex",
    gap: "10px",
  },
  input: {
    display: "block",
    width: "100%",
    maxWidth: "400px",
    padding: "12px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    marginTop: "12px",
    boxSizing: "border-box",
  },
  inviteBox: {
    background: "#e8f5ed",
    padding: "15px",
    borderRadius: "10px",
    marginTop: "15px",
    textAlign: "center",
  },
  request: {
    borderBottom: "1px solid #eee",
    padding: "12px 0",
  },
  patientBox: {
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "15px",
    marginTop: "15px",
  },
  medicine: {
    background: "#f7f9fc",
    padding: "12px",
    borderRadius: "8px",
    marginBottom: "10px",
  },
  log: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    padding: "8px",
    borderBottom: "1px solid #eee",
  },
  warning: {
    color: "#dc3545",
    fontWeight: "bold",
  },
  error: {
    background: "#fee2e2",
    color: "#b91c1c",
    padding: "12px",
    borderRadius: "8px",
    marginBottom: "15px",
  },
  success: {
    background: "#dcfce7",
    color: "#166534",
    padding: "12px",
    borderRadius: "8px",
    marginBottom: "15px",
  },
  note: {
    color: "#777",
    fontSize: "13px",
    marginTop: "20px",
  },
};
