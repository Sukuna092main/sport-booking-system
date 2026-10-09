package config

import (
	"os"
	"reflect"
	"testing"
)

func TestCORSOriginsConfiguration(t *testing.T) {
	validEnv(t)
	t.Setenv("CORS_ALLOWED_ORIGINS", "HTTPS://Frontend.Example.Test:443/, http://localhost:5173,https://frontend.example.test")
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(cfg.CORSAllowedOrigins, []string{"https://frontend.example.test", "http://localhost:5173"}) {
		t.Fatal("origins must be canonical and deduplicated")
	}
	for _, raw := range []string{"*", "null", "file:///tmp", "https://*.example.test", "https://user:password@example.test", "https://example.test/api/v1", "https://example.test?key=value", "https://example.test#section", "https://example.test:65536", "https://example.test,", "https://đặt-sân.test", "https://[:::]"} {
		t.Run(raw, func(t *testing.T) {
			t.Setenv("CORS_ALLOWED_ORIGINS", raw)
			if _, err := Load(); err == nil {
				t.Fatal("invalid CORS configuration accepted")
			}
		})
	}
	t.Setenv("CORS_ALLOWED_ORIGINS", "")
	cfg, err = Load()
	if err != nil || len(cfg.CORSAllowedOrigins) != 0 {
		t.Fatal("explicit empty origin list must close CORS")
	}
	t.Setenv("CORS_ALLOWED_ORIGINS", "http://[::1]:5173")
	if _, err = Load(); err != nil {
		t.Fatal(err)
	}
}

func TestCORSDefaults(t *testing.T) {
	validEnv(t)
	original, present := os.LookupEnv("CORS_ALLOWED_ORIGINS")
	if err := os.Unsetenv("CORS_ALLOWED_ORIGINS"); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if present {
			_ = os.Setenv("CORS_ALLOWED_ORIGINS", original)
		} else {
			_ = os.Unsetenv("CORS_ALLOWED_ORIGINS")
		}
	})
	t.Setenv("APP_ENV", "development")
	cfg, err := Load()
	if err != nil || len(cfg.CORSAllowedOrigins) != 2 {
		t.Fatal("local development origin defaults missing")
	}
	t.Setenv("APP_ENV", "production")
	t.Setenv("DATABASE_URL", "postgresql://sport:test-only@db.example.test/sport_test?sslmode=require")
	cfg, err = Load()
	if err != nil || len(cfg.CORSAllowedOrigins) != 0 {
		t.Fatal("production CORS must require an explicit origin list")
	}
}
