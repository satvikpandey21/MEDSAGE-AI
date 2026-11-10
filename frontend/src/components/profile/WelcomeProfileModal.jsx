import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function WelcomeProfileModal({ userId, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const dialog = useRef(null);
  useEffect(() => {
    let cancelled = false;
    supabase.from("patient_onboarding").select("status").eq("patient_id", userId).maybeSingle().then(({ data, error }) => {
      if (!cancelled && !error && data?.status === "pending") setOpen(true);
    });
    return () => { cancelled = true; };
  }, [userId]);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
  }, [open]);
  async function dismiss(navigate) {
    setSaving(true);
    const { error } = await supabase.from("patient_onboarding").update({ status: "deferred" }).eq("patient_id", userId).eq("status", "pending");
    setSaving(false);
    if (error) { setError("Could not save your choice. Please try again."); return; }
    dialog.current?.close();
    setOpen(false);
    if (navigate) onNavigate("profile");
  }
  if (!open) return null;
  return <dialog ref={dialog} aria-labelledby="welcome-title" aria-describedby="welcome-description" onCancel={(event) => { event.preventDefault(); if (!saving) dismiss(false); }} style={{ width: "min(440px, calc(100vw - 48px))", border: "1px solid #e2e8f0", borderRadius: 16, padding: 28, color: "#1e293b" }}>
    <h2 id="welcome-title">Welcome to MedSage AI.</h2>
    <p id="welcome-description">Complete your profile to personalize your medication management experience.</p>
    <button type="button" style={{ background: "#0284c7", color: "white", padding: "10px 14px", border: 0, borderRadius: 7, cursor: "pointer" }} disabled={saving} onClick={() => dismiss(true)}>Complete My Profile</button>{" "}
    <button type="button" style={{ background: "#f1f5f9", color: "#334155", padding: "10px 14px", border: 0, borderRadius: 7, cursor: "pointer" }} disabled={saving} onClick={() => dismiss(false)}>Remind Me Later</button>
    {error && <p role="alert">{error}</p>}
  </dialog>;
}
