package config

import (
	"strings"
	"testing"
)

func validEnv(t *testing.T) {
	t.Helper()
	t.Setenv("APP_TIMEZONE", "Asia/Ho_Chi_Minh")
	t.Setenv("DATABASE_URL", "postgresql://sport:example@localhost/sport_test?sslmode=disable")
	t.Setenv("JWT_SECRET", strings.Repeat("s", 32))
	t.Setenv("APP_ENV", "test")
}

func TestConfiguration(t *testing.T) {
	validEnv(t)
	if _, err := Load(); err != nil {
		t.Fatal(err)
	}
	for name, value := range map[string]string{"JWT_SECRET": "short", "JWT_TTL": "0s", "DB_MAX_OPEN_CONNS": "abc", "DB_MAX_IDLE_CONNS": "100", "DB_CONN_MAX_LIFETIME": "-1s", "APP_TIMEZONE": "invalid", "DATABASE_URL": "bad"} {
		t.Run(name, func(t *testing.T) {
			t.Setenv(name, value)
			if _, err := Load(); err == nil {
				t.Fatal("invalid configuration accepted")
			}
		})
	}
	t.Setenv("APP_ENV", "production")
	if _, err := Load(); err == nil {
		t.Fatal("production allowed without TLS")
	}
	t.Setenv("DATABASE_URL", "postgresql://sport:example@db.example/sport_test?sslmode=require")
	if _, err := Load(); err != nil {
		t.Fatal(err)
	}
}
