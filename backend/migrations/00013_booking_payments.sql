-- +goose Up
CREATE TABLE court_pricing (
    court_id            uuid        PRIMARY KEY REFERENCES courts(id) ON DELETE RESTRICT,
    price_per_slot_vnd  bigint      NOT NULL CHECK (price_per_slot_vnd > 0),
    is_active           boolean     NOT NULL DEFAULT true,
    updated_at          timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE bookings
    ADD COLUMN hold_expires_at timestamptz,
    ADD COLUMN expired_at timestamptz,
    ADD COLUMN total_amount_vnd bigint,
    ADD COLUMN deposit_amount_vnd bigint,
    ADD COLUMN remaining_amount_vnd bigint;
ALTER TABLE bookings DROP CONSTRAINT bookings_status_chk;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_chk
    CHECK (status IN ('PENDING_PAYMENT','CONFIRMED','CANCELLED','EXPIRED'));
ALTER TABLE bookings DROP CONSTRAINT bookings_cancel_consistency;
ALTER TABLE bookings ADD CONSTRAINT bookings_state_consistency CHECK (
    (status = 'CANCELLED' AND cancelled_at IS NOT NULL AND expired_at IS NULL)
    OR (status = 'EXPIRED' AND expired_at IS NOT NULL AND cancelled_at IS NULL)
    OR (status IN ('PENDING_PAYMENT','CONFIRMED') AND cancelled_at IS NULL AND expired_at IS NULL)
);
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_amounts_consistency CHECK (
    (total_amount_vnd IS NULL AND deposit_amount_vnd IS NULL AND remaining_amount_vnd IS NULL)
    OR (total_amount_vnd > 0 AND deposit_amount_vnd > 0 AND remaining_amount_vnd >= 0
        AND total_amount_vnd = deposit_amount_vnd + remaining_amount_vnd)
);
ALTER TABLE bookings ADD CONSTRAINT bookings_hold_consistency CHECK (
    (status = 'PENDING_PAYMENT' AND hold_expires_at IS NOT NULL AND total_amount_vnd IS NOT NULL)
    OR (status <> 'PENDING_PAYMENT')
);
CREATE INDEX idx_bookings_pending_expiry ON bookings (hold_expires_at)
    WHERE status = 'PENDING_PAYMENT';

CREATE TABLE payments (
    id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id               uuid        NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    provider                 text        NOT NULL CHECK (provider IN ('mock','vnpay')),
    provider_order_ref       text        NOT NULL,
    amount_vnd               bigint      NOT NULL CHECK (amount_vnd > 0),
    currency                 text        NOT NULL DEFAULT 'VND' CHECK (currency = 'VND'),
    status                   text        NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','PAID','FAILED','EXPIRED','PAID_REVIEW')),
    checkout_url             text,
    provider_transaction_id  text,
    provider_response_code   text,
    created_at               timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at               timestamptz NOT NULL DEFAULT clock_timestamp(),
    paid_at                  timestamptz,
    CONSTRAINT payments_provider_order_uk UNIQUE (provider, provider_order_ref)
);
CREATE UNIQUE INDEX payments_provider_transaction_uk
    ON payments (provider, provider_transaction_id)
    WHERE provider_transaction_id IS NOT NULL;
CREATE UNIQUE INDEX payments_one_pending_per_booking_uk
    ON payments (booking_id)
    WHERE status = 'PENDING';
CREATE INDEX idx_payments_booking_created ON payments (booking_id, created_at DESC);

CREATE TABLE payment_webhook_events (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    provider    text        NOT NULL,
    event_key   text        NOT NULL,
    payment_id  uuid REFERENCES payments(id) ON DELETE SET NULL,
    received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    processed_at timestamptz,
    response_code text,
    CONSTRAINT payment_webhook_events_provider_key_uk UNIQUE (provider, event_key)
);

-- +goose Down
DROP TABLE IF EXISTS payment_webhook_events;
DROP TABLE IF EXISTS payments;
DROP INDEX IF EXISTS idx_bookings_pending_expiry;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_hold_consistency;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_amounts_consistency;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_state_consistency;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_chk CHECK (status IN ('CONFIRMED','CANCELLED'));
ALTER TABLE bookings ADD CONSTRAINT bookings_cancel_consistency CHECK (
    (status='CANCELLED' AND cancelled_at IS NOT NULL) OR (status='CONFIRMED' AND cancelled_at IS NULL)
);
ALTER TABLE bookings DROP COLUMN IF EXISTS remaining_amount_vnd;
ALTER TABLE bookings DROP COLUMN IF EXISTS deposit_amount_vnd;
ALTER TABLE bookings DROP COLUMN IF EXISTS total_amount_vnd;
ALTER TABLE bookings DROP COLUMN IF EXISTS expired_at;
ALTER TABLE bookings DROP COLUMN IF EXISTS hold_expires_at;
DROP TABLE IF EXISTS court_pricing;
