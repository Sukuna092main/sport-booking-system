package bootstrap

import (
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/config"
	"io"
	"log/slog"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCORSBrowserIntegration(t *testing.T) {
	t.Setenv("APP_ENV", "test")
	t.Setenv("APP_TIMEZONE", "Asia/Ho_Chi_Minh")
	t.Setenv("DATABASE_URL", "postgresql://sport:test-only@localhost/sport_test?sslmode=disable")
	t.Setenv("JWT_SECRET", strings.Repeat("s", 32))
	t.Setenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173")
	cfg, err := config.Load()
	if err != nil {
		t.Fatal(err)
	}
	r := NewRouter(cfg, slog.New(slog.NewTextHandler(io.Discard, nil)), nil)
	preflight := httptest.NewRequest("OPTIONS", "/api/v1/auth/login", nil)
	preflight.Header.Set("Origin", "http://localhost:5173")
	preflight.Header.Set("Access-Control-Request-Method", "POST")
	preflight.Header.Set("Access-Control-Request-Headers", "content-type")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, preflight)
	if rec.Code != 204 || rec.Header().Get("Access-Control-Allow-Origin") != "http://localhost:5173" {
		t.Fatalf("browser Auth preflight blocked: status=%d origin=%q body=%s", rec.Code, rec.Header().Get("Access-Control-Allow-Origin"), rec.Body.String())
	}
	req := httptest.NewRequest("GET", "/api/v1/users/me", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != 401 || rec.Header().Get("Access-Control-Allow-Origin") != "http://localhost:5173" {
		t.Fatalf("CORS must preserve readable JWT errors: status=%d origin=%q", rec.Code, rec.Header().Get("Access-Control-Allow-Origin"))
	}
}
