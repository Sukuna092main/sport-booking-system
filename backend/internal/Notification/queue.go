package notification

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
)

type SQLQueue struct {
	encryptor *Encryptor
}

func NewSQLQueue(encryptor *Encryptor) *SQLQueue {
	return &SQLQueue{encryptor: encryptor}
}

func (q *SQLQueue) EnqueuePasswordReset(ctx context.Context, tx *sql.Tx, message EmailMessage, dedupeKey string) error {
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
	_, err = tx.ExecContext(ctx, `INSERT INTO email_outbox(dedupe_key,event_type,recipient_email,payload_encrypted)
		VALUES ($1,'PASSWORD_RESET',$2,$3) ON CONFLICT (dedupe_key) DO NOTHING`, dedupeKey, message.To, ciphertext)
	return err
}
