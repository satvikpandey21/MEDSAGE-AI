import { createClient } from "@supabase/supabase-js";

/**
 * MedSage AI - Supabase Client Configuration
 * 
 * NOTE FOR BEGINNERS:
 * In a Vite + React application, environment variables exposed to the browser
 * must begin with the prefix `VITE_`. They are loaded from `.env.local`
 * and accessed via `import.meta.env.VITE_*`.
 * 
 * IMPORTANT SECURITY RULES:
 * - NEVER put your Supabase `service_role` (secret) key into frontend code.
 * - ONLY use the public `anon` / `publishable` key in frontend client applications.
 */

// Clean and normalize the project URL (strip any trailing slashes or /rest/v1 paths)
const rawUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");

// Retrieve and trim the publishable key
const supabasePublishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ""
).trim();

/**
 * Checks whether valid Supabase credentials have been configured in .env.local
 */
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabasePublishableKey &&
    !supabaseUrl.includes("your-project-id") &&
    !supabasePublishableKey.includes("your-supabase")
);

if (!isSupabaseConfigured) {
  console.info(
    "%c[MedSage AI]%c Supabase credentials are not set yet. Running in demo mode.",
    "color: #0284c7; font-weight: bold;",
    "color: inherit;"
  );
}

/**
 * Official Supabase Client Instance
 * Configured with auto session persistence in browser storage and token refresh.
 */
export const supabase = createClient(
  supabaseUrl || "https://placeholder-project.supabase.co",
  supabasePublishableKey || "placeholder-publishable-key",
  {
    global: {
      fetch: async (input, init) => {
        const response = await globalThis.fetch(input, init);
        const method = (init?.method || "GET").toUpperCase();
        if (response.ok && ["POST", "PATCH", "DELETE", "PUT"].includes(method)) {
          window.dispatchEvent(new Event("medsage:data-changed"));
        }
        return response;
      },
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export default supabase;
