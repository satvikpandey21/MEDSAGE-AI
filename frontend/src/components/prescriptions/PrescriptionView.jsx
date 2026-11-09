import { createOwnedSignedUrl } from "../../lib/privateStorage";
import { isSafeAnalysis, compareMedicineFields } from "../../lib/analysisSafety";
import { deleteOwnedDocument } from "../../lib/deleteOwnedDocument";
import { apiUrl } from "../../lib/api";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import MedicineDetails from "./MedicineDetails";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
];

export default function PrescriptionView() {
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [analyzingId, setAnalyzingId] = useState(null);
  const [analysisResults, setAnalysisResults] = useState({});
  const [savedBills, setSavedBills] = useState([]);
const [selectedBills, setSelectedBills] = useState({});
const [verificationResults, setVerificationResults] = useState({});
const [verifyingId, setVerifyingId] = useState(null);
const [visibleAnalysisIds, setVisibleAnalysisIds] = useState({});

  async function getUserId() {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      throw new Error("Please login again to continue.");
    }

    return data.user.id;
  }

  async function loadPrescriptions() {
    try {
      setLoading(true);
      const userId = await getUserId();

      const { data, error } = await supabase
        .from("patient_prescriptions")
        .select("*")
        .eq("patient_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setFiles(data || []);

const savedResults = {};

(data || []).forEach((file) => {
  if (file.analysis_result) {
    savedResults[file.id] = file.analysis_result;
  }
});

setAnalysisResults(savedResults);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPrescriptions();
     loadSavedBills();
  loadVerifications();
  }, []);
  async function loadSavedBills() {
  try {
    const userId = await getUserId();

    const { data, error } = await supabase
      .from("patient_bills")
      .select("*")
      .eq("patient_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    setSavedBills(data || []);
  } catch (err) {
    console.error("LOAD SAVED BILLS ERROR:", err);
  }
}

async function loadVerifications() {
  try {
    const userId = await getUserId();

    const { data, error } = await supabase
      .from("prescription_bill_verifications")
      .select("*")
      .eq("patient_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const results = {};

    (data || []).forEach((item) => {
      if (!results[item.prescription_id]) {
        results[item.prescription_id] = item;
      }
    });

    setVerificationResults(results);
  } catch (err) {
    console.error("LOAD VERIFICATIONS ERROR:", err);
  }
}

  async function handleUpload(event) {
    const selectedFiles = Array.from(event.target.files || []);

    if (!selectedFiles.length) return;

    setMessage("");
    setError("");

    for (const file of selectedFiles) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError("Only JPG, PNG and PDF files are allowed.");
        event.target.value = "";
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setError("Each file must be smaller than 10 MB.");
        event.target.value = "";
        return;
      }
    }

    try {
      setUploading(true);
      const userId = await getUserId();

      for (const file of selectedFiles) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `${userId}/${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("prescriptions")
          .upload(filePath, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase
          .from("patient_prescriptions")
          .insert({
            patient_id: userId,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            upload_status: "uploaded",
          });

        if (insertError) {
          await supabase.storage
            .from("prescriptions")
            .remove([filePath]);

          throw insertError;
        }
      }

      setMessage("Prescription uploaded successfully!");
      await loadPrescriptions();
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleAnalyze(file) {
    try {
      setAnalyzingId(file.id);
      setError("");
      setMessage("");

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Please login again to continue.");
      const response = await fetch(
        apiUrl("/analyze-prescription"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ prescription_id: file.id }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail || "Prescription analysis failed."
        );
      }

      // Save AI analysis permanently in Supabase
const userId = await getUserId();

const { data: savedAnalysis, error: saveError } = await supabase
  .from("patient_prescriptions")
  .update({
    analysis_result: result.data,
    analysis_status: result.analysis_status,
  })
  .eq("id", file.id)
  .eq("patient_id", userId)
  .select("analysis_result")
  .single();

if (saveError) {
  throw saveError;
}
// Render the database state, including any durable OCR guard applied to it.
result.data = savedAnalysis.analysis_result;

// Update frontend state
setAnalysisResults((previous) => ({
  ...previous,
  [file.id]: result.data,
}));

// Show analysis result automatically
setVisibleAnalysisIds((previous) => ({
  ...previous,
  [file.id]: true,
}));

setMessage(result.data.message || result.message);

    } catch (err) {
      setError(err.message || "AI analysis failed.");
    } finally {
      setAnalyzingId(null);
    }
  }
async function handleVerifyWithBill(file) {
  try {
    setError("");
    setMessage("");

    const billId = selectedBills[file.id];

    if (!billId) {
      setError("Please select a pharmacy bill first.");
      return;
    }

    const prescription = analysisResults[file.id];

    if (!prescription) {
      setError("Please analyze the prescription first.");
      return;
    }

    const bill = savedBills.find((item) => item.id === billId);

    if (!bill || !bill.analysis_result) {
      setError("Selected bill has no saved analysis.");
      return;
    }

    if (prescription.extraction_source === "paddleocr" || prescription.analysis_status === "pending_review") {
      setError("OCR text is unverified and cannot be verified against a bill or used for schedules.");
      return;
    }
    const prescriptionMedicines = prescription.medicines || [];
    const billMedicines = bill.analysis_result.medicines || [];

    if (!prescriptionMedicines.length) {
      setError("No medicines found in this prescription to verify.");
      return;
    }

    setVerifyingId(file.id);

    const normalize = (value) =>
      String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    const comparisons = prescriptionMedicines.map((medicine) => {
      const medicineName = normalize(medicine.name);

      const billMedicine = billMedicines.find(
        (item) => normalize(item.name) === medicineName
      );

      if (!medicineName || !billMedicine) {
        return {
          prescription_medicine: medicine.name || null,
          bill_medicine: billMedicine?.name || null,
          status: "mismatch",
          reason: "Medicine name not found as an exact match on the bill.",
        };
      }

      const { differences, uncertainties } = compareMedicineFields(medicine, billMedicine);

      return {
        prescription_medicine: medicine.name,
        bill_medicine: billMedicine.name,
        status: differences.length
          ? "mismatch"
          : uncertainties.length
          ? "needs_review"
          : "matched",
        differences,
        uncertainties,
      };
    });

    const status = comparisons.some((item) => item.status === "mismatch")
      ? "mismatch"
      : comparisons.some((item) => item.status === "needs_review")
      ? "needs_review"
      : "matched";

    const userId = await getUserId();

    const { data, error } = await supabase
      .from("prescription_bill_verifications")
      .insert({
        patient_id: userId,
        prescription_id: file.id,
        bill_id: bill.id,
        comparison_result: { medicines: comparisons },
        status,
      })
      .select()
      .single();

    if (error) throw error;

    setVerificationResults((previous) => ({
      ...previous,
      [file.id]: data,
    }));

    setMessage(`Verification completed: ${status.replace("_", " ").toUpperCase()}`);

  } catch (err) {
    console.error("VERIFICATION ERROR:", err);
    setError(err.message || "Verification failed.");
  } finally {
    setVerifyingId(null);
  }
}
  async function handleView(file) {
    try {
      const signedUrl = await createOwnedSignedUrl(supabase, "prescriptions", file.file_path);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError("Unable to open file: " + err.message);
    }
  }

  async function handleDelete(file) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this prescription?"
    );

    if (!confirmed) return;

    try {
      setError("");
      setMessage("");

      const userId = await getUserId();
      const cleanup = await deleteOwnedDocument({ client: supabase,
        table: "patient_prescriptions", bucket: "prescriptions", id: file.id, userId });
      setMessage(cleanup.storageCleanupPending
        ? "Record deleted. The stored file still needs cleanup; contact support."
        : "Prescription deleted successfully.");
      await loadPrescriptions();
    } catch (err) {
      setError("Delete failed: " + err.message);
    }
  }

  function formatSize(bytes) {
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  // Display extracted information in a reusable format
  function renderItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return (
        <p style={styles.notFound}>
          No information mentioned in prescription.
        </p>
      );
    }

    return items.map((item, index) => (
      <div key={index} style={styles.resultItem}>
        {typeof item === "string" ? (
          <p style={{ margin: 0 }}>{item}</p>
        ) : (
          Object.entries(item).map(([key, value]) => {
            if (
              value === null ||
              value === undefined ||
              value === "" ||
              key === "uncertain_fields"
            ) {
              return null;
            }

            return (
              <p key={key}>
                <strong>
                  {key.replace(/_/g, " ")}:
                </strong>{" "}
                {Array.isArray(value)
                  ? value.join(", ")
                  : String(value)}
              </p>
            );
          })
        )}

        {typeof item === "object" &&
          Array.isArray(item.uncertain_fields) &&
          item.uncertain_fields.length > 0 && (
            <p style={{ color: "#b45309" }}>
              ⚠️ Needs verification:{" "}
              {item.uncertain_fields.join(", ")}
            </p>
          )}
      </div>
    ));
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>My Prescriptions</h2>
          <p style={styles.subtitle}>
            Upload and manage your medical prescriptions securely.
          </p>
        </div>
      </div>

      <div style={styles.uploadBox}>
        <div style={styles.uploadIcon}>📄</div>
        <h3>Upload Prescription</h3>
        <p>Choose prescription images or PDF files.</p>
        <p style={styles.note}>
          JPG, PNG or PDF · Maximum 10 MB per file
        </p>

        <label style={styles.uploadButton}>
          {uploading ? "Uploading..." : "＋ Select Files"}
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            multiple
            disabled={uploading}
            onChange={handleUpload}
            style={{ display: "none" }}
          />
        </label>

        <label style={styles.cameraButton}>
          📷 Capture Prescription
          <input
            type="file"
            accept="image/*"
            capture="environment"
            disabled={uploading}
            onChange={handleUpload}
            style={{ display: "none" }}
          />
        </label>
      </div>

      {message && <div style={styles.success}>{message}</div>}
      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.listHeader}>
        <h3>Prescription History</h3>
        <span>{files.length} files</span>
      </div>

      {loading ? (
        <p>Loading prescriptions...</p>
      ) : files.length === 0 ? (
        <div style={styles.empty}>
          <div style={{ fontSize: 35 }}>📁</div>
          <h3>No prescriptions uploaded yet</h3>
          <p>Your uploaded prescriptions will appear here.</p>
        </div>
      ) : (
        <div style={styles.fileList}>
          {files.map((file) => (
            <div key={file.id} style={styles.fileCard}>
              <div style={styles.fileInfo}>
                <span style={styles.fileIcon}>
                  {file.file_type === "application/pdf" ? "📕" : "🖼️"}
                </span>

                <div>
                  <strong>{file.file_name}</strong>
                  <p style={styles.fileMeta}>
                    {formatSize(file.file_size)} ·{" "}
                    {new Date(file.created_at).toLocaleDateString()}
                  </p>
                  <span style={styles.status}>
                    {file.upload_status}
                  </span>
                </div>
              </div>

              <div style={styles.actions}>
                <button
                  style={styles.viewButton}
                  onClick={() => handleAnalyze(file)}
                  disabled={analyzingId === file.id}
                >
                  {analyzingId === file.id
                    ? "Analyzing..."
                    : "🤖 Analyze with AI"}
                </button>

                <button
                  style={styles.viewButton}
                  onClick={() => handleView(file)}
                >
                  View
                </button>

                <button
                  style={styles.deleteButton}
                  onClick={() => handleDelete(file)}
                >
                  Delete
                </button>
              </div>

              {/* Complete AI Prescription Analysis Results */}
              {analysisResults[file.id] && visibleAnalysisIds[file.id] && (
                <div style={styles.analysisBox}>

                  <h3 style={styles.analysisTitle}>
                    🤖 Complete AI Prescription Analysis
                  </h3>

                  {(() => {
                    const result = analysisResults[file.id];

                    if (!isSafeAnalysis(result)) return <p role="alert">Saved analysis is malformed. Reanalyze or review the original document.</p>;
                    if (result.extraction_source === "paddleocr" || result.analysis_status === "pending_review") {
                      return <section aria-label="Unverified OCR text">
                        <h4>OCR text - pending human review</h4>
                        <p role="status">{result.message}</p>
                        <p>All medicine details and instructions are unverified. Check the original using View and ask a pharmacist or prescriber to clarify handwriting. Schedule creation is disabled for this result.</p>
                        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit" }}>{result.raw_ocr_text}</pre>
                      </section>;
                    }
                    return (
                      <>
                        {/* Patient and Doctor Details */}
                        <h4>👤 Patient & Doctor Details</h4>

                        <p>
                          <strong>Patient:</strong>{" "}
                          {result.patient_name || "Not identified"}
                        </p>

                        <p>
                          <strong>Doctor:</strong>{" "}
                          {result.doctor_name || "Not identified"}
                        </p>

                        <p>
                          <strong>Hospital:</strong>{" "}
                          {result.hospital_name || "Not identified"}
                        </p>

                        <p>
                          <strong>Prescription Date:</strong>{" "}
                          {result.prescription_date || "Not identified"}
                        </p>

                        {/* Symptoms */}
                        <h4>🩺 Symptoms & Complaints</h4>
                        {renderItems(result.symptoms)}

                        {/* Diagnosis */}
                        <h4>🔍 Diagnosis & Assessment</h4>
                        {renderItems(result.diagnosis)}

                        {/* Medicines */}
                        <h4>💊 Prescribed Medicines</h4>

                        {Array.isArray(result.medicines) &&
                        result.medicines.length > 0 ? (
                          result.medicines.map((medicine, index) => (
                            <div
                              key={index}
                              style={{ ...styles.resultItem, cursor: "pointer" }}
                              role="button"
                              tabIndex={0}
                              aria-haspopup="dialog"
                              aria-label={`View details for ${medicine.name || "unclear medicine"}`}
                              onClick={() => setSelectedMedicine(medicine)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setSelectedMedicine(medicine);
                                }
                              }}
                            >
                              <strong>
                                {index + 1}.{" "}
                                {medicine.name ||
                                  "Medicine name unclear"}
                              </strong>

                              <p>
                                Active Ingredient:{" "}
                                {medicine.active_ingredient ||
                                  "Not identified"}
                              </p>

                              <p>
                                Strength:{" "}
                                {medicine.strength || "Not identified"}
                              </p>

                              <p>
                                Dosage:{" "}
                                {medicine.dosage || "Not identified"}
                              </p>

                              <p>
                                Route:{" "}
                                {medicine.route || "Not identified"}
                              </p>

                              <p>
                                Frequency:{" "}
                                {medicine.frequency || "Not identified"}
                              </p>

                              <p>
                                Duration:{" "}
                                {medicine.duration || "Not identified"}
                              </p>

                              {Array.isArray(medicine.uncertain_fields) &&
                                medicine.uncertain_fields.length > 0 && (
                                  <p style={{ color: "#b45309" }}>
                                    ⚠️ Needs verification:{" "}
                                    {medicine.uncertain_fields.join(", ")}
                                  </p>
                                )}
                            </div>
                          ))
                        ) : (
                          <p style={styles.notFound}>
                            No medicines prescribed or mentioned.
                          </p>
                        )}
{/* Prescription Bill Verification */}
<div style={styles.resultItem}>
  <h4>🧾 Verify with Pharmacy Bill</h4>

  <select
    value={selectedBills[file.id] || ""}
    onChange={(e) =>
      setSelectedBills((prev) => ({
        ...prev,
        [file.id]: e.target.value,
      }))
    }
    style={{
      padding: "10px",
      width: "100%",
      borderRadius: "6px",
      marginBottom: "12px",
    }}
  >
    <option value="">Select an analyzed pharmacy bill</option>

    {savedBills
      .filter((bill) => bill.analysis_result)
      .map((bill) => (
        <option key={bill.id} value={bill.id}>
          {bill.file_name} â€” {new Date(bill.created_at).toLocaleDateString()}
        </option>
      ))}
  </select>

  <button
    style={styles.viewButton}
    onClick={() => handleVerifyWithBill(file)}
    disabled={verifyingId === file.id}
  >
    {verifyingId === file.id ? "Verifying..." : "Verify with Bill"}
  </button>

  {verificationResults[file.id] && (
    <div style={{ marginTop: "15px" }}>
      <h4>
        Verification Status:{" "}
        {verificationResults[file.id].status.toUpperCase()}
      </h4>

      {(verificationResults[file.id].comparison_result?.medicines || []).map(
        (item, index) => (
          <div key={index} style={styles.resultItem}>
            <strong>{item.prescription_medicine}</strong>
            <p>Status: {item.status.toUpperCase()}</p>

            {item.differences?.map((text, i) => (
              <p key={i}>âŒ {text}</p>
            ))}

            {item.uncertainties?.map((text, i) => (
              <p key={i}>⚠️ {text}</p>
            ))}
          </div>
        )
      )}
    </div>
  )}
</div>
                        {/* Non Medicine Treatment */}
                        <h4>🏃 Exercises & Non-Medicine Treatment</h4>
                        {renderItems(result.non_medicine_treatment)}

                        {/* Care Instructions */}
                        <h4>🛌 Care Instructions</h4>
                        {renderItems(result.care_instructions)}

                        {/* Precautions */}
                        <h4>⚠️ Precautions</h4>
                        {renderItems(result.precautions)}

                        {/* Follow Up */}
                        <h4>📅 Follow-up Instructions</h4>
                        {renderItems(result.follow_up)}

                        {/* Additional Notes */}
                        <h4>📝 Additional Notes</h4>
                        {renderItems(result.additional_notes)}

                        {/* Uncertain Information */}
                        <h4>❓ Information Requiring Review</h4>
                        {renderItems(result.uncertain_information)}

                        <div style={styles.warningBox}>
                          ⚠️ AI-extracted information must be verified
                          against the original prescription by the patient
                          and a qualified healthcare professional.
                          Do not use unverified results for medical decisions.
                        </div>
                      </>
                    );
                  })()}

                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {selectedMedicine && <MedicineDetails medicine={selectedMedicine} onClose={() => setSelectedMedicine(null)} />}
    </div>
  );
}

const styles = {
  container: {
    padding: "24px",
    color: "var(--text-primary, #1f2937)",
  },
  header: {
    marginBottom: "24px",
  },
  title: {
    margin: "0 0 8px",
    fontSize: "26px",
  },
  subtitle: {
    color: "#64748b",
    margin: 0,
  },
  uploadBox: {
    background: "var(--card-bg, #ffffff)",
    border: "2px dashed #cbd5e1",
    borderRadius: "14px",
    padding: "35px 20px",
    textAlign: "center",
    marginBottom: "24px",
  },
  uploadIcon: {
    fontSize: "40px",
  },
  note: {
    fontSize: "12px",
    color: "#64748b",
  },
  uploadButton: {
    display: "inline-block",
    background: "#2563eb",
    color: "white",
    padding: "12px 20px",
    borderRadius: "8px",
    cursor: "pointer",
    margin: "12px 6px",
  },
  cameraButton: {
    display: "inline-block",
    border: "1px solid #2563eb",
    color: "#2563eb",
    padding: "11px 18px",
    borderRadius: "8px",
    cursor: "pointer",
    margin: "12px 6px",
  },
  success: {
    background: "#dcfce7",
    color: "#166534",
    padding: "12px",
    borderRadius: "8px",
    marginBottom: "15px",
  },
  error: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "12px",
    borderRadius: "8px",
    marginBottom: "15px",
  },
  listHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "15px",
  },
  empty: {
    textAlign: "center",
    padding: "40px 15px",
    background: "var(--card-bg, #ffffff)",
    borderRadius: "12px",
    color: "#64748b",
  },
  fileList: {
    display: "grid",
    gap: "12px",
  },
  fileCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
    padding: "16px",
    background: "var(--card-bg, #ffffff)",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
  },
  fileInfo: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
  },
  fileIcon: {
    fontSize: "30px",
  },
  fileMeta: {
    fontSize: "12px",
    color: "#64748b",
    margin: "5px 0",
  },
  status: {
    fontSize: "11px",
    color: "#15803d",
    background: "#dcfce7",
    padding: "3px 8px",
    borderRadius: "10px",
  },
  actions: {
    display: "flex",
    gap: "8px",
  },
  viewButton: {
    padding: "8px 14px",
    border: "none",
    borderRadius: "6px",
    background: "#2563eb",
    color: "white",
    cursor: "pointer",
  },
  deleteButton: {
    padding: "8px 14px",
    border: "none",
    borderRadius: "6px",
    background: "#fee2e2",
    color: "#b91c1c",
    cursor: "pointer",
  },

  // New AI analysis styles
  analysisBox: {
    width: "100%",
    flexBasis: "100%",
    marginTop: "8px",
    padding: "18px",
    background: "#f0f7ff",
    border: "1px solid #cfe2ff",
    borderRadius: "12px",
    color: "#1e293b",
    boxSizing: "border-box",
  },
  analysisTitle: {
    marginTop: 0,
    color: "#1d4ed8",
  },
  resultItem: {
    background: "#ffffff",
    padding: "14px",
    marginBottom: "12px",
    borderRadius: "8px",
    border: "1px solid #dbeafe",
  },
  notFound: {
    color: "#64748b",
  },
  warningBox: {
    background: "#fff7ed",
    color: "#9a3412",
    padding: "12px",
    borderRadius: "8px",
    marginTop: "18px",
    fontSize: "13px",
    fontWeight: "600",
  },
};
