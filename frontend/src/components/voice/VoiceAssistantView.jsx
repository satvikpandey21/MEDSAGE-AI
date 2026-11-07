import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const getTodayKey = () => {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const formatTime = (time) => {
  if (!time) return "Time not specified";

  const [hours, minutes] = time.split(":").map(Number);

  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function VoiceAssistantView() {
  const [medicines, setMedicines] = useState([]);
  const [doseLogs, setDoseLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listening, setListening] = useState(false);
  const [language, setLanguage] = useState("en-IN");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(
    "Hello! I am your MedSage AI assistant. You can ask me about your medicines, doses and stock."
  );
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Please login again.");
      }

      const userId = authData.user.id;

      const { data: medicineData, error: medicineError } = await supabase
        .from("medication_schedules")
        .select("*")
        .eq("patient_id", userId)
        .eq("is_active", true);

      if (medicineError) throw medicineError;

      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const end = new Date();
      end.setHours(23, 59, 59, 999);

      const { data: logData, error: logError } = await supabase
        .from("medication_dose_logs")
        .select("*")
        .eq("patient_id", userId)
        .gte("scheduled_for", start.toISOString())
        .lte("scheduled_for", end.toISOString());

      if (logError) throw logError;

      setMedicines(medicineData || []);
      setDoseLogs(logData || []);
    } catch (err) {
      setError(err.message || "Unable to load medication information.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const speak = (text, lang = language) => {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = lang;
    speech.rate = 0.95;
    speech.pitch = 1;

    window.speechSynthesis.speak(speech);
  };

  const getTodayDoses = () => {
    const today = getTodayKey();
    const now = new Date();

    return medicines.flatMap((medicine) => {
      if (medicine.frequency === "As needed") return [];

      if (medicine.start_date && medicine.start_date > today) return [];
      if (medicine.end_date && medicine.end_date < today) return [];

      return (medicine.times || []).map((time) => {
        const scheduled = new Date(`${today}T${time}:00`);

        const log = doseLogs.find(
          (item) =>
            item.schedule_id === medicine.id &&
            new Date(item.scheduled_for).getTime() === scheduled.getTime()
        );

        return {
          medicine,
          time,
          scheduled,
          status: log?.status || (
            scheduled.getTime() < now.getTime() - 30 * 60000
              ? "missed"
              : scheduled.getTime() <= now.getTime()
              ? "due"
              : "upcoming"
          ),
        };
      });
    }).sort((a, b) => a.scheduled - b.scheduled);
  };

  const processQuestion = async (text) => {
    if (!text.trim()) return;

    setQuestion(text);
    setError("");

    const query = text.toLowerCase();
    const hindi = /[\u0900-\u097F]/.test(text);
    const responseLang = hindi ? "hi-IN" : "en-IN";

    if (medicines.length === 0) {
      const response = hindi
        ? "Aapke account mein abhi koi active medicine schedule nahi hai."
        : "You do not have any active medication schedules.";

      setAnswer(response);
      speak(response, responseLang);
      return;
    }

    let response = "";

    const todayDoses = getTodayDoses();

    if (
      query.includes("stock") ||
      query.includes("refill") ||
      query.includes("स्टॉक") ||
      query.includes("दवाई खत्म") ||
      query.includes("कम दवाई")
    ) {
      const lowStock = medicines.filter(
        (medicine) =>
          medicine.stock_quantity !== null &&
          medicine.stock_quantity !== undefined &&
          Number(medicine.stock_quantity) <=
            Number(medicine.low_stock_threshold ?? 5)
      );

      if (!lowStock.length) {
        response = hindi
          ? "Aapki kisi bhi medicine ka stock low nahi hai."
          : "None of your medicines currently have low stock.";
      } else {
        response = hindi
          ? "Aapki low stock medicines hain: "
          : "Your low stock medicines are: ";

        response += lowStock
          .map((medicine) => {
            const stock = Number(medicine.stock_quantity);

            return `${medicine.medicine_name}: ${
              stock <= 0 ? "Out of stock" : `${stock} ${medicine.stock_unit}`
            }`;
          })
          .join(". ");
      }
    } else if (
      query.includes("next") ||
      query.includes("upcoming") ||
      query.includes("अगली") ||
      query.includes("अगली दवाई") ||
      query.includes("कब लेनी")
    ) {
      const nextDose = todayDoses.find(
        (dose) =>
          dose.scheduled > new Date() &&
          dose.status === "upcoming"
      );

      if (!nextDose) {
        response = hindi
          ? "Aaj ke liye koi upcoming dose nahi hai."
          : "You have no upcoming doses scheduled for today.";
      } else {
        response = hindi
          ? `Aapki agli medicine ${nextDose.medicine.medicine_name} hai. Iska time ${formatTime(nextDose.time)} hai.`
          : `Your next medicine is ${nextDose.medicine.medicine_name}. It is scheduled for ${formatTime(nextDose.time)}.`;
      }
    } else if (
      query.includes("today") ||
      query.includes("schedule") ||
      query.includes("medicine") ||
      query.includes("medicines") ||
      query.includes("दवाई") ||
      query.includes("दवाइयां") ||
      query.includes("आज")
    ) {
      if (!todayDoses.length) {
        response = hindi
          ? "Aaj koi medicine scheduled nahi hai."
          : "No medicines are scheduled for today.";
      } else {
        response = hindi
          ? "Aaj ka aapka medicine schedule: "
          : "Here is your medicine schedule for today: ";

        response += todayDoses
          .map(
            (dose) =>
              `${dose.medicine.medicine_name} at ${formatTime(dose.time)}, status ${dose.status}`
          )
          .join(". ");
      }
    } else if (
      query.includes("taken") ||
      query.includes("missed") ||
      query.includes("skipped") ||
      query.includes("ली") ||
      query.includes("छूट")
    ) {
      const taken = todayDoses.filter((dose) => dose.status === "taken").length;
      const skipped = todayDoses.filter((dose) => dose.status === "skipped").length;
      const missed = todayDoses.filter((dose) => dose.status === "missed").length;

      response = hindi
        ? `Aaj aapne ${taken} doses li hain, ${skipped} skip ki hain aur ${missed} miss hui hain.`
        : `Today you have taken ${taken} doses, skipped ${skipped}, and missed ${missed}.`;
    } else {
      response = hindi
        ? "Main aapki medicines, next dose, daily schedule aur stock ke baare mein bata sakta hoon. Kripya dobara poochhein."
        : "I can help you with your medicines, next dose, daily schedule and stock. Please try asking another question.";
    }

    setAnswer(response);
    speak(response, responseLang);
  };

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError(
        "Voice recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge."
      );
      return;
    }

    window.speechSynthesis?.cancel();

    const recognition = new SpeechRecognition();

    recognition.lang = language;
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

    recognition.start();
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
          Ask about your medicines, upcoming doses and stock.
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
          <option value="en-IN">English</option>
          <option value="hi-IN">हिन्दी</option>
        </select>

        <div>
          <button
            type="button"
            onClick={startListening}
            disabled={listening || loading}
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
            disabled={loading}
            style={{
              ...buttonStyle,
              background: "#0d9488",
              color: "#ffffff",
              marginTop: "10px",
            }}
          >
            Ask Assistant
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <h3>💬 Assistant Response</h3>

        {loading ? (
          <p>Loading your medication information...</p>
        ) : (
          <p style={{ lineHeight: 1.8 }}>{answer}</p>
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
          "When is my next dose?",
          "Which medicines have low stock?",
          "How many doses have I taken today?",
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

      <button
        type="button"
        onClick={loadData}
        disabled={loading}
        style={{
          ...buttonStyle,
          background: "#e2e8f0",
          color: "#334155",
        }}
      >
        ↻ Refresh Medication Data
      </button>

      <p style={{ color: "#64748b", fontSize: "12px", marginTop: "18px" }}>
        MedSage AI provides medication schedule information only. Always follow
        your doctor's prescription. It does not provide medical diagnosis or
        treatment advice.
      </p>
    </div>
  );
}