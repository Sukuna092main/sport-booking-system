package middleware

import (
	"net/http"
	"strings"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/response"
	"github.com/gin-gonic/gin"
)

// CORS applies an exact origin allowlist for browser access without changing API authentication.
func CORS(origins []string) gin.HandlerFunc {
	allowedOrigins := make(map[string]bool, len(origins))
	for _, origin := range origins {
		allowedOrigins[origin] = true
	}
	methods := map[string]bool{"GET": true, "HEAD": true, "POST": true, "PUT": true, "PATCH": true, "DELETE": true}
	headers := map[string]bool{"authorization": true, "content-type": true, "accept": true, "x-request-id": true}
	return func(c *gin.Context) {
		addVary(c.Writer.Header(), "Origin")
		originValues := c.Request.Header.Values("Origin")
		if len(originValues) == 0 {
			c.Next()
			return
		}
		if len(originValues) != 1 {
			response.Error(c, 400, "cors_invalid_request", "Origin không hợp lệ.")
			return
		}
		origin := originValues[0]
		methodValues := c.Request.Header.Values("Access-Control-Request-Method")
		preflight := c.Request.Method == http.MethodOptions && len(methodValues) > 0
		if preflight {
			addVary(c.Writer.Header(), "Access-Control-Request-Method")
			addVary(c.Writer.Header(), "Access-Control-Request-Headers")
			if !allowedOrigins[origin] {
				response.Error(c, 403, "cors_origin_not_allowed", "Origin không được phép.")
				return
			}
			if len(methodValues) != 1 || !methods[strings.TrimSpace(methodValues[0])] {
				response.Error(c, 403, "cors_method_not_allowed", "Phương thức CORS không được phép.")
				return
			}
			for _, line := range c.Request.Header.Values("Access-Control-Request-Headers") {
				for _, field := range strings.Split(line, ",") {
					field = strings.ToLower(strings.TrimSpace(field))
					if field != "" && !headers[field] {
						response.Error(c, 403, "cors_header_not_allowed", "Header CORS không được phép.")
						return
					}
				}
			}
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, PATCH, DELETE")
			c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, X-Request-ID")
			c.Header("Access-Control-Max-Age", "600")
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		// An unlisted origin receives no CORS permission. Same-origin Swagger and nonbrowser clients
		// retain normal behavior; CORS is not a replacement for JWT/role authorization.
		if allowedOrigins[origin] {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Expose-Headers", "X-Request-ID")
		}
		c.Next()
	}
}

func addVary(header http.Header, value string) {
	for _, line := range header.Values("Vary") {
		for _, field := range strings.Split(line, ",") {
			if field = strings.TrimSpace(field); field == "*" || strings.EqualFold(field, value) {
				return
			}
		}
	}
	header.Add("Vary", value)
}
