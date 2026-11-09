import { countLowStockRows } from "../lib/sidebarCounts";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function useSidebarCounts(userId) {
  const [state, setState] = useState({ counts: {}, loading: true, error: "" });
  useEffect(() => {
    let active = true, inFlight = false, pending = false, debounce;
    if (!userId) return;
    const load = async () => {
      if (inFlight) { pending = true; return; }
      inFlight = true;
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || data.user?.id !== userId) throw new Error("Sign in to view counts.");
        const count = async (table, configure = (q) => q) => {
          const result = await configure(supabase.from(table).select("id", { count: "exact", head: true }).eq("patient_id", userId));
          if (result.error) throw result.error;
          return result.count ?? 0;
        };
        const [prescriptions, schedule, bills, caretaker, stock] = await Promise.all([
          count("patient_prescriptions"), count("medication_schedules", (q) => q.eq("is_active", true)),
          count("patient_bills"), count("caretaker_links", (q) => q.eq("status", "pending")),
          countLowStockRows(async (offset) => {
            const result = await supabase.from("medication_schedules")
              .select("id,stock_quantity,low_stock_threshold").eq("patient_id", userId)
              .eq("is_active", true).order("id").range(offset, offset + 999);
            if (result.error) throw result.error;
            return result.data || [];
          }),
        ]);
        if (active) setState({ userId, counts: { prescriptions, schedule, stock, caretaker, "bill-checker": bills }, loading: false, error: "" });
      } catch (err) {
        if (active) setState({ userId, counts: {}, loading: false, error: err.message || "Counts unavailable" });
      } finally {
        inFlight = false;
        if (pending && active) { pending = false; load(); }
      }
    };
    const refresh = () => { clearTimeout(debounce); debounce = setTimeout(load, 150); };
    load();
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("medsage:data-changed", refresh);
    const channel = supabase.channel(`sidebar-${userId}`);
    for (const table of ["patient_prescriptions", "medication_schedules", "patient_bills", "caretaker_links"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `patient_id=eq.${userId}` }, refresh);
    }
    channel.subscribe(); // Polling/focus remain available if Realtime publication is absent.
    return () => {
      active = false; clearInterval(timer); clearTimeout(debounce);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("medsage:data-changed", refresh);
      supabase.removeChannel(channel);
    };
  }, [userId]);
  return state.userId === userId ? state : { counts: {}, loading: Boolean(userId), error: "" };
}
