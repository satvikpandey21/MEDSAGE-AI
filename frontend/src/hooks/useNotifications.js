import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { buildNotificationEvents } from "../lib/notificationEvents";

export default function useNotifications(userId) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let busy = false;
    const persistedEvents = new Set();
    async function sync() {
      if (busy || cancelled) return;
      busy = true;
      try {
        const from = new Date();
        from.setDate(from.getDate() - 2);
        const [schedules, logs] = await Promise.all([
          supabase.from("medication_schedules").select("*").eq("patient_id", userId).eq("is_active", true),
          supabase.from("medication_dose_logs").select("*").eq("patient_id", userId).gte("scheduled_for", from.toISOString()),
        ]);
        if (schedules.error || logs.error) throw schedules.error || logs.error;
        for (const event of buildNotificationEvents(schedules.data || [], logs.data || [])) {
          if (cancelled) return;
          if (persistedEvents.has(event.eventKey)) continue;
          if (event.needsMissedLog) {
            const result = await supabase.from("medication_dose_logs").insert({ patient_id: userId, schedule_id: event.schedule.id, scheduled_for: event.due.toISOString(), status: "missed" });
            if (result.error && result.error.code !== "23505") throw result.error;
            // Recheck on the next poll so a concurrent taken-dose log wins.
            if (result.error) continue;
          }
          const result = await supabase.from("patient_notifications").upsert({ patient_id: userId, schedule_id: event.schedule.id, event_key: event.eventKey, kind: event.kind, title: event.title, body: event.body, target: event.target }, { onConflict: "patient_id,event_key", ignoreDuplicates: true }).select("id");
          if (result.error) throw result.error;
          persistedEvents.add(event.eventKey);
          if (!cancelled && result.data?.length && "Notification" in window && Notification.permission === "granted") {
            try { new Notification(event.title, { body: event.body, tag: `${userId}:${event.eventKey}` }); } catch { /* In-app delivery remains available. */ }
          }
        }
        if (cancelled) return;
        const result = await supabase.from("patient_notifications").select("*").eq("patient_id", userId).order("created_at", { ascending: false }).limit(100);
        if (result.error) throw result.error;
        const countResult = await supabase.from("patient_notifications").select("id", { count: "exact", head: true }).eq("patient_id", userId).is("read_at", null);
        if (countResult.error) throw countResult.error;
        if (!cancelled) { setItems(result.data || []); setUnread(countResult.count || 0); setError(""); }
      } catch {
        if (!cancelled) setError("Notifications could not be loaded. Please retry shortly.");
      } finally { busy = false; }
    }
    sync();
    const timer = setInterval(sync, 15000);
    window.addEventListener("focus", sync);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener("focus", sync); };
  }, [userId]);
  const markRead = useCallback(async (id) => {
    let query = supabase.from("patient_notifications").update({ read_at: new Date().toISOString() }).eq("patient_id", userId).is("read_at", null);
    if (id) query = query.eq("id", id);
    const result = await query.select("id");
    if (result.error) { setError("Could not mark notifications as read. Please try again."); return; }
    const countResult = await supabase.from("patient_notifications").select("id", { count: "exact", head: true }).eq("patient_id", userId).is("read_at", null);
    if (!countResult.error) setUnread(countResult.count || 0);
    setItems((previous) => previous.map((item) => !id || item.id === id ? { ...item, read_at: item.read_at || new Date().toISOString() } : item));
  }, [userId]);
  return { items, error, markRead, unread };
}
