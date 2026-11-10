import test from "node:test";
import assert from "node:assert/strict";
import { buildNotificationEvents, localDay } from "./notificationEvents.js";
const day = new Date(2026, 10, 10, 9, 0);
const schedule = { id: "s1", is_active: true, medicine_name: "Medicine", dosage: "500 mg", start_date: localDay(day), end_date: localDay(day), times: ["09:00"], frequency: "Once daily" };
const eventsAt = (hours, minutes, logs = [], overrides = {}) => buildNotificationEvents([{ ...schedule, ...overrides }], logs, new Date(2026, 10, 10, hours, minutes));
test("upcoming, due and missed events have separate stable keys", () => {
  assert.equal(eventsAt(8, 49).length, 0);
  const early = eventsAt(8, 50)[0];
  const due = eventsAt(9, 0)[0];
  assert.equal(early.kind, "upcoming");
  assert.equal(due.kind, "due");
  assert.equal(eventsAt(9, 30)[0].kind, "due");
  assert.equal(eventsAt(9, 31)[0].kind, "missed");
  assert.equal(early.eventKey, eventsAt(8, 58)[0].eventKey);
  assert.notEqual(early.eventKey, due.eventKey);
  assert.equal(eventsAt(10, 0)[0].kind, "missed");
});
test("taken and skipped logs suppress reminders including nonzero historical seconds", () => {
  for (const status of ["taken", "skipped"])
    assert.equal(eventsAt(10, 0, [{ schedule_id: "s1", scheduled_for: new Date(2026, 10, 10, 9, 0, 20).toISOString(), status }]).length, 0);
});
test("respects active, start/end dates and as-needed schedules", () => {
  for (const overrides of [{ is_active: false }, { start_date: "2026-11-11" }, { end_date: "2026-11-09" }, { frequency: "As needed" }, { times: ["25:00", "bad"] }])
    assert.equal(eventsAt(9, 0, [], overrides).length, 0);
});
test("handles next-day early dose and previous-day missed dose in local timezone", () => {
  const s = { ...schedule, times: ["00:05"], start_date: "2026-11-11", end_date: "2026-11-11" };
  const event = buildNotificationEvents([s], [], new Date(2026, 10, 10, 23, 55))[0];
  assert.equal(event.kind, "upcoming");
  assert.equal(event.due.getDate(), 11);
  assert.equal(buildNotificationEvents([s], [], new Date(2026, 10, 12, 0, 1))[0].kind, "missed");
});
test("stock distinguishes unknown, low and depleted stock; duplicate times collapse", () => {
  assert.equal(eventsAt(8, 0, [], { stock_quantity: null }).length, 0);
  assert.equal(eventsAt(8, 0, [], { stock_quantity: 3 })[0].kind, "low_stock");
  assert.equal(eventsAt(8, 0, [], { stock_quantity: 0 })[0].kind, "out_of_stock");
  assert.equal(eventsAt(9, 0, [], { times: ["09:00", "09:00"] }).length, 1);
});
