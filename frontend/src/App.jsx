import WelcomeProfileModal from "./components/profile/WelcomeProfileModal";
import { useState, useEffect } from "react";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import ScheduleView from "./components/schedule/ScheduleView";
import DashboardView from "./components/dashboard/DashboardView";
import SettingsView from "./components/settings/SettingsView";
import PatientProfileView from "./components/profile/PatientProfileView";
import PrescriptionView from "./components/prescriptions/PrescriptionView";
import SectionPlaceholder from "./components/common/SectionPlaceholder";
import LoginPage from "./components/auth/LoginPage";
import MedicineStockView from "./components/stock/MedicineStockView";
import RegisterPage from "./components/auth/RegisterPage";
import Icon from "./components/common/Icons";
import useSidebarCounts from "./hooks/useSidebarCounts";
import useDashboardData from "./hooks/useDashboardData";
import CaretakerView from "./components/Caretaker/CaretakerView";
import VoiceAssistantView from "./components/voice/VoiceAssistantView";
import BillCheckerView from "./components/bills/BillCheckerView";
import {
  getInitialSession,
  subscribeToAuthChanges,
  signOutUser,
} from "./services/authService";
import { supabase } from "./lib/supabase";
import {
  dashboardMetrics,
  initialSchedule,
  lowStockMedications,
  recentActivities,
  navItems,
} from "./data/mockData";
import "./styles/variables.css";
import "./styles/layout.css";
import "./styles/dashboard.css";
import "./styles/auth.css";
import "./styles/profile.css";
import "./App.css";

/**
 * Main MedSage AI Application Component (Powered by Supabase Auth)
 *
 * NOTE FOR BEGINNERS:
 * This component coordinates:
 * 1. Real Supabase Authentication State (Login, Registration, Cloud Session)
 * 2. Active Screen Navigation (Dashboard, Settings, Prescriptions, etc.)
 * 3. Schedule interactions (Marking doses as taken)
 * 4. Responsive mobile sidebar drawer
 */
function App() {
  // Authentication state managed directly via Supabase
  const [currentUser, setCurrentUser] = useState(null);
  const dashboardData = useDashboardData(Boolean(currentUser), currentUser?.rawId || null);
  const sidebarData = useSidebarCounts(currentUser?.rawId || currentUser?.id);

const todayAdherence =
  dashboardData.schedule.length > 0 &&
  !dashboardData.loading &&
  !dashboardData.error
    ? Math.round(
        (dashboardData.schedule.filter(
          (dose) => dose.status === "taken"
        ).length /
          dashboardData.schedule.length) *
          100
      )
    : null;
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Auth screen toggling: 'login' | 'register'
  const [authView, setAuthView] = useState("login");

  // Pre-filled email and notice message when redirecting from register to login
  const [prefilledEmail, setPrefilledEmail] = useState("");
  const [registrationNotice, setRegistrationNotice] = useState("");

  // Navigation state within the platform (defaults to 'dashboard')
  const [activeNav, setActiveNav] = useState(() => {
  return localStorage.getItem("medsage_active_nav") || "dashboard";
});
useEffect(() => {
  localStorage.setItem("medsage_active_nav", activeNav);
}, [activeNav]);

  // Mobile drawer state (open / closed)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Medication schedule state
  const [schedule, setSchedule] = useState(initialSchedule);

  // Recent activity logs state
  const [activities, setActivities] = useState(recentActivities);

  // Helper to enrich authenticated user with patient_profiles data
  const enrichUserWithProfile = async (baseUser) => {
    if (!baseUser) return null;
    const userId = baseUser.rawId || baseUser.id;
    try {
      const { data } = await supabase
        .from("patient_profiles")
        .select("patient_id, full_name, phone")
        .eq("id", userId)
        .maybeSingle();

      if (data) {
        return {
          ...baseUser,
          id: data.patient_id || baseUser.id,
          name: data.full_name || baseUser.name,
          mobile: data.phone || baseUser.mobile,
        };
      }
    } catch {
      // Fallback gracefully to base auth metadata
    }
    return baseUser;
  };

  // Initialize and synchronize with Supabase Authentication session
  useEffect(() => {
    let isMounted = true;

    // 1. Fetch current active session from Supabase on mount
    getInitialSession().then(async ({ user }) => {
      if (!isMounted) return;
      if (user) {
        const enriched = await enrichUserWithProfile(user);
        if (isMounted) setCurrentUser(enriched);
      } else {
        if (isMounted) setCurrentUser(null);
      }
      if (isMounted) setIsInitialLoading(false);
    });

    // 2. Subscribe to auth changes (sign in, sign out, token refresh)
    const unsubscribe = subscribeToAuthChanges(async (_event, _newSession, newUser) => {
      if (!isMounted) return;
      if (newUser) {
        const enriched = await enrichUserWithProfile(newUser);
        if (isMounted) setCurrentUser(enriched);
      } else {
        if (isMounted) setCurrentUser(null);
      }
      if (isMounted) setIsInitialLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Handler: Successful Login
  const handleLoginSuccess = async (user) => {
    const enriched = await enrichUserWithProfile(user);
    setCurrentUser(enriched || user);
    setActiveNav("dashboard");
    setRegistrationNotice("");
  };

  // Handler: Successful Registration
  const handleRegisterSuccess = (newUser, requiresEmailConfirmation) => {
    setPrefilledEmail(newUser?.email || "");
    if (requiresEmailConfirmation) {
      setRegistrationNotice(
        `Account created! If email confirmation is enabled on your Supabase project, please check your inbox to confirm before logging in.`
      );
    } else {
      setRegistrationNotice(
        `Account created successfully! Please enter your password to log in.`
      );
    }
    setAuthView("login");
  };

  // Handler: User Logout via Supabase
  const handleLogout = async () => {
    const result = await signOutUser();
    if (!result.success) return result;
    setCurrentUser(null);
    setAuthView("login");
    setActiveNav("dashboard");
    localStorage.removeItem("medsage_active_nav");
    localStorage.setItem("medsage_active_nav", "dashboard");
    setRegistrationNotice("");
    setPrefilledEmail("");
    window.history.pushState(null, "", window.location.pathname);
    return { success: true };
  };

  // Handler: Synchronize updated profile across application UI
  const handleProfileUpdated = (updatedProfile) => {
    setCurrentUser((prev) => ({
      ...prev,
      name: updatedProfile.name || prev?.name,
      id: updatedProfile.id || prev?.id,
      mobile: updatedProfile.mobile || prev?.mobile,
    }));
  };

  // Handler: Mark a scheduled dose as taken
  const handleMarkTaken = (doseId) => {
    const targetItem = schedule.find((item) => item.id === doseId);

    setSchedule((prevSchedule) =>
      prevSchedule.map((item) =>
        item.id === doseId ? { ...item, status: "taken" } : item
      )
    );

    if (targetItem) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      const newActivity = {
        id: `act-${Date.now()}`,
        type: "dose_taken",
        title: "Dose Logged Successfully",
        description: `Marked ${targetItem.medicineName} (${targetItem.dosage}) as taken at ${timeStr}.`,
        timeAgo: "Just now",
        badge: "Logged",
        badgeType: "success",
      };

      setActivities((prev) => [newActivity, ...prev]);
    }
  };

  // ============================================================
  // SCENARIO 0: INITIAL SESSION VERIFICATION LOADING SCREEN
  // ============================================================
  if (isInitialLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--bg-app)",
          gap: "16px",
        }}
      >
        <div
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "var(--radius-md)",
            background: "linear-gradient(135deg, #0284c7 0%, #0d9488 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)",
          }}
        >
          <Icon name="heartPulse" size={28} color="#ffffff" />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "var(--text-secondary)",
            fontSize: "0.95rem",
            fontWeight: 600,
          }}
        >
          <Icon name="refresh" size={16} className="spin-icon" color="#0284c7" />
          <span>Connecting to MedSage AI...</span>
        </div>
      </div>
    );
  }

  // ============================================================
  // SCENARIO 1: USER IS NOT LOGGED IN -> RENDER AUTH SCREENS
  // ============================================================
  if (!currentUser) {
    if (authView === "register") {
      return (
        <RegisterPage
          onSwitchToLogin={() => {
            setAuthView("login");
            setRegistrationNotice("");
          }}
          onRegisterSuccess={handleRegisterSuccess}
        />
      );
    }

    return (
      <LoginPage
        onSwitchToRegister={() => {
          setAuthView("register");
          setRegistrationNotice("");
        }}
        onLoginSuccess={handleLoginSuccess}
        initialEmail={prefilledEmail}
        registrationNotice={registrationNotice}
      />
    );
  }
const dynamicNavItems = navItems.map((item) => {
  const count = sidebarData.counts[item.id];
  return { ...item, badge: sidebarData.loading || sidebarData.error || count == null
    ? null : item.id === "stock" && count > 0 ? `${count} Low` : String(count) };
});
  // ============================================================
  // SCENARIO 2: USER IS LOGGED IN -> RENDER PROTECTED PLATFORM
  // ============================================================
  const currentNavItem = navItems.find((item) => item.id === activeNav);

  return (
    <div className="app-layout">
      <WelcomeProfileModal key={currentUser.rawId} userId={currentUser.rawId} onNavigate={setActiveNav} />
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
      navItems={dynamicNavItems}
      badgesLoading={sidebarData.loading}
      badgesError={sidebarData.error}
        activeNav={activeNav}
        onNavSelect={(navId) => setActiveNav(navId)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        currentUser={currentUser}
      />

      {/* 2. Main Application Content Area */}
      <div className="app-main">
        {/* Top Header Bar */}
       <Topbar key={currentUser.rawId}
  onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
  currentUser={currentUser}
  onNavSelect={(navId) => setActiveNav(navId)}
  adherenceRate={todayAdherence}
/>

        {/* Dynamic Page Content */}
        <main key={currentUser.rawId} className="page-container">
          {activeNav === "dashboard" ? (
           <DashboardView
  currentUser={currentUser}
  dashboardData={dashboardData}
/>
          ) : activeNav === "profile" ? (
            <PatientProfileView
              currentUser={currentUser}
              onProfileUpdated={handleProfileUpdated}
            />
              ) : activeNav === "prescriptions" ? (
            <PrescriptionView />
            ) : activeNav === "bill-checker" ? (
            <BillCheckerView />
            ) : activeNav === "schedule" ? (
            <ScheduleView />
            ) : activeNav === "stock" ? (
  <MedicineStockView />
            ) : activeNav === "ai-assistant" ? (
            <VoiceAssistantView />
            ) : activeNav === "caretaker" ? (
  <CaretakerView key={currentUser?.rawId || currentUser?.id} currentUser={currentUser} />
            ) : activeNav === "settings" ? (
            <SettingsView
              currentUser={currentUser}
              onLogout={handleLogout}
            />
          ) : (
            <SectionPlaceholder
              title={currentNavItem?.label || "Feature"}
              icon={currentNavItem?.icon || "info"}
              onReturnToDashboard={() => setActiveNav("dashboard")}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
