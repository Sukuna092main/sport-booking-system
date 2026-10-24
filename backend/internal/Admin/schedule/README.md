# Admin schedule

Register these routes on an authenticated ADMIN route group with
`RegisterWithTimezone(group, db, cfg.AppTimezone)`. `Register` uses the venue
default `Asia/Ho_Chi_Minh`.

Operating hours use ISO weekdays and venue local `HH:mm:ss` times. Overnight
windows are rejected. An empty hours array closes the weekly schedule. Adjacent
windows are allowed; overlapping windows are rejected. The generator emits only
complete slots: 08:00–10:30 with a 60 minute duration yields 08:00–09:00 and
09:00–10:00; the closing 30 minutes are unavailable. This follows the existing
chapter 13 generation algorithm and keeps every template at the court duration.

`RegenerateSlots(ctx, tx, courtID, duration)` is shared with court policy updates.
The caller must lock the court row `FOR UPDATE` first. Old templates and hours
are deactivated and retained. Booking snapshots remain unchanged and Availability
continues subtracting their real intervals from the new templates.

Blackouts may overlap. They prevent new bookings on intersecting intervals but
do not cancel confirmed bookings. PATCH merges supplied endpoints with persisted
values before validating the interval. Timestamp inputs require an offset and
responses use UTC. DELETE is an idempotent soft delete and records an audit only
when the active state changes. JSON bodies use the shared 16 KiB limit.

All mutations lock the court row and commit their audit within the same database
transaction. Parent router middleware enforces authentication and ADMIN role.
