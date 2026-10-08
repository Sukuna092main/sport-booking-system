package auth

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	user "github.com/Sukuna092main/sport-booking-system/backend/internal/User"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/identity"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/response"
)

func Authenticate(users user.Repository, tokens *Tokens) gin.HandlerFunc {
	return func(c *gin.Context) {
		headers := c.Request.Header.Values("Authorization")
		parts := strings.Fields(c.GetHeader("Authorization"))
		if len(headers) != 1 || len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || len(parts[1]) > 4096 {
			unauthorized(c)
			return
		}
		claims, err := tokens.Verify(parts[1])
		if err != nil {
			unauthorized(c)
			return
		}
		u, err := users.ByID(c.Request.Context(), claims.Subject)
		if errors.Is(err, user.ErrNotFound) {
			unauthorized(c)
			return
		}
		if err != nil {
			apperror.Write(c, err)
			return
		}
		if u.Status != "ACTIVE" {
			response.Error(c, http.StatusForbidden, "account_inactive", "Tài khoản không hoạt động.")
			return
		}
		if u.Role != "USER" && u.Role != "ADMIN" {
			response.Error(c, http.StatusForbidden, "forbidden", "Không đủ quyền truy cập.")
			return
		}
		// DB is authoritative: stale JWT role cannot retain revoked privileges.
		identity.Set(c, identity.Actor{ID: u.ID, Role: u.Role})
		c.Next()
	}
}

func RequireRole(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		actor, ok := identity.Get(c)
		if !ok {
			unauthorized(c)
			return
		}
		if actor.Role != role {
			response.Error(c, http.StatusForbidden, "forbidden", "Không đủ quyền truy cập.")
			return
		}
		c.Next()
	}
}

func unauthorized(c *gin.Context) {
	response.Error(c, http.StatusUnauthorized, "unauthorized", "Cần đăng nhập bằng token hợp lệ.")
}
