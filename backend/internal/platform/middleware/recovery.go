package middleware

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/response"
)

// Recovery preserves the error contract and never logs headers, body or panic values.
func Recovery(log *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if recover() != nil {
				log.ErrorContext(c.Request.Context(), "HTTP handler panicked", "request_id", c.GetString(requestIDKey))
				if !c.Writer.Written() {
					response.Error(c, http.StatusInternalServerError, "internal_error", "Có lỗi hệ thống. Vui lòng thử lại.")
				} else {
					c.Abort()
				}
			}
		}()
		c.Next()
	}
}
