# Admin

Routes under `/api/v1/admin` require Authenticate and RequireRole ADMIN.

- `inventory`: SportType/Court CRUD, soft deletion, references and slot policy updates.
- `schedule`: operating hours, TimeSlot regeneration and blackout management.
- `bookings`: cross-owner booking search/detail, reason-required cancellation and date-based statistics.

Mutations and audit commit atomically. Schedule and booking writers share court row locks. No hard deletes or automatic cancellation of existing bookings. See original implementation guide chapters13–14 and OpenAPI0.5.0.
