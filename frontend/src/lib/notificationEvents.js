export function localDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Local wall-clock schedule times become actual instants before comparing with dose logs.
export function buildNotificationEvents(schedules, logs, now = new Date()) {
  const events = [];
  for (const schedule of schedules) {
    if (!schedule.is_active) continue;
    if (schedule.stock_quantity != null && Number(schedule.stock_quantity) <= Number(schedule.low_stock_threshold ?? 5)) {
      const kind = Number(schedule.stock_quantity) <= 0 ? "out_of_stock" : "low_stock";
      events.push({ schedule, kind, eventKey: `${schedule.id}:${kind}:${schedule.caretaker_edit_version ?? schedule.updated_at ?? schedule.created_at}:${schedule.stock_quantity}`, title: `${kind === "out_of_stock" ? "Out of stock" : "Low stock"}: ${schedule.medicine_name}`, body: `${schedule.stock_quantity} ${schedule.stock_unit || "units"} remaining. Please arrange a refill.`, target: "stock" });
    }
    if (schedule.frequency === "As needed") continue;
    // Include adjacent days for early reminders before midnight and overdue midnight doses.
    for (const offset of [-1, 0, 1]) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      const key = localDay(day);
      if ((schedule.start_date && key < schedule.start_date) || (schedule.end_date && key > schedule.end_date)) continue;
      for (const time of new Set(schedule.times || [])) {
        if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) continue;
        const [hours, minutes] = time.split(":").map(Number);
        const due = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
        const log = logs.find((item) => item.schedule_id === schedule.id && Math.floor(new Date(item.scheduled_for).getTime() / 60000) === due.getTime() / 60000);
        if (log && log.status !== "missed") continue;
        const age = (now - due) / 60000;
        let kind;
        if (log?.status === "missed" || age > 30) kind = "missed";
        else if (age >= 0) kind = "due";
        else if (age >= -10) kind = "upcoming";
        else continue;
        // Do not replay stale early or due alerts on refresh; bounded missed catch-up only.
        const title = { upcoming: "Upcoming medicine in 10 minutes", due: "Medicine due", missed: "Missed dose" }[kind];
        events.push({ schedule, kind, due, needsMissedLog: kind === "missed" && !log, eventKey: `${schedule.id}:${due.toISOString()}:${kind}`, title: `${title}: ${schedule.medicine_name}`, body: `${schedule.dosage} - Scheduled ${due.toLocaleString()}`, target: "schedule" });
      }
    }
  }
  return events;
}
