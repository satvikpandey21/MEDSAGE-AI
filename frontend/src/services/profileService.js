import { supabase, isSupabaseConfigured } from "../lib/supabase";

/**
 * MedSage AI - Patient Profile Service
 * 
 * NOTE FOR BEGINNERS:
 * This service directly interacts with the `public.patient_profiles` table in Supabase.
 * Row Level Security (RLS) ensures that patients can ONLY read and write their OWN profile,
 * matching `auth.uid() = id`.
 */

/**
 * Generates a clean fallback patient ID if the database trigger has not set one.
 */
function generatePatientId(userId) {
  const shortHex = userId ? userId.replace(/-/g, "").substring(0, 5).toUpperCase() : "88492";
  return `MED-${shortHex}`;
}

/**
 * Fetches the patient profile for the authenticated user from Supabase.
 * If the profile row does not exist yet, initializes a default record.
 */
export async function getPatientProfile(userId, fallbackUser = null) {
  if (!isSupabaseConfigured) {
    return {
      success: false,
      error: "Supabase client is not configured.",
    };
  }

  if (!userId) {
    return {
      success: false,
      error: "No authenticated user ID provided.",
    };
  }

  try {
    // Query public.patient_profiles matching user's authenticated UUID
    const { data, error } = await supabase
      .from("patient_profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching patient profile:", error);
      return { success: false, error: error.message };
    }

    // If profile row exists in Supabase
    if (data) {
      return {
        success: true,
        profile: {
          id: data.id,
          patientId: data.patient_id || generatePatientId(userId),
          fullName: data.full_name || fallbackUser?.name || "",
          age: data.age !== null && data.age !== undefined ? String(data.age) : "",
          gender: data.gender || "",
          phone: data.phone || fallbackUser?.mobile || "",
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      };
    }

    // If no row exists yet (e.g. signup trigger did not run for this user),
    // provide initial profile state from auth metadata
    const initialPatientId = generatePatientId(userId);
    const initialName = fallbackUser?.name || fallbackUser?.user_metadata?.full_name || "";
    const initialPhone = fallbackUser?.mobile || fallbackUser?.user_metadata?.mobile || "";

    return {
      success: true,
      isNew: true,
      profile: {
        id: userId,
        patientId: initialPatientId,
        fullName: initialName,
        age: "",
        gender: "",
        phone: initialPhone,
      },
    };
  } catch (err) {
    console.error("Unexpected error in getPatientProfile:", err);
    return {
      success: false,
      error: err.message || "Failed to load patient profile from Supabase.",
    };
  }
}

/**
 * Saves and updates the patient's profile in public.patient_profiles in Supabase.
 */
export async function updatePatientProfile(userId, profileData) {
  if (!isSupabaseConfigured) {
    return {
      success: false,
      error: "Supabase client is not configured.",
    };
  }

  if (!userId) {
    return {
      success: false,
      error: "Cannot update profile: missing authenticated user ID.",
    };
  }

  try {
    // Parse age safely (integer or null)
    let parsedAge = null;
    if (profileData.age !== "" && profileData.age !== null && profileData.age !== undefined) {
      const num = parseInt(profileData.age, 10);
      if (!isNaN(num) && num > 0 && num <= 130) {
        parsedAge = num;
      }
    }

    const payload = {
      id: userId,
      full_name: (profileData.fullName || "").trim(),
      age: parsedAge,
      gender: profileData.gender || null,
      phone: (profileData.phone || "").trim(),
      updated_at: new Date().toISOString(),
    };

    // If patient_id is present or needed, include it
    if (profileData.patientId) {
      payload.patient_id = profileData.patientId;
    }

    // Upsert into public.patient_profiles matching user's ID
    const { data, error } = await supabase
      .from("patient_profiles")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      console.error("Error updating patient profile:", error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      profile: {
        id: data.id,
        patientId: data.patient_id || profileData.patientId || generatePatientId(userId),
        fullName: data.full_name || "",
        age: data.age !== null && data.age !== undefined ? String(data.age) : "",
        gender: data.gender || "",
        phone: data.phone || "",
        updatedAt: data.updated_at,
      },
      message: "Patient profile saved successfully to Supabase!",
    };
  } catch (err) {
    console.error("Unexpected error in updatePatientProfile:", err);
    return {
      success: false,
      error: err.message || "Failed to update profile.",
    };
  }
}
