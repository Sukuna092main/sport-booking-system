package bootstrap

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/config"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/testdb"
	"github.com/gin-gonic/gin"
)

func testRouter(t *testing.T) *gin.Engine {
	t.Helper()
	db := testdb.Open(t)
	cfg := config.Config{AppName: "sport-test", Environment: "test", AppTimezone: "Asia/Ho_Chi_Minh", JWTSecret: strings.Repeat("s", 32), JWTTTL: 15 * time.Minute}
	return NewRouter(cfg, slog.New(slog.NewTextHandler(io.Discard, nil)), db)
}

func request(t *testing.T, r *gin.Engine, method, path, body, token string) (int, map[string]any) {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	r.ServeHTTP(rec, req)
	var result map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("invalid response (%d): %s", rec.Code, rec.Body.String())
	}
	if rec.Header().Get("X-Request-ID") == "" {
		t.Fatal("missing request ID")
	}
	if rec.Code >= 400 {
		e, ok := result["error"].(map[string]any)
		if !ok || e["requestId"] != rec.Header().Get("X-Request-ID") {
			t.Fatal("error envelope/request ID mismatch")
		}
	}
	if strings.Contains(rec.Body.String(), "password_hash") || strings.Contains(rec.Body.String(), "passwordHash") {
		t.Fatal("password hash leaked")
	}
	return rec.Code, result
}

func TestAuthHTTP(t *testing.T) {
	r := testRouter(t)
	status, _ := request(t, r, "POST", "/api/v1/auth/register", `{"email":"huy@example.com","password":"password123","fullName":"Huy","role":"ADMIN"}`, "")
	if status != 400 {
		t.Fatal(status)
	}
	status, result := request(t, r, "POST", "/api/v1/auth/register", `{"email":"huy@example.com","password":"password123","fullName":"Huy"}`, "")
	if status != 201 {
		t.Fatal(status, result)
	}
	if result["data"].(map[string]any)["role"] != "USER" {
		t.Fatal("role escalation")
	}
	status, _ = request(t, r, "POST", "/api/v1/auth/register", `{"email":"HUY@example.com","password":"password123","fullName":"Huy"}`, "")
	if status != 409 {
		t.Fatal(status)
	}
	status, result = request(t, r, "POST", "/api/v1/auth/login", `{"email":"huy@example.com","password":"password123"}`, "")
	if status != 200 {
		t.Fatal(status, result)
	}
	data := result["data"].(map[string]any)
	if data["tokenType"] != "Bearer" || data["accessToken"] == "" {
		t.Fatal(data)
	}
	status, _ = request(t, r, "POST", "/api/v1/auth/login", `{"email":"huy@example.com","password":"wrong"}`, "")
	if status != 401 {
		t.Fatal(status)
	}
	for _, body := range []string{`null`, `{}`, `{"email":"bad","password":"123"}`, `{"email":"a@example.com","password":"12345678","fullName":" "}`} {
		status, _ = request(t, r, "POST", "/api/v1/auth/register", body, "")
		if status != 400 {
			t.Fatalf("%s -> %d", body, status)
		}
	}
	status, _ = request(t, r, "GET", "/api/v1/auth/login", "", "")
	if status != 405 {
		t.Fatal(status)
	}
	status, _ = request(t, r, "GET", "/api/v1/no-such-route", "", "")
	if status != 404 {
		t.Fatal(status)
	}
}
