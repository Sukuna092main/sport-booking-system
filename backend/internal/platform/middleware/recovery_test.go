package middleware

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRecoveryContract(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var logs bytes.Buffer
	r := gin.New()
	r.Use(RequestID(), AccessLog(slog.New(slog.NewTextHandler(&logs, nil))), Recovery(slog.New(slog.NewTextHandler(&logs, nil))))
	r.GET("/panic", func(c *gin.Context) { panic("secret-password") })
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest("GET", "/panic", nil))
	if rec.Code != 500 {
		t.Fatal(rec.Code)
	}
	var result struct {
		Error struct {
			Code      string
			RequestID string `json:"requestId"`
		}
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.Error.Code != "internal_error" || result.Error.RequestID != rec.Header().Get("X-Request-ID") {
		t.Fatal("invalid error envelope")
	}
	if strings.Contains(logs.String()+rec.Body.String(), "secret-password") {
		t.Fatal("panic value leaked")
	}
}
