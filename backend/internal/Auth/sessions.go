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
	Create(context.Context, string, int64, string, time.Time) (string, error)
	Rotate(context.Context, string, string) (string, string, int64, error)
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

func (s *SQLSessionStore) Create(ctx context.Context, userID string, version int64, raw string, expiresAt time.Time) (string, error) {
	var family string
	err := s.db.QueryRowContext(ctx, `WITH account AS (
 SELECT id FROM users WHERE id=$1 AND auth_version=$2 AND status='ACTIVE' FOR UPDATE
 ) INSERT INTO auth_refresh_tokens(user_id,family_id,token_hash,expires_at)
 SELECT id,gen_random_uuid(),$3,$4 FROM account RETURNING family_id::text`, userID, version, tokenHash(raw), expiresAt.UTC()).Scan(&family)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrInvalidSession
	}
	return family, err
}

func (s *SQLSessionStore) Active(ctx context.Context, userID, family string) (bool, error) {
	var active bool
	err := s.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM auth_refresh_tokens
 WHERE user_id=$1 AND family_id=$2 AND used_at IS NULL AND revoked_at IS NULL AND expires_at>clock_timestamp())`, userID, family).Scan(&active)
	return active, err
}

func (s *SQLSessionStore) Rotate(ctx context.Context, raw, next string) (string, string, int64, error) {
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return "", "", 0, err
	}
	defer tx.Rollback()
	var id, userID, familyID string
	var version int64
	err = tx.QueryRowContext(ctx, `SELECT u.auth_version FROM users u JOIN auth_refresh_tokens t ON t.user_id=u.id
 WHERE t.token_hash=$1 AND u.status='ACTIVE' FOR UPDATE OF u`, tokenHash(raw)).Scan(&version)
	if errors.Is(err, sql.ErrNoRows) {
		return "", "", 0, ErrInvalidSession
	}
	if err != nil {
		return "", "", 0, err
	}
	var storedExpiry time.Time
	var usedAt, revokedAt sql.NullTime
	err = tx.QueryRowContext(ctx, `SELECT id::text,user_id::text,family_id::text,expires_at,used_at,revoked_at
		FROM auth_refresh_tokens WHERE token_hash=$1 FOR UPDATE`, tokenHash(raw)).Scan(&id, &userID, &familyID, &storedExpiry, &usedAt, &revokedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return "", "", 0, ErrInvalidSession
	}
	if err != nil {
		return "", "", 0, err
	}
	if usedAt.Valid {
		// Reuse after rotation means the bearer secret was copied. Revoke every
		// token in its family, including the currently active replacement.
		if _, err = tx.ExecContext(ctx, `UPDATE auth_refresh_tokens SET revoked_at=COALESCE(revoked_at,clock_timestamp()) WHERE family_id=$1`, familyID); err != nil {
			return "", "", 0, err
		}
		if err = tx.Commit(); err != nil {
			return "", "", 0, err
		}
		return "", "", 0, ErrInvalidSession
	}
	if revokedAt.Valid || !storedExpiry.After(time.Now().UTC()) {
		return "", "", 0, ErrInvalidSession
	}
	var nextID string
	if err = tx.QueryRowContext(ctx, `INSERT INTO auth_refresh_tokens(user_id,family_id,token_hash,expires_at)
		VALUES ($1,$2,$3,$4) RETURNING id::text`, userID, familyID, tokenHash(next), storedExpiry.UTC()).Scan(&nextID); err != nil {
		return "", "", 0, err
	}
	result, err := tx.ExecContext(ctx, `UPDATE auth_refresh_tokens SET used_at=clock_timestamp(),replaced_by=$2
		WHERE id=$1 AND used_at IS NULL AND revoked_at IS NULL`, id, nextID)
	if err != nil {
		return "", "", 0, err
	}
	if count, _ := result.RowsAffected(); count != 1 {
		return "", "", 0, ErrInvalidSession
	}
	return userID, familyID, version, tx.Commit()
}

func (s *SQLSessionStore) Revoke(ctx context.Context, raw string) error {
	if raw == "" {
		return nil
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var family string
	err = tx.QueryRowContext(ctx, `SELECT t.family_id FROM auth_refresh_tokens t JOIN users u ON u.id=t.user_id
 WHERE t.token_hash=$1 FOR UPDATE OF u`, tokenHash(raw)).Scan(&family)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE auth_refresh_tokens SET revoked_at=clock_timestamp() WHERE family_id=$1 AND revoked_at IS NULL`, family); err != nil {
		return err
	}
	return tx.Commit()
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
