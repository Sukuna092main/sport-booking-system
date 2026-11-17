package notification

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
)

type SQLQueue struct {
	db        *sql.DB
	encryptor *Encryptor
}

func NewSQLQueue(db *sql.DB, encryptor *Encryptor) *SQLQueue {
	return &SQLQueue{db: db, encryptor: encryptor}
}

func (q *SQLQueue) EnqueuePasswordReset(ctx context.Context, message EmailMessage, dedupeKey string) error {
	if q.encryptor == nil {
		return fmt.Errorf("email encryption key is not configured")
	}
	encoded, err := json.Marshal(message)
	if err != nil {
		return err
	}
	ciphertext, err := q.encryptor.Encrypt(encoded)
	if err != nil {
		return err
	}
	_, err = q.db.ExecContext(ctx, `INSERT INTO email_outbox(dedupe_key,event_type,recipient_email,payload_encrypted)
		VALUES ($1,'PASSWORD_RESET',$2,$3) ON CONFLICT (dedupe_key) DO NOTHING`, dedupeKey, message.To, ciphertext)
	return err
}
