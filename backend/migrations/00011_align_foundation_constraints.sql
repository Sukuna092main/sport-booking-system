-- +goose Up
-- Align the handed-over schema with the approved ERD v1.0.
-- Preflight on an existing DB: resolve NULL request_hash and overlapping active
-- hours/templates with their owner before applying. Do not invent historical hashes.
ALTER TABLE booking_slots DROP CONSTRAINT bslots_slot_date_uk;
CREATE UNIQUE INDEX bslots_active_slot_date_uk
    ON booking_slots (time_slot_id, booking_date) WHERE released_at IS NULL;

ALTER TABLE bookings ALTER COLUMN request_hash SET NOT NULL;

ALTER TABLE court_operating_hours ADD CONSTRAINT coh_no_active_overlap
    EXCLUDE USING gist (
        court_id WITH =, weekday WITH =,
        numrange(EXTRACT(EPOCH FROM opens_at), EXTRACT(EPOCH FROM closes_at), '[)') WITH &&
    ) WHERE (is_active);

ALTER TABLE time_slots ADD CONSTRAINT ts_no_active_overlap
    EXCLUDE USING gist (
        court_id WITH =, weekday WITH =,
        numrange(EXTRACT(EPOCH FROM starts_at), EXTRACT(EPOCH FROM ends_at), '[)') WITH &&
    ) WHERE (is_active);

ALTER TABLE courts ADD CONSTRAINT courts_currency_format
    CHECK (reference_price_currency IS NULL OR reference_price_currency ~ '^[A-Z]{3}$');
ALTER TABLE courts ADD CONSTRAINT courts_price_finite
    CHECK (reference_price_amount IS NULL OR reference_price_amount < 'Infinity'::numeric);

-- +goose Down
ALTER TABLE courts DROP CONSTRAINT courts_price_finite;
ALTER TABLE courts DROP CONSTRAINT courts_currency_format;
ALTER TABLE time_slots DROP CONSTRAINT ts_no_active_overlap;
ALTER TABLE court_operating_hours DROP CONSTRAINT coh_no_active_overlap;
ALTER TABLE bookings ALTER COLUMN request_hash DROP NOT NULL;
DROP INDEX bslots_active_slot_date_uk;
-- Restoring the old constraint intentionally fails if cancellation/rebooking has
-- created multiple historical rows for a template/date. Review data before rollback.
ALTER TABLE booking_slots ADD CONSTRAINT bslots_slot_date_uk
    UNIQUE (time_slot_id, booking_date) DEFERRABLE INITIALLY IMMEDIATE;
