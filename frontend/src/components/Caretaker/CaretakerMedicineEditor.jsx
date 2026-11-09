import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function CaretakerMedicineEditor({ medicine, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Visibility is only a convenience: the database verifies approval and sources.
  if (!medicine.prescription_id || !medicine.verification_id) return null;
  const start = () => {
    setDraft({ medicine_name: medicine.medicine_name || "", dosage: medicine.dosage || "",
      instructions: medicine.instructions || "", stock_quantity: medicine.stock_quantity ?? "",
      low_stock_threshold: medicine.low_stock_threshold ?? 5 });
    setError(""); setEditing(true);
  };
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const changes = { ...draft, medicine_name: draft.medicine_name.trim(), dosage: draft.dosage.trim(),
        stock_quantity: draft.stock_quantity === "" ? null : Number(draft.stock_quantity),
        low_stock_threshold: Number(draft.low_stock_threshold) };
      if (medicine.caretaker_edit_version == null) throw new Error("Caretaker editing is not enabled yet. Ask support to apply the reviewed migration.");
      const { error: rpcError } = await supabase.rpc("edit_caretaker_medication", {
        p_schedule_id: medicine.id, p_expected_version: medicine.caretaker_edit_version, p_changes: changes,
      });
      if (rpcError) throw rpcError;
      setEditing(false);
      window.dispatchEvent(new Event("medsage:data-changed"));
      await onSaved();
    } catch (err) { setError(err.message || "Unable to save. Reload and check your approval."); }
    finally { setBusy(false); }
  };
  if (!editing) return <button type="button" onClick={start}>Edit medicine and stock</button>;
  return <form onSubmit={save} style={{ display: "grid", gap: 10, marginTop: 12 }}>
    <p>Changes require an approved connection and a matching non-OCR bill verification.</p>
    {[['medicine_name', 'Medicine', 'text'], ['dosage', 'Dosage', 'text'],
      ['instructions', 'Instructions', 'text'], ['stock_quantity', 'Stock quantity', 'number'],
      ['low_stock_threshold', 'Low-stock threshold', 'number']].map(([key, label, type]) => (
      <label key={key}>{label}<input style={{ display: "block", width: "100%", boxSizing: "border-box", padding: 8 }}
        type={type} min={type === "number" ? 0 : undefined} step={type === "number" ? "any" : undefined}
        maxLength={key === "instructions" ? 2000 : 200}
        required={key !== "instructions" && key !== "stock_quantity"} value={draft[key]}
        onChange={(e) => setDraft((old) => ({ ...old, [key]: e.target.value }))} disabled={busy} /></label>
    ))}
    {error && <p role="alert">{error}</p>}
    <div><button disabled={busy} type="submit">{busy ? "Saving..." : "Save changes"}</button>{" "}
      <button disabled={busy} type="button" onClick={() => setEditing(false)}>Cancel</button></div>
  </form>;
}
