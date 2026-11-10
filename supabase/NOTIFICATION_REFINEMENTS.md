# Notification and profile refinements

The app requires `migrations/20261110000100_patient_notifications_and_onboarding.sql`, after the existing migrations. This migration is prepared for manual review and application only. No migration or database write was executed during implementation.

- Notifications are generated while an authenticated MedSage AI tab is open, every 15 seconds and on window focus. Background tab throttling can delay reminders. There is no push service or reliable closed-browser delivery.
- The 10-minute upcoming event, due event, and missed event have separate keys based on schedule ID and the local scheduled instant. A unique `(patient_id, event_key)` constraint prevents duplicate rows across refreshes/tabs. Browser notifications are emitted only for newly inserted events and only with permission.
- Missed doses retain the 30-minute grace period. Catch-up is bounded to today and the previous local day; it does not create an unlimited history of missed doses. Tomorrow is considered for early reminders crossing midnight. Taken/skipped logs suppress events.
- Stock events use the schedule version (or existing timestamp), stock quantity, and alert kind. Unknown stock is excluded. Alerts link to Stock; dose alerts link to Schedule.
- The panel shows the latest 100 notifications; the unread count and Mark all as read cover all owned rows.
- RLS restricts all notification and onboarding access to the authenticated patient. Notification inserts also verify schedule ownership. Clients may update only `read_at` on notifications, not ownership or content.
- Only auth registrations occurring after migration installation receive an onboarding row. Existing users are deliberately not backfilled. The pending welcome prompt persists until the user chooses a button; either choice acknowledges it, and a complete profile marks it completed. Remind Me Later leaves the profile optional without reopening the popup on every login. Completion checks the existing name, age, gender and phone fields, with no medical-history claims.
- Medicine validation checks formatting only, not medicine authenticity, dosage safety, or clinical suitability. Prescription source JSON and existing verification restrictions are untouched.

## Local validation

Run `npm.cmd run build`, `node --test src/lib/*.test.js`, and targeted ESLint checks from `frontend`.

## Manual integration checks after an operator applies the migration

1. Use two distinct patient accounts: create alerts with one; confirm the other sees none and cannot select/update the first patient's rows or insert a notification for their schedule. Anonymous access must fail.
2. Set a schedule about 10 minutes ahead; observe upcoming and due as separate rows, one browser alert per event with permission. Open a second tab and refresh; confirm no duplicate rows. Take/skip a dose and confirm later alerts stop.
3. Confirm missed-dose logging after 30 minutes, date boundaries, inactive/expired schedules, unknown stock, low stock, depletion and replenishment.
4. Register a new account after migration installation; verify the welcome prompt, both buttons, profile navigation and completed-profile suppression. Existing accounts must never receive the new prompt.
5. Check the bell/panel on mobile and desktop, outside-click/Escape close, keyboard navigation, mark-read persistence, empty state and account switching.

Live RLS, authentication-trigger behavior and browser UI were not exercised against a connected Supabase database during local validation.
