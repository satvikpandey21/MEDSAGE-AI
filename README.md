<div align="center">

# 🩺 MedSage AI

### Intelligent Medication Management & Patient Safety Platform

**From prescriptions to medication schedules, stock alerts, pharmacy-bill checks, and caregiver support — in one web application.**

[**🌐 Launch Live App**](https://medsage-ai.pages.dev) · [**💻 GitHub Repository**](https://github.com/satvikpandey21/MEDSAGE-AI)

![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-149eca?style=flat-square) ![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square) ![Supabase](https://img.shields.io/badge/Database-Supabase-3ecf8e?style=flat-square) ![Gemini](https://img.shields.io/badge/AI-Google%20Gemini-4285f4?style=flat-square)

</div>

> **⚕️ Medical disclaimer:** MedSage AI is an educational software project, **not** a clinically validated medical device. AI-extracted prescription information, bill comparisons, medication information, and reminders may contain errors. Always confirm medicine names, dosages, instructions, and treatment decisions with a qualified healthcare professional. Do not rely on this app for time-critical medication alerts or emergency care.

## 📖 Overview

MedSage AI is a full-stack web application built to help patients organize medications and related records. It combines document analysis, medication scheduling, stock monitoring, pharmacy-bill comparison, browser-based alerts, and caretaker access in a single interface.

The project is designed around a practical question: **How can technology make medication-related information easier to organize, review, and follow?**

## ✨ Features

| Module | What it does |
|---|---|
| **🔐 Authentication & Patient Profile** | Supabase email-based sign-up/login, patient profile, and a profile-completion prompt for newly registered users. |
| **📄 AI Prescription Analysis** | Upload JPG, PNG, or PDF prescriptions; extract available medicine details and other relevant notes such as symptoms, diagnosis, non-medicine instructions, precautions, and follow-up details. |
| **🧾 Pharmacy Bill Checker** | Analyze uploaded pharmacy bills and compare extracted bill information against prescription records, with results such as `matched`, `needs_review`, and `mismatch`. |
| **📅 Medication Schedule** | Create and manage schedules with dosage, frequency, reminder times, date ranges, and optional linkage to verified prescription information. Includes basic medicine-name and dosage-format validation. |
| **🔔 Notification Center** | Persistent, user-scoped in-app events for upcoming doses, due doses, missed doses, low stock, and out-of-stock conditions; unread count and read actions. |
| **⏰ Dose Reminders** | Separate reminders approximately 10 minutes before a scheduled dose and at the scheduled time; missed-dose detection after the configured grace period. |
| **📦 Medicine Stock** | Track remaining medicine quantities, configurable low-stock thresholds, stock alerts, and refills. |
| **🎙️ AI Health Assistant** | Ask medication-related questions by typing or supported browser voice input, with optional medication context and spoken responses. |
| **👥 Caretaker** | Invite, link, and manage approved caretaker access to relevant medication schedules and dose activity, subject to authorization controls. |
| **📊 Dashboard** | View medication-related activity, prescription summaries, upcoming doses, and stock indicators. |

**Reminder limitation:** Notifications are generated while MedSage AI is open. Browser notifications require permission and supported browser APIs; background-tab throttling may delay events. **Closed-browser or device-level delivery is not guaranteed.**

**Validation limitation:** Form validation checks formatting; it does **not** verify that a medicine exists, that a dosage is clinically appropriate, or that medicines are safe to combine. AI outputs and bill-matching results require human review.

## 🧰 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, JavaScript, CSS |
| Backend API | Python, FastAPI, Uvicorn, Pydantic |
| AI analysis | Google Gemini via `google-genai` |
| Authentication | Supabase Auth |
| Database & authorization | Supabase PostgreSQL, Row Level Security (RLS), SQL migrations and database functions |
| File storage | Supabase Storage with access controls and signed URLs |
| Voice | Browser SpeechRecognition / Web Speech synthesis (where supported) |
| In-app alerts | Supabase-backed notifications, browser Notification API |
| Frontend hosting | Cloudflare Pages |
| Backend hosting | Render |
| Version control | Git and GitHub |

## 🏗️ High-Level Architecture

```text
                         ┌───────────────────────────┐
                         │ Patient / Caretaker       │
                         │ Browser (React + Vite)    │
                         └────────────┬──────────────┘
                                      │
                 ┌────────────────────┴──────────────────────┐
                 │                                           │
                 ▼                                           ▼
        ┌──────────────────────┐                 ┌───────────────────────┐
        │ Supabase             │                 │ FastAPI on Render     │
        │ • Auth               │                 │ • Request validation  │
        │ • PostgreSQL + RLS   │                 │ • AI analysis routes  │
        │ • Private storage    │                 │ • AI assistant        │
        │ • Notification data  │                 └──────────┬────────────┘
        └──────────────────────┘                            │
                                                            ▼
                                                ┌───────────────────────┐
                                                │ Google Gemini API     │
                                                └───────────────────────┘
```

The frontend is deployed through Cloudflare Pages and communicates with Supabase and the FastAPI service. Private patient data access must be authorized; API keys and other credentials are configured through environment variables, not committed source files.

## 🔄 Typical User Journey

1. **Register / sign in** and complete the patient profile when prompted.
2. **Upload a prescription** and review AI-extracted information against the original document.
3. **Upload a pharmacy bill** and review any matches or discrepancies alongside prescription details.
4. **Create a medication schedule**, entering medicine, dose, times, and optional stock details.
5. **Use the dashboard and notification bell** to follow upcoming, due, and missed-dose events.
6. **Monitor medicine stock** and refill when quantities run low.
7. **Optionally link a caretaker** and use the AI Health Assistant for general medication information.

## 📁 Repository Structure

```text
MEDSAGE-AI/
├── backend/                       # FastAPI application and AI services
│   ├── main.py
│   ├── config.py
│   ├── services/
│   └── requirements.txt
├── frontend/                      # React + Vite application
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── services/
│   │   └── App.jsx
│   └── package.json
├── supabase/
│   ├── migrations/                # Database schema/security changes
│   └── NOTIFICATION_REFINEMENTS.md
├── .gitignore
└── README.md
```

## 🚀 Run Locally

### Prerequisites

- **Node.js** and npm compatible with the project's Vite version
- **Python 3.11** recommended for the backend
- A configured **Supabase** project
- A **Google Gemini API key** for AI-backed features

### 1. Clone the repository

```bash
git clone https://github.com/satvikpandey21/MEDSAGE-AI.git
cd MEDSAGE-AI
```

### 2. Set up the frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local` with your own development credentials:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
VITE_API_BASE_URL=http://127.0.0.1:8000
```

> Some Supabase projects use a legacy `VITE_SUPABASE_ANON_KEY`; the frontend also supports that fallback. Use a **publishable/anon** key in the browser, **never** a service-role or secret key.

Start the frontend:

```bash
npm run dev
```

### 3. Set up the backend

In another terminal, from the project root:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

```powershell
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
```

```bash
# macOS / Linux
source .venv/bin/activate
```

Install packages:

```bash
pip install -r requirements.txt
```

Create `backend/.env` with the configuration required for your environment:

```dotenv
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
APP_ENV=development
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
PADDLE_OCR_ENABLED=false
```

Start the API:

```bash
uvicorn main:app --reload
```

- Frontend: `http://localhost:5173` (or the URL Vite prints)
- API health: `http://127.0.0.1:8000/health`
- API docs: `http://127.0.0.1:8000/docs`

### 4. Configure the database

The app **requires its Supabase schema, permissions, functions, and storage configuration**; setting environment variables alone is not enough. Review migrations in `supabase/migrations/` and apply them **in order** to your own Supabase project. Review RLS and storage policies before storing patient information. The notification/onboarding migration is `20261110000100_patient_notifications_and_onboarding.sql`; see `supabase/NOTIFICATION_REFINEMENTS.md` for its integration checklist.

**Never execute migration or reset scripts against an existing database without understanding their effects and backing up important data.** Do not commit `.env`, patient documents, medical data, or local backups.

## ✅ Testing

From `frontend/`:

```bash
npm run build
node --test src/lib/*.test.js
```

Some existing ESLint warnings/issues may remain outside the focused refinement checks. A successful build or unit-test run does not replace end-to-end, authentication, RLS, and clinical-safety validation.

## 🔒 Privacy, Security & Limitations

- Patient authentication and access control use Supabase Auth and PostgreSQL RLS.
- Prescription and bill documents are intended to use private storage and authorized access paths.
- Notification records are user-scoped; the schema enforces schedule ownership for inserts and permits patient-scoped updates to read state.
- AI output may misread handwriting, medicine strength, quantities, or clinical instructions.
- Browser-based reminders are **not** a substitute for a reliable alarm or medically approved reminder system.
- Voice recognition and speech output vary by browser and device.
- This is a **student project/prototype**, not a certified healthcare product. Avoid uploading real patient data to a demonstration instance without appropriate consent and safeguards.

## 🌐 Deployment

- **Frontend:** [medsage-ai.pages.dev](https://medsage-ai.pages.dev) — Cloudflare Pages
- **Backend:** [medsage-ai.onrender.com](https://medsage-ai.onrender.com) — Render

Hosted services may have availability or cold-start limitations. Keep production credentials in the respective hosting providers' environment-variable settings.

## 👨‍💻 Developer

**Satvik Pandey**  
B.Tech — Computer Science & Engineering (AI)  
University of Lucknow

- **GitHub:** [@satvikpandey21](https://github.com/satvikpandey21)
- **Project:** [MEDSAGE-AI](https://github.com/satvikpandey21/MEDSAGE-AI)

## 📜 License

No open-source license is currently included in this repository. **Public source-code visibility does not automatically grant permission to reuse or redistribute the code.** A license can be added separately if the maintainer chooses one.

---

<div align="center">

**Built to make medication-related workflows more organized, accessible, and easier to review.**

[Open MedSage AI](https://medsage-ai.pages.dev) · [View Source](https://github.com/satvikpandey21/MEDSAGE-AI)

</div>
