-- +goose Up
CREATE TABLE court_operating_hours (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    court_id    uuid        NOT NULL,
    weekday     smallint    NOT NULL,
    opens_at    time        NOT NULL,
    closes_at   time        NOT NULL,
    is_active   boolean     NOT NULL DEFAULT true,

    CONSTRAINT coh_court_fk          FOREIGN KEY (court_id) REFERENCES courts (id) ON DELETE RESTRICT,
    -- weekday theo ISO 8601: 1=Thứ Hai … 7=Chủ nhật
    CONSTRAINT coh_weekday_chk       CHECK (weekday BETWEEN 1 AND 7),
    -- opens_at phải trước closes_at
    CONSTRAINT coh_time_order_chk    CHECK (opens_at < closes_at)
);

-- Unique partial index: mỗi sân/thứ không có 2 khoảng giờ đang hoạt động bắt đầu cùng giờ.
-- Chống overlap thực sự được kiểm tra trong service khi khóa dòng sân.
CREATE UNIQUE INDEX idx_coh_active_unique
    ON court_operating_hours (court_id, weekday, opens_at)
    WHERE is_active = true;

CREATE INDEX idx_coh_court_weekday ON court_operating_hours (court_id, weekday);

-- +goose Down
DROP TABLE IF EXISTS court_operating_hours;
