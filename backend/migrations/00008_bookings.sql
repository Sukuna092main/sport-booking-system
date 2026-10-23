-- +goose Up
CREATE TABLE bookings (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id      uuid        NOT NULL,
    court_id         uuid        NOT NULL,
    booking_code     text        NOT NULL,
    booking_date     date        NOT NULL,
    status           text        NOT NULL DEFAULT 'CONFIRMED',
    idempotency_key  text        NOT NULL,
    request_hash     bytea,
    created_at       timestamptz NOT NULL DEFAULT now(),
    cancelled_at     timestamptz,

    CONSTRAINT bookings_customer_fk         FOREIGN KEY (customer_id) REFERENCES users  (id) ON DELETE RESTRICT,
    CONSTRAINT bookings_court_fk            FOREIGN KEY (court_id)    REFERENCES courts (id) ON DELETE RESTRICT,
    -- booking_code là mã dễ đọc, ổn định (FR-13)
    CONSTRAINT bookings_code_uk             UNIQUE (booking_code),
    CONSTRAINT bookings_code_notempty       CHECK (booking_code <> ''),
    -- Chống tạo trùng theo người dùng
    CONSTRAINT bookings_idempotency_uk      UNIQUE (customer_id, idempotency_key),
    CONSTRAINT bookings_idempotency_len     CHECK (char_length(idempotency_key) BETWEEN 1 AND 128),
    -- SHA-256 = 32 bytes
    CONSTRAINT bookings_hash_len            CHECK (request_hash IS NULL OR octet_length(request_hash) = 32),
    CONSTRAINT bookings_status_chk          CHECK (status IN ('CONFIRMED', 'CANCELLED')),
    -- Nếu status = CANCELLED thì phải có cancelled_at và ngược lại
    CONSTRAINT bookings_cancel_consistency  CHECK (
        (status = 'CANCELLED' AND cancelled_at IS NOT NULL)
        OR
        (status = 'CONFIRMED' AND cancelled_at IS NULL)
    ),
    -- Composite unique: làm đích cho FK ghép trong booking_slots
    CONSTRAINT bookings_id_court_date_uk    UNIQUE (id, court_id, booking_date)
);

CREATE INDEX idx_bookings_customer_created  ON bookings (customer_id, created_at DESC);
CREATE INDEX idx_bookings_court_date_status ON bookings (court_id, booking_date, status);
CREATE INDEX idx_bookings_code              ON bookings (booking_code);

-- +goose Down
DROP TABLE IF EXISTS bookings;
