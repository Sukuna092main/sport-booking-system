package notification

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"fmt"
	"io"
)

type Encryptor struct{ key []byte }

func NewEncryptor(encoded string) (*Encryptor, error) {
	key, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		key, err = base64.RawStdEncoding.DecodeString(encoded)
	}
	if err != nil || len(key) != 32 {
		return nil, fmt.Errorf("EMAIL_ENCRYPTION_KEY must be base64 for exactly 32 random bytes")
	}
	return &Encryptor{key: key}, nil
}

func (e *Encryptor) Encrypt(plain []byte) ([]byte, error) {
	block, err := aes.NewCipher(e.key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, plain, nil), nil
}

func (e *Encryptor) Decrypt(value []byte) ([]byte, error) {
	block, err := aes.NewCipher(e.key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(value) < gcm.NonceSize() {
		return nil, fmt.Errorf("encrypted email payload is truncated")
	}
	nonce, ciphertext := value[:gcm.NonceSize()], value[gcm.NonceSize():]
	return gcm.Open(nil, nonce, ciphertext, nil)
}

type EmailQueue interface {
	EnqueuePasswordReset(context.Context, *sql.Tx, EmailMessage, string) error
}
