package bookings

import (
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/identity"
	"github.com/gin-gonic/gin"
)

func TestMalformedHTTPInputs(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	g := r.Group("/admin", func(c *gin.Context) {
		identity.Set(c, identity.Actor{ID: "11111111-1111-1111-1111-111111111111", Role: "ADMIN"})
	})
	Register(g, nil, time.UTC, time.Now)
	for _, tc := range []struct{ method, path, body string }{
		{"GET", "/admin/bookings?status=UNKNOWN", ""},
		{"GET", "/admin/bookings?date=%ZZ", ""},
		{"GET", "/admin/bookings/nope", ""},
		{"GET", "/admin/statistics?from=2026-10-24&to=2026-10-23", ""},
		{"POST", "/admin/bookings/11111111-1111-1111-1111-111111111111/cancel", `null`},
		{"POST", "/admin/bookings/11111111-1111-1111-1111-111111111111/cancel", `{}`},
		{"POST", "/admin/bookings/11111111-1111-1111-1111-111111111111/cancel", `{"reason":null}`},
		{"POST", "/admin/bookings/11111111-1111-1111-1111-111111111111/cancel", `{"reason":" "}`},
		{"POST", "/admin/bookings/11111111-1111-1111-1111-111111111111/cancel", `{"reason":"reason","customerId":"other"}`},
		{"POST", "/admin/bookings/11111111-1111-1111-1111-111111111111/cancel", `{"reason":1}`},
		{"POST", "/admin/bookings/11111111-1111-1111-1111-111111111111/cancel", `{"reason":"reason"}{}`},
	} {
		t.Run(tc.method+tc.path+tc.body, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, req)
			if rec.Code != 400 {
				t.Fatalf("status %d: %s", rec.Code, rec.Body)
			}
		})
	}
}
