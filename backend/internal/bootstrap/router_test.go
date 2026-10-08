package bootstrap

import (
	"database/sql"
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
	r, _ := testServer(t)
	return r
}

func testServer(t *testing.T) (*gin.Engine, *sql.DB) {
	t.Helper()
	db := testdb.Open(t)
	cfg := config.Config{AppName: "sport-test", Environment: "test", AppTimezone: "Asia/Ho_Chi_Minh", JWTSecret: strings.Repeat("s", 32), JWTTTL: 15 * time.Minute}
	return NewRouter(cfg, slog.New(slog.NewTextHandler(io.Discard, nil)), db), db
}

func registerLogin(t *testing.T, r *gin.Engine, email string) (string, string) {
	t.Helper()
	body := `{"email":"` + email + `","password":"password123","fullName":"Huy","phone":"0900000000"}`
	status, result := request(t, r, "POST", "/api/v1/auth/register", body, "")
	if status != 201 {
		t.Fatal(status, result)
	}
	id := result["data"].(map[string]any)["id"].(string)
	status, result = request(t, r, "POST", "/api/v1/auth/login", `{"email":"`+email+`","password":"password123"}`, "")
	if status != 200 {
		t.Fatal(status, result)
	}
	return id, result["data"].(map[string]any)["accessToken"].(string)
}

func TestProfileOwnershipHTTP(t *testing.T) {
	r, db := testServer(t)
	id, token := registerLogin(t, r, "huy@example.com")
	otherID, otherToken := registerLogin(t, r, "other@example.com")
	status, result := request(t, r, "GET", "/api/v1/users/me?userId="+otherID, "", token)
	if status != 200 || result["data"].(map[string]any)["id"] != id {
		t.Fatal("read must use JWT owner", status, result)
	}
	status, _ = request(t, r, "GET", "/api/v1/users/me", "", "")
	if status != 401 {
		t.Fatal(status)
	}
	status, _ = request(t, r, "GET", "/api/v1/users/me", "", "bad")
	if status != 401 {
		t.Fatal(status)
	}
	for _, body := range []string{`{}`, `null`, `{"fullName":null}`, `{"fullName":" "}`, `{"phone":42}`, `{"role":"ADMIN"}`, `{"email":"hack@example.com"}`, `{"status":"INACTIVE"}`, `{"password":"newpass123"}`, `{"id":"` + otherID + `"}`, `{"userId":"` + otherID + `","fullName":"Hack"}`, `{"phone":"` + strings.Repeat("1", 31) + `"}`} {
		status, _ = request(t, r, "PATCH", "/api/v1/users/me", body, token)
		if status != 400 {
			t.Fatalf("%s -> %d", body, status)
		}
	}
	status, result = request(t, r, "PATCH", "/api/v1/users/me", `{"fullName":" Huy mới "}`, token)
	if status != 200 {
		t.Fatal(status, result)
	}
	data := result["data"].(map[string]any)
	if data["fullName"] != "Huy mới" || data["phone"] != "0900000000" || data["role"] != "USER" {
		t.Fatal(data)
	}
	status, result = request(t, r, "PATCH", "/api/v1/users/me", `{"phone":null}`, token)
	if status != 200 || result["data"].(map[string]any)["phone"] != nil {
		t.Fatal("null must clear phone", result)
	}
	status, result = request(t, r, "GET", "/api/v1/users/me", "", otherToken)
	if status != 200 || result["data"].(map[string]any)["fullName"] != "Huy" {
		t.Fatal("other account changed", result)
	}
	var name string
	var phone *string
	if err := db.QueryRow("SELECT full_name,phone FROM users WHERE id=$1", id).Scan(&name, &phone); err != nil || name != "Huy mới" || phone != nil {
		t.Fatal("update not persisted", err)
	}
	if _, err := db.Exec("UPDATE users SET status='INACTIVE' WHERE id=$1", id); err != nil {
		t.Fatal(err)
	}
	status, _ = request(t, r, "GET", "/api/v1/users/me", "", token)
	if status != 403 {
		t.Fatal(status)
	}
	status, _ = request(t, r, "PATCH", "/api/v1/users/me", `{"fullName":"Again"}`, token)
	if status != 403 {
		t.Fatal(status)
	}
	if _, err := db.Exec("DELETE FROM users WHERE id=$1", otherID); err != nil {
		t.Fatal(err)
	}
	status, _ = request(t, r, "GET", "/api/v1/users/me", "", otherToken)
	if status != 401 {
		t.Fatal(status)
	}
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
