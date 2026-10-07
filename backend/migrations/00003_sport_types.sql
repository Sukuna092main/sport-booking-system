-- +goose Up
CREATE TABLE sport_types (
    id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text    NOT NULL,
    description text,
    is_active   boolean NOT NULL DEFAULT true,

    CONSTRAINT sport_types_name_uk       UNIQUE (name),
    CONSTRAINT sport_types_name_notempty CHECK (name <> '')
);

CREATE INDEX idx_sport_types_is_active ON sport_types (is_active);

-- +goose Down
DROP TABLE IF EXISTS sport_types;
