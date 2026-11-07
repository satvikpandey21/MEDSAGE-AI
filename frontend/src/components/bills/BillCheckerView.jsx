import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

const API_URL = "http://127.0.0.1:8000";

export default function BillCheckerView() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const [savedBills, setSavedBills] = useState([]);
const [selectedBillId, setSelectedBillId] = useState(null);

async function loadSavedBills() {
  try {
    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      throw new Error("Please login again.");
    }

    const { data, error } = await supabase
      .from("patient_bills")
      .select("*")
      .eq("patient_id", authData.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const bills = data || [];
setSavedBills(bills);

// Automatically show latest saved AI analysis
const latestBill = bills.find(
  (bill) => bill.analysis_result
);

if (latestBill) {
  setResult(latestBill.analysis_result);
  setSelectedBillId(latestBill.id);
}

  } catch (err) {
    console.error("LOAD SAVED BILLS ERROR:", err);
  }
}
useEffect(() => {
  loadSavedBills();
}, []);
async function handleUpload() {
    if (!file) {
      setError("Please select a pharmacy bill first.");
      return;
    }

    setError("");
    setMessage("");
    setResult(null);

    try {
      setLoading(true);

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Please login again.");
      }

      const userId = authData.user.id;

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${userId}/${crypto.randomUUID()}-${safeName}`;

      // Upload bill to private Supabase bucket
      const { error: uploadError } = await supabase.storage
        .from("pharmacy-bills")
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Save bill record
      const { error: insertError } = await supabase
        .from("patient_bills")
        .insert({
          patient_id: userId,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          verification_status: "uploaded",
        });

      if (insertError) {
        await supabase.storage
          .from("pharmacy-bills")
          .remove([filePath]);

        throw insertError;
      }

      setMessage("Bill uploaded successfully. Analyzing with AI...");

      // Send bill to Gemini backend
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/analyze-bill`, {
        method: "POST",
        body: formData,
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(
          responseData.detail || "Bill analysis failed."
        );
      }

      // Save AI analysis permanently in Supabase
const { error: saveError } = await supabase
  .from("patient_bills")
  .update({
    analysis_result: responseData.data,
    analysis_status: "analyzed",
    verification_status: "analyzed",
  })
  .eq("file_path", filePath)
  .eq("patient_id", userId);

if (saveError) {
  throw saveError;
}

// Update frontend state
setResult(responseData.data);

setMessage("Bill analyzed and saved successfully!");
await loadSavedBills();
    } catch (err) {
      console.error("BILL CHECKER ERROR:", err);
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }
async function handleDeleteBill(bill) {
  const confirmed = window.confirm(
    `Are you sure you want to delete ${bill.file_name}?`
  );

  if (!confirmed) return;

  try {
    setError("");
    setMessage("");

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      throw new Error("Please login again.");
    }

    const userId = authData.user.id;

    // Delete original bill from Storage
    const { error: storageError } = await supabase.storage
      .from("pharmacy-bills")
      .remove([bill.file_path]);

    if (storageError) throw storageError;

    // Delete bill record from database
    const { error: databaseError } = await supabase
      .from("patient_bills")
      .delete()
      .eq("id", bill.id)
      .eq("patient_id", userId);

    if (databaseError) throw databaseError;

    // Update frontend
    setSavedBills((previous) =>
      previous.filter((item) => item.id !== bill.id)
    );

    if (selectedBillId === bill.id) {
      setSelectedBillId(null);
      setResult(null);
    }

    setMessage("Pharmacy bill deleted successfully!");

  } catch (err) {
    console.error("DELETE BILL ERROR:", err);
    setError("Unable to delete bill: " + err.message);
  }
}
  return (
    <div style={{ maxWidth: "950px", margin: "0 auto" }}>
      <div style={{ marginBottom: "25px" }}>
        <h2>Pharmacy Bill Checker</h2>
        <p style={{ color: "#64748b" }}>
          Upload your pharmacy bill and let AI extract medicine
          and billing details.
        </p>
      </div>

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          padding: "25px",
          marginBottom: "25px",
        }}
      >
        <h3>Upload Pharmacy Bill</h3>

        <input
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setError("");
            setMessage("");
            setResult(null);
          }}
        />

        {file && (
          <p style={{ color: "#475569", marginTop: "12px" }}>
            Selected: {file.name}
          </p>
        )}

        <button
          onClick={handleUpload}
          disabled={loading || !file}
          style={{
            marginTop: "18px",
            padding: "12px 22px",
            border: "none",
            borderRadius: "8px",
            background: loading ? "#94a3b8" : "#0284c7",
            color: "#ffffff",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "Analyzing..." : "Upload & Analyze with AI"}
        </button>

        {message && (
          <p style={{ color: "#059669", marginTop: "15px" }}>
            {message}
          </p>
        )}

        {error && (
          <p style={{ color: "#dc2626", marginTop: "15px" }}>
            {error}
          </p>
        )}
      </div>
      {savedBills.length > 0 && (
  <div
    style={{
      background: "#ffffff",
      border: "1px solid #e2e8f0",
      borderRadius: "14px",
      padding: "20px",
      marginBottom: "25px",
    }}
  >
    <h3>📂 Saved Pharmacy Bills</h3>

    {savedBills.map((bill) => (
      <div
        key={bill.id}
        style={{
          padding: "12px",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          marginBottom: "10px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <div>
          <strong>{bill.file_name}</strong>
          <p style={{ fontSize: "12px", color: "#64748b" }}>
            {new Date(bill.created_at).toLocaleDateString()}
          </p>
        </div>

       <div style={{ display: "flex", gap: "8px" }}>
  <button
    onClick={() => {
      if (!bill.analysis_result) return;
      setResult(bill.analysis_result);
      setSelectedBillId(bill.id);
    }}
    disabled={!bill.analysis_result}
    style={{
      padding: "8px 14px",
      background: "#2563eb",
      color: "white",
      border: "none",
      borderRadius: "6px",
      cursor: bill.analysis_result ? "pointer" : "not-allowed",
    }}
  >
    View Analysis
  </button>

  <button
    onClick={() => handleDeleteBill(bill)}
    style={{
      padding: "8px 14px",
      background: "#fee2e2",
      color: "#b91c1c",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
    }}
  >
    Delete
  </button>
</div>
      </div>
    ))}
  </div>
)}

      {result && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "25px",
          }}
        >
          <h3>AI Bill Analysis Results</h3>

          <p>
            <strong>Pharmacy:</strong>{" "}
            {result.pharmacy_name || "Not identified"}
          </p>

          <p>
            <strong>Bill Number:</strong>{" "}
            {result.bill_number || "Not identified"}
          </p>

          <p>
            <strong>Bill Date:</strong>{" "}
            {result.bill_date || "Not identified"}
          </p>

          <p>
            <strong>Total Amount:</strong>{" "}
            {result.total_amount ?? "Not identified"}
          </p>

          <h4>Medicine Details</h4>

          {result.medicines?.map((medicine, index) => (
            <div
              key={index}
              style={{
                padding: "15px",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                marginBottom: "12px",
              }}
            >
              <strong>{medicine.name || "Unknown medicine"}</strong>

              <p>Strength: {medicine.strength || "Unclear"}</p>
              <p>Form: {medicine.dosage_form || "Unclear"}</p>
              <p>Quantity: {medicine.quantity ?? "Unclear"}</p>
              <p>Unit Price: {medicine.unit_price ?? "Unclear"}</p>
              <p>Total Price: {medicine.total_price ?? "Unclear"}</p>

              {medicine.uncertain_fields?.length > 0 && (
                <p style={{ color: "#b45309" }}>
                  Needs verification:{" "}
                  {medicine.uncertain_fields.join(", ")}
                </p>
              )}
            </div>
          ))}

          <p
            style={{
              background: "#fff7ed",
              padding: "12px",
              borderRadius: "8px",
              color: "#9a3412",
            }}
          >
            AI-extracted information requires manual verification.
            This is not a medical or pharmacy verification.
          </p>
        </div>
      )}
    </div>
  );
}