import { apiUrl } from "../../lib/api";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";


export default function VoiceAssistantView() {
  const [listening, setListening] = useState(false);
  const [language, setLanguage] = useState("en-IN");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("Ask about medicine uses, side effects, precautions or general safety.");
  const [error, setError] = useState("");
  const [asking, setAsking] = useState(false);
  const [includeMedications, setIncludeMedications] = useState(false);
  const [contextStatus, setContextStatus] = useState("");
  const pending = useRef(false);
  const controllerRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => () => {
    controllerRef.current?.abort();
    recognitionRef.current?.abort();
    window.speechSynthesis?.cancel();
  }, []);

  const speak = (text, lang = language) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = lang === "hinglish" ? "hi-IN" : lang;
    speech.rate = 0.95;
    speech.pitch = 1;
    window.speechSynthesis.speak(speech);
  };

  const processQuestion = async (text) => {
    if (pending.current) return;
    if (!text.trim() || text.length > 1500) {
      setError("Enter a question between 1 and 1500 characters.");
      return;
    }
    pending.current = true;
    setAsking(true);
    setQuestion(text);
    setError("");
    setAnswer("");
    setContextStatus("");
    window.speechSynthesis?.cancel();
    const controller = new AbortController();
    controllerRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 55000);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session?.access_token) {
        setError("Please sign in again to use the assistant.");
        return;
      }
      const response = await fetch(apiUrl("/ask-medicine"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
        signal: controller.signal,
        body: JSON.stringify({ question: text.trim(), language, include_medications: includeMedications }),
      });
      if (!response.ok) {
        const messages = {
          401: "Your session expired. Please sign in again.",
          422: "Please check your question and try again.",
          429: "Too many questions. Please wait a minute.",
          504: "The assistant took too long. Please try again.",
        };
        setError(messages[response.status] || "The assistant is unavailable right now. Please try again.");
        return;
      }
      const result = await response.json();
      if (typeof result.answer !== "string" || !result.answer.trim() || result.answer.length > 5000) throw new Error();
      setAnswer(result.answer);
      setContextStatus(result.medication_context_status);
      speak(result.answer);
    } catch (err) {
      setError(err.name === "AbortError" ? "The request timed out or was cancelled. Please try again." : "Unable to reach the assistant. Please try again.");
    } finally {
      clearTimeout(timer);
      pending.current = false;
      setAsking(false);
    }
  };

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError(
        "Voice recognition is not supported in this browser. Please type your question below."
      );
      return;
    }

    window.speechSynthesis?.cancel();

    const recognition = new SpeechRecognition();

    recognitionRef.current = recognition;
    recognition.lang = language === "hinglish" ? "hi-IN" : language;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setListening(true);
      setError("");
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      processQuestion(transcript);
    };

    recognition.onerror = (event) => {
      setError(`Voice recognition error: ${event.error}`);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    try { recognition.start(); } catch { setListening(false); setError("Unable to start the microphone. Please type your question."); }
  };

  const cardStyle = {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "22px",
    marginBottom: "18px",
  };

  const buttonStyle = {
    padding: "12px 20px",
    border: "none",
    borderRadius: "9px",
    cursor: "pointer",
    fontWeight: 600,
  };

  return (
    <div style={{ maxWidth: "950px", margin: "0 auto", color: "#1e293b" }}>
      <div style={{ marginBottom: "22px" }}>
        <h2>AI Health Assistant</h2>
        <p style={{ color: "#64748b" }}>
          Your personal voice assistant for medication management.
        </p>
      </div>

      <div style={{ ...cardStyle, textAlign: "center" }}>
        <div style={{ fontSize: "58px", marginBottom: "10px" }}>
          {listening ? "🎙️" : "🤖"}
        </div>

        <h3>{listening ? "Listening..." : "Talk to MedSage AI"}</h3>

        <p style={{ color: "#64748b" }}>
          Ask about medicine uses, side effects, precautions and safety.
        </p>

        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          style={{
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #cbd5e1",
            marginBottom: "16px",
          }}
        >
          <option value="hinglish">Hinglish</option>
          <option value="en-IN">English</option>
          <option value="hi-IN">हिन्दी</option>
        </select>

        <div>
          <button
            type="button"
            onClick={startListening}
            disabled={listening || asking}
            style={{
              ...buttonStyle,
              background: listening ? "#64748b" : "#0284c7",
              color: "#ffffff",
              fontSize: "16px",
            }}
          >
            {listening ? "Listening..." : "🎤 Start Speaking"}
          </button>
        </div>

        <div style={{ marginTop: "18px" }}>
          <input
            maxLength={1500}
            aria-label="Medicine question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") processQuestion(question);
            }}
            placeholder="Type your question here..."
            style={{
              width: "100%",
              maxWidth: "500px",
              padding: "13px",
              border: "1px solid #cbd5e1",
              borderRadius: "9px",
              boxSizing: "border-box",
            }}
          />

          <button
            type="button"
            onClick={() => processQuestion(question)}
            disabled={asking || listening}
            style={{
              ...buttonStyle,
              background: "#0d9488",
              color: "#ffffff",
              marginTop: "10px",
            }}
          >
            {asking ? "Thinking..." : "Ask Assistant"}
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <label>
          <input type="checkbox" checked={includeMedications} disabled={asking}
            onChange={(event) => setIncludeMedications(event.target.checked)} />{" "}
          Include my active medication schedules in this question (shared with Gemini).
        </label>
        <p>Original prescriptions and dose history are not available to this assistant.</p>
        {contextStatus === "unavailable" && <p role="status">Your medication records could not be accessed. Personal medication details cannot be confirmed.</p>}
      </div>

      <div style={cardStyle}>
        <h3>💬 Assistant Response</h3>

        {asking ? (
          <p>Preparing an educational answer...</p>
        ) : (
          <p style={{ lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{answer}</p>
        )}

        <button
          type="button"
          onClick={() => speak(answer)}
          style={{
            ...buttonStyle,
            background: "#e0f2fe",
            color: "#0369a1",
            marginRight: "8px",
          }}
        >
          🔊 Speak Again
        </button>

        <button
          type="button"
          onClick={() => window.speechSynthesis?.cancel()}
          style={{
            ...buttonStyle,
            background: "#fee2e2",
            color: "#b91c1c",
          }}
        >
          Stop Voice
        </button>
      </div>

      <div style={cardStyle}>
        <h3>💡 Try asking</h3>

        {[
          "What medicines do I have today?",
          "What are common side effects of paracetamol?",
          "Which medicines have low stock?",
          "Dawai ke precautions Hinglish mein samjhaiye.",
          "आज मेरी अगली दवाई कब है?",
          "किन दवाइयों का स्टॉक कम है?",
        ].map((item) => (
          <button
            type="button"
            key={item}
            onClick={() => processQuestion(item)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "11px",
              marginTop: "8px",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              background: "#f8fafc",
              cursor: "pointer",
            }}
          >
            {item}
          </button>
        ))}
      </div>

      {error && (
        <div
          style={{
            ...cardStyle,
            color: "#b91c1c",
            background: "#fef2f2",
          }}
        >
          {error}
        </div>
      )}

      <p style={{ color: "#64748b", fontSize: "12px", marginTop: "18px" }}>
        Educational information, not personalized medical advice. For urgent symptoms, seek immediate emergency care. Always follow
        your doctor's prescription. It does not provide medical diagnosis or
        treatment advice.
      </p>
    </div>
  );
}
