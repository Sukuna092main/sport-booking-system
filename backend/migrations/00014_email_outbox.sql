-- +goose Up
CREATE TABLE email_outbox (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    dedupe_key     text        NOT NULL UNIQUE,
    event_type     text        NOT NULL CHECK (event_type IN ('BOOKING_CONFIRMED','BOOKING_CANCELLED','BOOKING_REMINDER_24H','PASSWORD_RESET')),
    recipient_email text       NOT NULL,
    payload        jsonb,
    payload_encrypted bytea,
    status         text        NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','PROCESSING','SENT','FAILED','CANCELLED')),
    scheduled_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
    attempts       smallint    NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts   smallint    NOT NULL DEFAULT 8 CHECK (max_attempts BETWEEN 1 AND 20),
    lease_until    timestamptz,
    last_error     text,
    sent_at        timestamptz,
    created_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT email_outbox_payload_xor CHECK ((payload IS NOT NULL) <> (payload_encrypted IS NOT NULL))
);
CREATE INDEX idx_email_outbox_due ON email_outbox (scheduled_at,created_at)
    WHERE status IN ('PENDING','FAILED');
CREATE INDEX idx_email_outbox_expired_lease ON email_outbox (lease_until)
    WHERE status = 'PROCESSING';

-- +goose Down
DROP TABLE IF EXISTS email_outbox;
