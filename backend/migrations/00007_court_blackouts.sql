-- +goose Up
CREATE TABLE court_blackouts (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    court_id    uuid        NOT NULL,
    created_by  uuid,
    starts_at   timestamptz NOT NULL,
    ends_at     timestamptz NOT NULL,
    reason      text,
    is_active   boolean     NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT cb_court_fk       FOREIGN KEY (court_id)   REFERENCES courts (id) ON DELETE RESTRICT,
    -- created_by có thể NULL nếu user bị xóa
    CONSTRAINT cb_creator_fk     FOREIGN KEY (created_by) REFERENCES users  (id) ON DELETE SET NULL,
    CONSTRAINT cb_time_order_chk CHECK (starts_at < ends_at)
);

-- Index để kiểm tra giao thoa lịch chặn nhanh khi tạo booking
CREATE INDEX idx_cb_court_active_range
    ON court_blackouts (court_id, starts_at, ends_at)
    WHERE is_active = true;

-- +goose Down
DROP TABLE IF EXISTS court_blackouts;
