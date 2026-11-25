package inventory

import (
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/identity"
	"github.com/gin-gonic/gin"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRejectInvalidWritesBeforeDatabase(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	g := r.Group("/admin", func(c *gin.Context) {
		identity.Set(c, identity.Actor{ID: "11111111-1111-1111-1111-111111111111", Role: "ADMIN"})
	})
	Register(g, nil)
	for _, tc := range []struct{ method, path, body string }{
		{"POST", "/admin/sport-types", `{}`}, {"POST", "/admin/sport-types", `{"name":null}`}, {"POST", "/admin/sport-types", `{"name":" "}`}, {"POST", "/admin/sport-types", `{"name":"Tennis","extra":1}`}, {"POST", "/admin/sport-types", `{"name":"Tennis","isActive":null}`},
		{"PATCH", "/admin/sport-types/11111111-1111-1111-1111-111111111111", `{}`},
		{"POST", "/admin/courts", `{"sportTypeId":"bad","name":"A","code":"A"}`}, {"POST", "/admin/courts", `{"sportTypeId":"11111111-1111-1111-1111-111111111111","name":"A","code":"A","slotDurationMinutes":0}`},
		{"POST", "/admin/courts", `{"sportTypeId":"11111111-1111-1111-1111-111111111111","name":"A","code":"A","minConsecutiveSlots":5}`},
		{"POST", "/admin/courts", `{"sportTypeId":"11111111-1111-1111-1111-111111111111","name":"A","code":"A","referencePriceAmount":"1.234"}`},
		{"PATCH", "/admin/courts/nope", `{"name":"A"}`},
	} {
		t.Run(tc.method+tc.path+tc.body, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Code != 400 {
				t.Fatalf("status %d: %s", w.Code, w.Body)
			}
		})
	}
}
