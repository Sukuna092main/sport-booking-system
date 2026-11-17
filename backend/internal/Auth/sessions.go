package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"errors"
	"time"
)

var ErrInvalidSession = errors.New("invalid refresh session")

type SessionStore interface {
	Create(context.Context, string, string, time.Time) error
	Rotate(context.Context, string, string, time.Time) (string, error)
	Revoke(context.Context, string) error
	RevokeAll(context.Context, string) error
}

type SQLSessionStore struct{ db *sql.DB }

func NewSQLSessionStore(db *sql.DB) *SQLSessionStore { return &SQLSessionStore{db: db} }

func newRefreshToken() (string, error) {
	value := make([]byte, 32)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(value), nil
}

func tokenHash(value string) []byte {
	hash := sha256.Sum256([]byte(value))
	return hash[:]
}

func (s *SQLSessionStore) Create(ctx context.Context, userID, raw string, expiresAt time.Time) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO auth_refresh_tokens(user_id,family_id,token_hash,expires_at)
		VALUES ($1,gen_random_uuid(),$2,$3)`, userID, tokenHash(raw), expiresAt.UTC())
	return err
}

func (s *SQLSessionStore) Rotate(ctx context.Context, raw, next string, expiresAt time.Time) (string, error) {
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return "", err
	}
	defer tx.Rollback()
	var id, userID, familyID string
	var storedExpiry time.Time
	var usedAt, revokedAt sql.NullTime
	err = tx.QueryRowContext(ctx, `SELECT id::text,user_id::text,family_id::text,expires_at,used_at,revoked_at
		FROM auth_refresh_tokens WHERE token_hash=$1 FOR UPDATE`, tokenHash(raw)).Scan(&id, &userID, &familyID, &storedExpiry, &usedAt, &revokedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrInvalidSession
	}
	if err != nil {
		return "", err
	}
	if usedAt.Valid {
		// Reuse after rotation means the bearer secret was copied. Revoke every
		// token in its family, including the currently active replacement.
		if _, err = tx.ExecContext(ctx, `UPDATE auth_refresh_tokens SET revoked_at=COALESCE(revoked_at,clock_timestamp()) WHERE family_id=$1`, familyID); err != nil {
			return "", err
		}
		if err = tx.Commit(); err != nil {
			return "", err
		}
		return "", ErrInvalidSession
	}
	if revokedAt.Valid || !storedExpiry.After(time.Now().UTC()) {
		return "", ErrInvalidSession
	}
	var nextID string
	if err = tx.QueryRowContext(ctx, `INSERT INTO auth_refresh_tokens(user_id,family_id,token_hash,expires_at)
		VALUES ($1,$2,$3,$4) RETURNING id::text`, userID, familyID, tokenHash(next), expiresAt.UTC()).Scan(&nextID); err != nil {
		return "", err
	}
	result, err := tx.ExecContext(ctx, `UPDATE auth_refresh_tokens SET used_at=clock_timestamp(),replaced_by=$2
		WHERE id=$1 AND used_at IS NULL AND revoked_at IS NULL`, id, nextID)
	if err != nil {
		return "", err
	}
	if count, _ := result.RowsAffected(); count != 1 {
		return "", ErrInvalidSession
	}
	return userID, tx.Commit()
}

func (s *SQLSessionStore) Revoke(ctx context.Context, raw string) error {
	if raw == "" {
		return nil
	}
	_, err := s.db.ExecContext(ctx, `UPDATE auth_refresh_tokens SET revoked_at=COALESCE(revoked_at,clock_timestamp()) WHERE token_hash=$1`, tokenHash(raw))
	return err
}

func (s *SQLSessionStore) RevokeAll(ctx context.Context, userID string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `UPDATE users SET auth_version=auth_version+1,updated_at=clock_timestamp() WHERE id=$1`, userID)
	if err != nil {
		return err
	}
	if count, _ := result.RowsAffected(); count != 1 {
		return ErrInvalidSession
	}
	if _, err = tx.ExecContext(ctx, `UPDATE auth_refresh_tokens SET revoked_at=COALESCE(revoked_at,clock_timestamp())
		WHERE user_id=$1 AND revoked_at IS NULL`, userID); err != nil {
		return err
	}
	return tx.Commit()
}
