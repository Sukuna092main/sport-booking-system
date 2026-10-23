-- +goose Up
CREATE TABLE booking_slots (
    booking_id    uuid        NOT NULL,
    time_slot_id  uuid        NOT NULL,
    court_id      uuid        NOT NULL,
    booking_date  date        NOT NULL,
    weekday       smallint    NOT NULL,
    starts_at     timestamptz NOT NULL,
    ends_at       timestamptz NOT NULL,
    released_at   timestamptz,

    CONSTRAINT bslots_pk              PRIMARY KEY (booking_id, time_slot_id),
    -- FK ghép tới bookings(id, court_id, booking_date) — đảm bảo slot đúng sân và ngày
    CONSTRAINT bslots_booking_fk      FOREIGN KEY (booking_id, court_id, booking_date)
                                          REFERENCES bookings   (id, court_id, booking_date) ON DELETE RESTRICT,
    -- FK ghép tới time_slots(id, court_id, weekday) — đảm bảo slot đúng sân và thứ
    CONSTRAINT bslots_timeslot_fk     FOREIGN KEY (time_slot_id, court_id, weekday)
                                          REFERENCES time_slots (id, court_id, weekday)      ON DELETE RESTRICT,
    CONSTRAINT bslots_weekday_chk     CHECK (weekday BETWEEN 1 AND 7),
    CONSTRAINT bslots_time_order_chk  CHECK (starts_at < ends_at),
    -- weekday phải khớp với booking_date (ISO DOW: 1=Mon…7=Sun)
    CONSTRAINT bslots_weekday_date    CHECK (weekday = EXTRACT(ISODOW FROM booking_date)::smallint),

    -- Chặn đặt trùng đúng cùng time_slot_id + booking_date
    CONSTRAINT bslots_slot_date_uk
        UNIQUE (time_slot_id, booking_date)
        DEFERRABLE INITIALLY IMMEDIATE
);

-- Exclusion constraint: lớp bảo vệ cuối cùng chống đặt chồng giờ trên cùng sân
-- dù dùng time_slot_id khác nhau (cần btree_gist từ migration 00001)
ALTER TABLE booking_slots
    ADD CONSTRAINT bslots_no_active_overlap
    EXCLUDE USING gist (
        court_id     WITH =,
        tstzrange(starts_at, ends_at, '[)') WITH &&
    )
    WHERE (released_at IS NULL);

-- Index tra cứu theo booking và theo slot/ngày (dùng khi kiểm tra tình trạng)
CREATE INDEX idx_bslots_booking     ON booking_slots (booking_id);
CREATE INDEX idx_bslots_slot_date   ON booking_slots (time_slot_id, booking_date) WHERE released_at IS NULL;
CREATE INDEX idx_bslots_court_range ON booking_slots (court_id, starts_at, ends_at) WHERE released_at IS NULL;

-- +goose Down
ALTER TABLE booking_slots DROP CONSTRAINT IF EXISTS bslots_no_active_overlap;
DROP TABLE IF EXISTS booking_slots;
