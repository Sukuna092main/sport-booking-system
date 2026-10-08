-- +goose Up
CREATE TABLE time_slots (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    court_id    uuid        NOT NULL,
    weekday     smallint    NOT NULL,
    starts_at   time        NOT NULL,
    ends_at     time        NOT NULL,
    is_active   boolean     NOT NULL DEFAULT true,

    CONSTRAINT ts_court_fk        FOREIGN KEY (court_id) REFERENCES courts (id) ON DELETE RESTRICT,
    CONSTRAINT ts_weekday_chk     CHECK (weekday BETWEEN 1 AND 7),
    CONSTRAINT ts_time_order_chk  CHECK (starts_at < ends_at),
    -- Composite unique: dùng làm đích cho FK ghép trong booking_slots
    CONSTRAINT ts_id_court_weekday_uk UNIQUE (id, court_id, weekday)
);

-- Unique partial index: mỗi sân/thứ không có 2 slot đang hoạt động bắt đầu cùng giờ.
-- Chống overlap thực sự được kiểm tra trong service khi khóa dòng sân.
CREATE UNIQUE INDEX idx_ts_active_unique
    ON time_slots (court_id, weekday, starts_at)
    WHERE is_active = true;

CREATE INDEX idx_ts_court_weekday ON time_slots (court_id, weekday);

-- +goose Down
DROP TABLE IF EXISTS time_slots;
