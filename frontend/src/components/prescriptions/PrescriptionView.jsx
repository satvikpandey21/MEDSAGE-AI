import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
];

export default function PrescriptionView() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [analyzingId, setAnalyzingId] = useState(null);
  const [analysisResults, setAnalysisResults] = useState({});

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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPrescriptions();
  }, []);

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

    // Get prescription file from Supabase Storage
    const { data: signedData, error: signedError } =
      await supabase.storage
        .from("prescriptions")
        .createSignedUrl(file.file_path, 120);

    if (signedError) throw signedError;

    // Download file
    const fileResponse = await fetch(signedData.signedUrl);

    if (!fileResponse.ok) {
      throw new Error("Unable to download prescription.");
    }

    const blob = await fileResponse.blob();

    // Prepare file for backend
    const formData = new FormData();

    formData.append("file", blob, file.file_name);

    // Send file to Gemini AI backend
    const response = await fetch(
      "http://127.0.0.1:8000/analyze-prescription",
      {
        method: "POST",
        body: formData,
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.detail || "Prescription analysis failed."
      );
    }

    setAnalysisResults((previous) => ({
      ...previous,
      [file.id]: result.data,
    }));

    setMessage("AI analysis completed successfully!");

  } catch (err) {
    setError(err.message || "AI analysis failed.");
  } finally {
    setAnalyzingId(null);
  }
}
  async function handleView(file) {
    try {
      const { data, error } = await supabase.storage
        .from("prescriptions")
        .createSignedUrl(file.file_path, 60);

      if (error) throw error;

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
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

      const { error: storageError } = await supabase.storage
        .from("prescriptions")
        .remove([file.file_path]);

      if (storageError) throw storageError;

      const { error: databaseError } = await supabase
        .from("patient_prescriptions")
        .delete()
        .eq("id", file.id);

      if (databaseError) throw databaseError;

      setMessage("Prescription deleted successfully.");
      await loadPrescriptions();
    } catch (err) {
      setError("Delete failed: " + err.message);
    }
  }

  function formatSize(bytes) {
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
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
        <p style={styles.note}>JPG, PNG or PDF · Maximum 10 MB per file</p>

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
            </div>
          ))}
        </div>
      )}
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
};