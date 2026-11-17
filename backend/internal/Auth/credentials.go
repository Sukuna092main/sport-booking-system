package auth

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

var (
	ErrResetInvalid     = errors.New("invalid password reset token")
	ErrResetRateLimited = errors.New("password reset rate limited")
	ErrPasswordChanged  = errors.New("password changed concurrently")
)

type CredentialStore interface {
	CreateResetToken(context.Context, string, []byte, time.Time) error
	RevokeResetToken(context.Context, []byte) error
	ChangePassword(context.Context, string, string, string) error
	ResetPassword(context.Context, []byte, string, time.Time) error
}

func (s *SQLCredentialStore) RevokeResetToken(ctx context.Context, hash []byte) error {
	_, err := s.db.ExecContext(ctx, `UPDATE password_reset_tokens SET revoked_at=COALESCE(revoked_at,clock_timestamp()) WHERE token_hash=$1`, hash)
	return err
}

type SQLCredentialStore struct{ db *sql.DB }

func NewSQLCredentialStore(db *sql.DB) *SQLCredentialStore { return &SQLCredentialStore{db: db} }

func (s *SQLCredentialStore) CreateResetToken(ctx context.Context, userID string, hash []byte, expiresAt time.Time) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var accountStatus string
	if err = tx.QueryRowContext(ctx, `SELECT status FROM users WHERE id=$1 FOR UPDATE`, userID).Scan(&accountStatus); err != nil {
		return err
	}
	if accountStatus != "ACTIVE" {
		return ErrResetInvalid
	}
	var recent bool
	if err = tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM password_reset_tokens
		WHERE user_id=$1 AND created_at > clock_timestamp() - interval '60 seconds')`, userID).Scan(&recent); err != nil {
		return err
	}
	if recent {
		return ErrResetRateLimited
	}
	if _, err = tx.ExecContext(ctx, `UPDATE password_reset_tokens SET revoked_at=COALESCE(revoked_at,clock_timestamp())
		WHERE user_id=$1 AND used_at IS NULL AND revoked_at IS NULL`, userID); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES ($1,$2,$3)`, userID, hash, expiresAt.UTC()); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *SQLCredentialStore) ChangePassword(ctx context.Context, userID, oldHash, newHash string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `UPDATE users SET password_hash=$3,auth_version=auth_version+1,updated_at=clock_timestamp()
		WHERE id=$1 AND status='ACTIVE' AND password_hash=$2`, userID, oldHash, newHash)
	if err != nil {
		return err
	}
	count, _ := result.RowsAffected()
	if count != 1 {
		return ErrPasswordChanged
	}
	if _, err = tx.ExecContext(ctx, `UPDATE auth_refresh_tokens SET revoked_at=COALESCE(revoked_at,clock_timestamp()) WHERE user_id=$1 AND revoked_at IS NULL`, userID); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE password_reset_tokens SET revoked_at=COALESCE(revoked_at,clock_timestamp()) WHERE user_id=$1 AND used_at IS NULL AND revoked_at IS NULL`, userID); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *SQLCredentialStore) ResetPassword(ctx context.Context, hash []byte, newHash string, now time.Time) error {
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var userID string
	err = tx.QueryRowContext(ctx, `SELECT user_id::text FROM password_reset_tokens WHERE token_hash=$1`, hash).Scan(&userID)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrResetInvalid
	}
	if err != nil {
		return err
	}
	var accountStatus string
	if err = tx.QueryRowContext(ctx, `SELECT status FROM users WHERE id=$1 FOR UPDATE`, userID).Scan(&accountStatus); err != nil || accountStatus != "ACTIVE" {
		return ErrResetInvalid
	}
	var tokenID string
	var expiresAt time.Time
	var usedAt, revokedAt sql.NullTime
	err = tx.QueryRowContext(ctx, `SELECT id::text,expires_at,used_at,revoked_at FROM password_reset_tokens
		WHERE token_hash=$1 FOR UPDATE`, hash).Scan(&tokenID, &expiresAt, &usedAt, &revokedAt)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && (usedAt.Valid || revokedAt.Valid || !expiresAt.After(now))) {
		return ErrResetInvalid
	}
	if err != nil {
		return err
	}
	result, err := tx.ExecContext(ctx, `UPDATE users SET password_hash=$2,auth_version=auth_version+1,updated_at=clock_timestamp()
		WHERE id=$1 AND status='ACTIVE'`, userID, newHash)
	if err != nil {
		return err
	}
	count, _ := result.RowsAffected()
	if count != 1 {
		return ErrResetInvalid
	}
	if _, err = tx.ExecContext(ctx, `UPDATE password_reset_tokens SET used_at=clock_timestamp(),revoked_at=COALESCE(revoked_at,clock_timestamp())
		WHERE user_id=$1`, userID); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE auth_refresh_tokens SET revoked_at=COALESCE(revoked_at,clock_timestamp()) WHERE user_id=$1 AND revoked_at IS NULL`, userID); err != nil {
		return err
	}
	return tx.Commit()
}
