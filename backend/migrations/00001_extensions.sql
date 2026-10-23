-- +goose Up
-- Bật extension citext (email không phân biệt hoa thường)
-- và btree_gist (exclusion constraint chống double-booking)
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- +goose Down
-- Không DROP extension vì có thể được dùng bởi migration khác
-- và không thể DROP nếu đang còn cột citext tồn tại.
-- Để rollback toàn bộ schema, drop database và tạo lại.
