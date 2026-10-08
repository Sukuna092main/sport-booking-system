-- +goose Up
CREATE TABLE audit_logs (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id   uuid,
    action          text        NOT NULL,
    entity_type     text        NOT NULL,
    entity_id       uuid,
    details         jsonb,
    request_id      text,
    occurred_at     timestamptz NOT NULL DEFAULT now(),

    -- Giữ bản ghi kể cả khi actor bị xóa tài khoản
    CONSTRAINT alogs_actor_fk       FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT alogs_action_notempty    CHECK (action <> ''),
    CONSTRAINT alogs_entitytype_notempty CHECK (entity_type <> '')
);

-- Index tra cứu theo entity (xem lịch sử thay đổi của một đối tượng cụ thể)
CREATE INDEX idx_alogs_entity ON audit_logs (entity_type, entity_id, occurred_at DESC);
-- Index tra cứu theo actor (xem hành động của một người dùng)
CREATE INDEX idx_alogs_actor  ON audit_logs (actor_user_id, occurred_at DESC);

-- +goose Down
DROP TABLE IF EXISTS audit_logs;
