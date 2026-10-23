-- +goose Up
CREATE TABLE courts (
    id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    sport_type_id               uuid        NOT NULL,
    code                        text        NOT NULL,
    name                        text        NOT NULL,
    description                 text,
    is_active                   boolean     NOT NULL DEFAULT true,
    slot_duration_minutes       smallint    NOT NULL DEFAULT 60,
    min_consecutive_slots       smallint    NOT NULL DEFAULT 1,
    max_consecutive_slots       smallint    NOT NULL DEFAULT 4,
    reference_price_amount      numeric,
    reference_price_currency    text,

    CONSTRAINT courts_sport_type_fk         FOREIGN KEY (sport_type_id) REFERENCES sport_types (id) ON DELETE RESTRICT,
    CONSTRAINT courts_code_uk               UNIQUE (code),
    CONSTRAINT courts_code_notempty         CHECK (code <> ''),
    CONSTRAINT courts_name_notempty         CHECK (name <> ''),
    -- slot_duration_minutes phải dương
    CONSTRAINT courts_slot_duration_pos     CHECK (slot_duration_minutes > 0),
    -- 1 <= min <= max
    CONSTRAINT courts_min_slots_pos         CHECK (min_consecutive_slots >= 1),
    CONSTRAINT courts_max_gte_min           CHECK (max_consecutive_slots >= min_consecutive_slots),
    -- Giá tham khảo không âm; nếu có amount thì phải có currency và ngược lại
    CONSTRAINT courts_price_nonneg          CHECK (reference_price_amount IS NULL OR reference_price_amount >= 0),
    CONSTRAINT courts_price_pair            CHECK (
        (reference_price_amount IS NULL AND reference_price_currency IS NULL)
        OR
        (reference_price_amount IS NOT NULL AND reference_price_currency IS NOT NULL AND reference_price_currency <> '')
    )
);

CREATE INDEX idx_courts_sport_type_active ON courts (sport_type_id, is_active);
CREATE INDEX idx_courts_is_active         ON courts (is_active);

-- +goose Down
DROP TABLE IF EXISTS courts;
