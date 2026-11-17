-- +goose Up
ALTER TABLE users
    ADD COLUMN auth_version bigint NOT NULL DEFAULT 1;

CREATE TABLE auth_refresh_tokens (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_id     uuid        NOT NULL,
    token_hash    bytea       NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    expires_at    timestamptz NOT NULL,
    used_at       timestamptz,
    revoked_at    timestamptz,
    replaced_by   uuid REFERENCES auth_refresh_tokens(id) ON DELETE SET NULL,
    CONSTRAINT auth_refresh_token_hash_uk UNIQUE (token_hash),
    CONSTRAINT auth_refresh_token_hash_len CHECK (octet_length(token_hash) = 32),
    CONSTRAINT auth_refresh_token_expiry_chk CHECK (expires_at > created_at)
);
CREATE INDEX idx_auth_refresh_tokens_user_active
    ON auth_refresh_tokens (user_id, expires_at)
    WHERE used_at IS NULL AND revoked_at IS NULL;
CREATE INDEX idx_auth_refresh_tokens_family
    ON auth_refresh_tokens (family_id);

CREATE TABLE password_reset_tokens (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  bytea       NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    expires_at  timestamptz NOT NULL,
    used_at     timestamptz,
    revoked_at  timestamptz,
    CONSTRAINT password_reset_token_hash_uk UNIQUE (token_hash),
    CONSTRAINT password_reset_token_hash_len CHECK (octet_length(token_hash) = 32),
    CONSTRAINT password_reset_token_expiry_chk CHECK (expires_at > created_at)
);
CREATE INDEX idx_password_reset_tokens_user_created
    ON password_reset_tokens (user_id, created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS auth_refresh_tokens;
ALTER TABLE users DROP COLUMN IF EXISTS auth_version;
