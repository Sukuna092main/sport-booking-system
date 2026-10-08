package auth

import (
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	user "github.com/Sukuna092main/sport-booking-system/backend/internal/User"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/identity"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/middleware"
	"github.com/gin-gonic/gin"
)

func TestAuthorization(t *testing.T) {
	gin.SetMode(gin.TestMode)
	now := time.Now()
	tokens := NewTokens(strings.Repeat("s", 32), "sport", time.Minute, func() time.Time { return now })
	encoded, _, _ := tokens.Issue(testUserID, "ADMIN")
	repo := &memoryUsers{value: user.User{ID: testUserID, Role: "USER", Status: "ACTIVE"}}
	r := gin.New()
	r.Use(middleware.RequestID())
	r.GET("/me", Authenticate(repo, tokens), func(c *gin.Context) {
		actor, ok := identity.Get(c)
		if !ok || actor.ID != testUserID {
			t.Error("missing identity")
		}
		c.Status(200)
	})
	r.GET("/admin", Authenticate(repo, tokens), RequireRole("ADMIN"), func(c *gin.Context) { c.Status(200) })
	r.GET("/unguarded", RequireRole("ADMIN"), func(c *gin.Context) { c.Status(200) })
	call := func(path, header string, want int) {
		t.Helper()
		rec := httptest.NewRecorder()
		req := httptest.NewRequest("GET", path, nil)
		if header != "" {
			req.Header.Set("Authorization", header)
		}
		r.ServeHTTP(rec, req)
		if rec.Code != want {
			t.Fatalf("%s -> %d want %d: %s", path, rec.Code, want, rec.Body.String())
		}
	}
	call("/me", "", 401)
	call("/me", "Basic abc", 401)
	call("/me", "Bearer invalid", 401)
	call("/me", "Bearer "+encoded+" extra", 401)
	call("/unguarded", "", 401)
	call("/me", "bearer "+encoded, 200)
	call("/admin", "Bearer "+encoded, 403)
	repo.value.Role = "ADMIN"
	call("/admin", "Bearer "+encoded, 200)
	repo.value.Status = "INACTIVE"
	call("/me", "Bearer "+encoded, 403)
	repo.value.Status = "ACTIVE"
	repo.err = user.ErrNotFound
	call("/me", "Bearer "+encoded, 401)
	repo.err = nil
	now = now.Add(time.Minute)
	call("/me", "Bearer "+encoded, 401)
}
