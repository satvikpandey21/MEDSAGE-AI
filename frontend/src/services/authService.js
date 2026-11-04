import { supabase, isSupabaseConfigured } from "../lib/supabase";

/**
 * MedSage AI - Supabase Authentication Service
 * 
 * NOTE FOR BEGINNERS:
 * This service handles all communication between the MedSage AI React UI
 * and the Supabase backend authentication API.
 */

/**
 * Formats a Supabase User object into a standardized patient profile
 * used across MedSage AI components.
 */
export function formatSupabaseUser(user) {
  if (!user) return null;

  const metadata = user.user_metadata || {};
  const fullName =
    metadata.full_name ||
    metadata.name ||
    (user.email ? user.email.split("@")[0] : "Patient");

  // Generate a clean readable patient ID from user's UUID prefix
  const shortId = user.id ? user.id.replace(/-/g, "").substring(0, 5).toUpperCase() : "88492";

  return {
    id: `MED-${shortId}`,
    rawId: user.id,
    name: fullName,
    email: user.email || "",
    mobile: metadata.mobile || "",
    createdAt: user.created_at,
    adherenceRate: 94, // Demonstration metric
  };
}

/**
 * Sign in an existing user with email and password via Supabase.
 */
export async function signInWithEmail(email, password) {
  if (!isSupabaseConfigured) {
    return {
      success: false,
      error: "Supabase is not configured. Please check your .env.local file.",
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      // Map common Supabase error codes into friendly user messages
      let friendlyMessage = error.message;

      if (error.message.includes("Invalid login credentials")) {
        friendlyMessage = "Incorrect email or password. Please verify your credentials or create an account.";
      } else if (error.message.includes("Email not confirmed")) {
        friendlyMessage = "Your email has not been confirmed yet. Please check your inbox for the Supabase verification link, or disable email confirmation in your Supabase dashboard.";
      }

      return {
        success: false,
        error: friendlyMessage,
      };
    }

    return {
      success: true,
      user: formatSupabaseUser(data.user),
      session: data.session,
    };
  } catch (err) {
    console.error("Supabase signIn error:", err);
    return {
      success: false,
      error: err.message || "An unexpected network error occurred while connecting to Supabase.",
    };
  }
}

/**
 * Register a new user with email, password, full name, and mobile via Supabase.
 */
export async function signUpWithEmail({ email, password, fullName, mobile }) {
  if (!isSupabaseConfigured) {
    return {
      success: false,
      error: "Supabase is not configured. Please check your .env.local file.",
    };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          mobile: mobile ? mobile.trim() : "",
        },
      },
    });

    if (error) {
      let friendlyMessage = error.message;
      if (error.message.includes("User already registered")) {
        friendlyMessage = "An account with this email address already exists. Please log in instead.";
      }
      return {
        success: false,
        error: friendlyMessage,
      };
    }

    // Check if session was returned immediately (email confirmation disabled)
    // or if session is null (email confirmation is enabled in Supabase project)
    const requiresEmailConfirmation = !data.session;

    return {
      success: true,
      user: formatSupabaseUser(data.user),
      session: data.session,
      requiresEmailConfirmation,
      message: requiresEmailConfirmation
        ? "Account created successfully! If email confirmation is enabled on your Supabase project, please check your inbox to confirm your email before logging in."
        : "Account created successfully! Logging you in...",
    };
  } catch (err) {
    console.error("Supabase signUp error:", err);
    return {
      success: false,
      error: err.message || "An unexpected error occurred during registration.",
    };
  }
}

/**
 * Log out the currently authenticated user from Supabase.
 */
export async function signOutUser() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn("Supabase signOut error:", error.message);
    }
    return { success: true };
  } catch (err) {
    console.error("Supabase signOut error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Send password reset email via Supabase.
 */
export async function sendPasswordResetEmail(email) {
  if (!isSupabaseConfigured) {
    return {
      success: false,
      error: "Supabase credentials are not configured.",
    };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      message: "Password reset link sent! Check your inbox.",
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Retrieve current active session from Supabase client.
 */
export async function getInitialSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return {
      session,
      user: session?.user ? formatSupabaseUser(session.user) : null,
    };
  } catch (err) {
    console.error("Error retrieving Supabase session:", err);
    return { session: null, user: null };
  }
}

/**
 * Subscribes to real-time authentication changes (sign in, sign out, token refresh).
 */
export function subscribeToAuthChanges(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      const user = session?.user ? formatSupabaseUser(session.user) : null;
      callback(event, session, user);
    }
  );

  return () => {
    subscription.unsubscribe();
  };
}
