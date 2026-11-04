/**
 * MedSage AI - Demo Authentication Storage Utility
 * 
 * NOTE FOR BEGINNERS & REVIEWERS:
 * This is a client-side DEMO authentication system using browser localStorage.
 * It is designed strictly for frontend development, prototyping, and UI testing.
 * 
 * DISCLAIMER:
 * Never use localStorage authentication for production applications handling
 * sensitive Protected Health Information (PHI). Real healthcare platforms require
 * secure server-side sessions, HIPAA compliance, and encrypted tokens (e.g., Supabase / OAuth).
 */

const STORAGE_USERS_KEY = "medsage_demo_users";
const STORAGE_SESSION_KEY = "medsage_auth_session";

// Pre-configured demo account for convenient testing
const DEFAULT_DEMO_USER = {
  id: "MED-88492",
  name: "Sarah Jenkins",
  email: "demo@medsage.ai",
  mobile: "555-019-2834",
  // Demo password for testing: MedSage123!
  password: "MedSage123!",
  createdAt: "2026-01-15T08:00:00.000Z",
};

/**
 * Retrieves the list of demo registered users from localStorage.
 * Automatically initializes the default demo account if none exist.
 */
export function getRegisteredUsers() {
  try {
    const rawData = localStorage.getItem(STORAGE_USERS_KEY);
    if (!rawData) {
      // Seed default demo user
      const initialUsers = [DEFAULT_DEMO_USER];
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(initialUsers));
      return initialUsers;
    }
    return JSON.parse(rawData);
  } catch (error) {
    console.error("Error reading demo users from localStorage:", error);
    return [DEFAULT_DEMO_USER];
  }
}

/**
 * Registers a new demo user in localStorage.
 */
export function registerDemoUser({ name, email, mobile, password }) {
  try {
    const users = getRegisteredUsers();
    const normalizedEmail = email.trim().toLowerCase();

    // Check if email is already registered
    const existing = users.find(
      (u) => u.email.toLowerCase() === normalizedEmail
    );

    if (existing) {
      return {
        success: false,
        message: "An account with this email address already exists. Please log in.",
      };
    }

    const newUser = {
      id: `MED-${Math.floor(10000 + Math.random() * 90000)}`,
      name: name.trim(),
      email: normalizedEmail,
      mobile: mobile.trim(),
      password: password, // Stored strictly for demo comparison in localStorage
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));

    // Return safe user object (excluding password)
    const safeUser = { ...newUser };
    delete safeUser.password;
    return {
      success: true,
      user: safeUser,
      message: "Demo account created successfully! You can now log in.",
    };
  } catch (error) {
    console.error("Registration error:", error);
    return {
      success: false,
      message: "Unable to save account to localStorage. Please check browser storage permissions.",
    };
  }
}

/**
 * Validates login credentials against registered demo users.
 */
export function authenticateDemoUser(email, password) {
  try {
    const users = getRegisteredUsers();
    const normalizedEmail = email.trim().toLowerCase();

    const matchedUser = users.find(
      (u) => u.email.toLowerCase() === normalizedEmail
    );

    if (!matchedUser) {
      return {
        success: false,
        message: "No account found with this email. Please check your spelling or create an account.",
      };
    }

    if (matchedUser.password !== password) {
      return {
        success: false,
        message: "Incorrect password. Please try again (Demo password is: MedSage123!).",
      };
    }

    // Success: return safe user without password
    const safeUser = { ...matchedUser };
    delete safeUser.password;
    return {
      success: true,
      user: safeUser,
    };
  } catch (error) {
    console.error("Authentication error:", error);
    return {
      success: false,
      message: "An error occurred during authentication. Please try again.",
    };
  }
}

/**
 * Retrieves the currently active user session from localStorage.
 */
export function getActiveSession() {
  try {
    const rawSession = localStorage.getItem(STORAGE_SESSION_KEY);
    if (!rawSession) return null;
    return JSON.parse(rawSession);
  } catch (error) {
    console.error("Error reading active session:", error);
    return null;
  }
}

/**
 * Persists an active user session to localStorage.
 * Password is NEVER saved into the active session object.
 */
export function saveActiveSession(user) {
  try {
    const sessionPayload = {
      id: user.id || "MED-88492",
      name: user.name,
      email: user.email,
      mobile: user.mobile || "",
      loggedInAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(sessionPayload));
    return sessionPayload;
  } catch (error) {
    console.error("Error writing session to localStorage:", error);
    return null;
  }
}

/**
 * Clears the active session from localStorage (Logout).
 */
export function clearActiveSession() {
  try {
    localStorage.removeItem(STORAGE_SESSION_KEY);
  } catch (error) {
    console.error("Error clearing session from localStorage:", error);
  }
}
