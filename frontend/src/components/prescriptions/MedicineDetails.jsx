import { apiUrl } from "../../lib/api";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

const value = (text) => typeof text === "string" && text.trim() ? text : "Not recorded";

export default function MedicineDetails({ medicine, onClose }) {
  const dialog = useRef(null);
  const pending = useRef(false);
  const request = useRef(null);
  const [status, setStatus] = useState("idle");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const ingredient = typeof medicine.active_ingredient === "string" ? medicine.active_ingredient.trim() : "";
  // A brand name alone does not reliably identify a drug or combination.
  const ambiguous = !ingredient || /unclear|unknown|not identified|not available|unspecified|\? /i.test(ingredient)
    || ingredient.includes("?") || ingredient.length > 200
    || Boolean(medicine.uncertain_fields?.length);

  useEffect(() => {
    const previous = document.activeElement;
    const modal = dialog.current;
    const overflow = document.body.style.overflow;
    modal.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      request.current?.abort();
      modal.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  async function loadEducation() {
    if (ambiguous || pending.current) return;
    pending.current = true;
    setStatus("loading");
    setError("");
    const controller = new AbortController();
    request.current = controller;
    const timer = setTimeout(() => controller.abort(), 55000);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session?.access_token) throw new Error("Please sign in again to load medicine information.");
      const response = await fetch(apiUrl("/ask-medicine"), {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({
          question: `Provide general educational information about this extracted active ingredient: ${JSON.stringify(ingredient)}. Do not assume its identity if ambiguous or unrecognized. Use four clearly labelled sections: Common medical uses; Common side effects; Important precautions; General interaction warnings. Do not infer a patient's diagnosis or recommend a dose or treatment change.`,
          language: "en-IN",
          include_medications: false,
        }),
      });
      if (!response.ok) {
        const messages = {
          401: "Your session expired. Please sign in again.",
          429: "Too many questions. Please wait a minute and try again.",
          504: "The request timed out. Please try again.",
        };
        throw new Error(messages[response.status] || "Medicine information is unavailable right now. Please try again.");
      }
      const result = await response.json();
      if (typeof result.answer !== "string" || !result.answer.trim() || result.answer.length > 5000) {
        throw new Error("No usable medicine information was returned. Please try again.");
      }
      if (!controller.signal.aborted) {
        setAnswer(result.answer);
        setStatus("success");
      }
    } catch (err) {
      setError(err.name === "AbortError" ? "The request timed out or was cancelled. Please try again." : err instanceof TypeError ? "Unable to reach the assistant. Please try again." : err.message);
      setStatus("error");
    } finally {
      clearTimeout(timer);
      pending.current = false;
    }
  }

  const fields = [
    ["Active ingredient", medicine.active_ingredient], ["Strength", medicine.strength],
    ["Dosage", medicine.dosage], ["Route", medicine.route],
    ["Frequency", medicine.frequency], ["Duration", medicine.duration],
    ["Prescribed instructions", medicine.instructions || medicine.instruction],
  ];

  return (
    <dialog ref={dialog} aria-labelledby="medicine-details-title" onCancel={onClose}
      style={{ width: "min(720px, calc(100vw - 32px))", maxHeight: "85dvh", boxSizing: "border-box", padding: "24px", border: "1px solid #cbd5e1", borderRadius: "16px", color: "var(--text-primary, #1f2937)", background: "var(--card-bg, #fff)", boxShadow: "0 24px 80px #0004", overflowWrap: "anywhere" }}>
      <style>{`
        .medicine-details-action {
          background: var(--color-primary, #0284c7);
          color: #fff;
          border: 2px solid var(--color-primary-hover, #0369a1);
          border-radius: 10px;
          padding: 12px 20px;
          min-height: 48px;
          min-width: 48px;
          max-width: 100%;
          font: inherit;
          font-weight: 700;
          line-height: 1.5;
          cursor: pointer;
        }
        .medicine-details-action:hover:not(:disabled) {
          background: var(--color-primary-hover, #0369a1);
        }
        .medicine-details-action:focus-visible {
          outline: 3px solid #075985;
          outline-offset: 3px;
        }
        .medicine-details-action:disabled {
          background: var(--color-primary-hover, #0369a1);
          cursor: wait;
        }
      `}</style>
      <header style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: "16px" }}>
        <div><small>Medicine details</small><h2 id="medicine-details-title">{value(medicine.name)}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close medicine details" autoFocus>Close</button>
      </header>
      <section aria-labelledby="extracted-medicine-heading">
        <h3 id="extracted-medicine-heading">A. Extracted prescription information</h3>
        <p>AI extraction from your report. Verify these details against the original prescription; missing fields have not been filled in.</p>
        <dl style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)", gap: "10px 16px", padding: "16px", background: "#f1f5f9", borderRadius: "10px" }}>
          {fields.map(([label, text]) => <div key={label} style={{ display: "contents" }}><dt style={{ fontWeight: 600 }}>{label}</dt><dd style={{ margin: 0, whiteSpace: "pre-wrap" }}>{value(text)}</dd></div>)}
        </dl>
        {Boolean(medicine.uncertain_fields?.length) && <p style={{ color: "#92400e" }}>This medicine has uncertain extracted fields and needs human review.</p>}
      </section>
      <section aria-labelledby="education-medicine-heading">
        <h3 id="education-medicine-heading">B. General medicine education</h3>
        {ambiguous ? <p role="status" style={{ color: "#92400e" }}>Medicine identity is incomplete or uncertain. Ask a pharmacist to confirm the active ingredient and prescription details. Drug-specific education is withheld to avoid guessing.</p> : <>
          <p>Generated by Gemini about the extracted ingredient, not your prescribed treatment. Loading shares only the ingredient with the authenticated assistant.</p>
          <button className="medicine-details-action" type="button" onClick={loadEducation} disabled={status === "loading"}>
            {status === "loading" ? "Loading medicine information..." : "🔍 Get Detailed Medicine Information"}
          </button>
          <div aria-live="polite" aria-busy={status === "loading"}>
            {status === "loading" && <p role="status">Preparing uses, side effects, precautions and interaction warnings...</p>}
            {status === "error" && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
            {status === "success" && <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{answer}</p>}
          </div>
        </>}
      </section>
      <p style={{ borderTop: "1px solid #e2e8f0", paddingTop: "16px", fontSize: "13px" }}>Educational information only, not personalized medical advice. AI can make mistakes. Consult a clinician or pharmacist before treatment decisions. Do not change doses or stop prescribed treatment based on this panel. Seek immediate emergency care for urgent symptoms.</p>
    </dialog>
  );
}
