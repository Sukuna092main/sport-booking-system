-- +goose Up
CREATE TABLE users (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    email           citext      NOT NULL,
    password_hash   text        NOT NULL,
    full_name       text        NOT NULL,
    phone           text,
    role            text        NOT NULL,
    status          text        NOT NULL DEFAULT 'ACTIVE',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT users_email_uk         UNIQUE (email),
    CONSTRAINT users_role_chk         CHECK (role   IN ('USER', 'ADMIN')),
    CONSTRAINT users_status_chk       CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT users_email_notempty   CHECK (email <> ''),
    CONSTRAINT users_fullname_notempty CHECK (full_name <> '')
);

CREATE INDEX idx_users_email        ON users (email);
CREATE INDEX idx_users_status       ON users (status);

-- +goose Down
DROP TABLE IF EXISTS users;
