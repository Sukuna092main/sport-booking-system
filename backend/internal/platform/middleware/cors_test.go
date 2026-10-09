package middleware

import (
	"encoding/json"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/response"
	"github.com/gin-gonic/gin"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCORS(t *testing.T) {
	gin.SetMode(gin.TestMode)
	allowed := "https://frontend.example.test"
	for _, tc := range []struct {
		name, method, origin, requestedMethod, requestedHeaders string
		status                                                  int
		permission                                              bool
	}{
		{"no_origin", "GET", "", "", "", 401, false},
		{"allowed_actual", "GET", allowed, "", "", 401, true},
		{"unlisted_actual_keeps_auth", "GET", "https://other.example.test", "", "", 401, false},
		{"same_origin_swagger_keeps_auth", "GET", "http://example.com", "", "", 401, false},
		{"auth_preflight", "OPTIONS", allowed, "POST", "Content-Type", 204, true},
		{"bearer_preflight", "OPTIONS", allowed, "GET", "Authorization, X-Request-ID", 204, true},
		{"headers_case_insensitive", "OPTIONS", allowed, "PATCH", "content-TYPE, AUTHORIZATION", 204, true},
		{"no_extra_headers", "OPTIONS", allowed, "DELETE", "", 204, true},
		{"head_method", "OPTIONS", allowed, "HEAD", "Accept", 204, true},
		{"put_method", "OPTIONS", allowed, "PUT", "Content-Type", 204, true},
		{"origin_exact_match", "OPTIONS", allowed + ".evil.test", "POST", "Content-Type", 403, false},
		{"empty_allowlist", "OPTIONS", "null", "POST", "Content-Type", 403, false},
		{"origin_scheme_matters", "OPTIONS", "http://frontend.example.test", "POST", "Content-Type", 403, false},
		{"reject_method", "OPTIONS", allowed, "TRACE", "", 403, false},
		{"reject_header", "OPTIONS", allowed, "POST", "Content-Type, X-Evil", 403, false},
		{"ordinary_options", "OPTIONS", allowed, "", "", 401, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := gin.New()
			r.Use(RequestID(), CORS([]string{allowed}))
			r.Any("/resource", func(c *gin.Context) { response.Error(c, 401, "unauthorized", "Need a token") })
			req := httptest.NewRequest(tc.method, "/resource", nil)
			if tc.origin != "" {
				req.Header.Set("Origin", tc.origin)
			}
			if tc.requestedMethod != "" {
				req.Header.Set("Access-Control-Request-Method", tc.requestedMethod)
			}
			if tc.requestedHeaders != "" {
				req.Header.Set("Access-Control-Request-Headers", tc.requestedHeaders)
			}
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, req)
			if rec.Code != tc.status {
				t.Fatalf("status %d want %d", rec.Code, tc.status)
			}
			permission := rec.Header().Get("Access-Control-Allow-Origin")
			if (permission != "") != tc.permission || (permission != "" && permission != allowed) {
				t.Fatalf("unexpected origin permission %q", permission)
			}
			if rec.Header().Get("Access-Control-Allow-Credentials") != "" {
				t.Fatal("cookie credentials must remain disabled")
			}
			if !strings.Contains(strings.Join(rec.Header().Values("Vary"), ","), "Origin") {
				t.Fatal("missing cache variance")
			}
			if rec.Header().Get("X-Request-ID") == "" {
				t.Fatal("missing request ID")
			}
			if rec.Code == 204 {
				if rec.Body.Len() != 0 {
					t.Fatal("preflight must have no body")
				}
				if rec.Header().Get("Access-Control-Allow-Methods") == "" || rec.Header().Get("Access-Control-Allow-Headers") == "" {
					t.Fatal("missing preflight permission")
				}
			} else {
				var body map[string]any
				if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
					t.Fatal(err)
				}
				details, ok := body["error"].(map[string]any)
				if !ok || details["requestId"] != rec.Header().Get("X-Request-ID") {
					t.Fatal("error must preserve common envelope")
				}
			}
		})
	}
}

func TestCORSDuplicateHeadersAndVary(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, field := range []string{"Origin", "Access-Control-Request-Method"} {
		t.Run(field, func(t *testing.T) {
			r := gin.New()
			r.Use(RequestID(), CORS([]string{"https://frontend.example.test"}))
			r.Any("/resource", func(c *gin.Context) { c.Status(200) })
			req := httptest.NewRequest("OPTIONS", "/resource", nil)
			req.Header.Set("Origin", "https://frontend.example.test")
			req.Header.Set("Access-Control-Request-Method", "POST")
			req.Header.Add(field, req.Header.Get(field))
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, req)
			if rec.Code < 400 || rec.Header().Get("Access-Control-Allow-Origin") != "" {
				t.Fatal("duplicate singleton header must be rejected")
			}
		})
	}
	header := http.Header{"Vary": []string{"Accept-Encoding, Origin"}}
	addVary(header, "Origin")
	addVary(header, "Access-Control-Request-Headers")
	if strings.Count(strings.Join(header.Values("Vary"), ","), "Origin") != 1 {
		t.Fatal("Vary duplicated or replaced")
	}
}

func TestCORSEmptyAllowlist(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RequestID(), CORS(nil))
	r.GET("/resource", func(c *gin.Context) { c.Status(200) })
	req := httptest.NewRequest("OPTIONS", "/resource", nil)
	req.Header.Set("Origin", "https://frontend.example.test")
	req.Header.Set("Access-Control-Request-Method", "GET")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != 403 || rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("empty configuration must not grant browser access")
	}
}
