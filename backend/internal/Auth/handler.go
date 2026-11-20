package auth

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/httpinput"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/identity"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/response"
)

const refreshCookieName = "sb_refresh_token"

type CookieConfig struct {
	Secure   bool
	SameSite http.SameSite
	TTL      time.Duration
}
type Handler struct {
	service *Service
	cookie  CookieConfig
}

func NewHandler(service *Service, cookie ...CookieConfig) *Handler {
	value := CookieConfig{TTL: 7 * 24 * time.Hour, SameSite: http.SameSiteLaxMode}
	if len(cookie) > 0 {
		value = cookie[0]
	}
	if value.TTL <= 0 {
		value.TTL = 7 * 24 * time.Hour
	}
	if value.SameSite == 0 {
		value.SameSite = http.SameSiteLaxMode
	}
	return &Handler{service: service, cookie: value}
}

func (h *Handler) setRefreshCookie(c *gin.Context, value string, maxAge int) {
	if value == "" {
		return
	}
	c.SetSameSite(h.cookie.SameSite)
	c.SetCookie(refreshCookieName, value, maxAge, "/api/v1/auth", "", h.cookie.Secure, true)
}

func (h *Handler) clearRefreshCookie(c *gin.Context) {
	c.SetSameSite(h.cookie.SameSite)
	c.SetCookie(refreshCookieName, "", -1, "/api/v1/auth", "", h.cookie.Secure, true)
}

func (h *Handler) Register(c *gin.Context) {
	var in RegisterRequest
	if err := httpinput.JSON(c, &in); err != nil {
		apperror.Write(c, err)
		return
	}
	u, err := h.service.Register(c.Request.Context(), in)
	if err != nil {
		apperror.Write(c, err)
		return
	}
	response.Data(c, http.StatusCreated, u)
}
func (h *Handler) Login(c *gin.Context) {
	var in LoginRequest
	if err := httpinput.JSON(c, &in); err != nil {
		apperror.Write(c, err)
		return
	}
	data, err := h.service.Login(c.Request.Context(), in)
	if err != nil {
		apperror.Write(c, err)
		return
	}
	h.setRefreshCookie(c, data.RefreshToken, int(h.cookie.TTL.Seconds()))
	response.Data(c, http.StatusOK, data)
}

func (h *Handler) Refresh(c *gin.Context) {
	raw, _ := c.Cookie(refreshCookieName)
	data, err := h.service.Refresh(c.Request.Context(), raw)
	if err != nil {
		apperror.Write(c, err)
		return
	}
	h.setRefreshCookie(c, data.RefreshToken, int(h.cookie.TTL.Seconds()))
	response.Data(c, http.StatusOK, data)
}

func (h *Handler) Logout(c *gin.Context) {
	raw, _ := c.Cookie(refreshCookieName)
	if err := h.service.Logout(c.Request.Context(), raw); err != nil {
		apperror.Write(c, err)
		return
	}
	h.clearRefreshCookie(c)
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "Đã đăng xuất."}})
}

func (h *Handler) LogoutAll(c *gin.Context) {
	actor, ok := identity.Get(c)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "unauthorized", "Cần đăng nhập bằng token hợp lệ.")
		return
	}
	if err := h.service.LogoutAll(c.Request.Context(), actor.ID); err != nil {
		apperror.Write(c, err)
		return
	}
	h.clearRefreshCookie(c)
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "Đã đăng xuất khỏi mọi thiết bị."}})
}

func (h *Handler) ForgotPassword(c *gin.Context) {
	var in struct {
		Email string `json:"email"`
	}
	if err := httpinput.JSON(c, &in); err != nil {
		apperror.Write(c, err)
		return
	}
	if err := h.service.ForgotPassword(c.Request.Context(), in.Email); err != nil {
		apperror.Write(c, err)
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"data": gin.H{"message": "Nếu email thuộc một tài khoản hợp lệ, hướng dẫn đặt lại mật khẩu sẽ được gửi."}})
}

func (h *Handler) ResetPassword(c *gin.Context) {
	var in ResetPasswordRequest
	if err := httpinput.JSON(c, &in); err != nil {
		apperror.Write(c, err)
		return
	}
	if err := h.service.ResetPassword(c.Request.Context(), in); err != nil {
		apperror.Write(c, err)
		return
	}
	h.clearRefreshCookie(c)
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "Mật khẩu đã được đặt lại. Hãy đăng nhập bằng mật khẩu mới."}})
}

func (h *Handler) ChangePassword(c *gin.Context) {
	actor, ok := identity.Get(c)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "unauthorized", "Cần đăng nhập bằng token hợp lệ.")
		return
	}
	var in ChangePasswordRequest
	if err := httpinput.JSON(c, &in); err != nil {
		apperror.Write(c, err)
		return
	}
	if err := h.service.ChangePassword(c.Request.Context(), actor.ID, in); err != nil {
		apperror.Write(c, err)
		return
	}
	h.clearRefreshCookie(c)
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "Đã đổi mật khẩu. Hãy đăng nhập lại."}})
}
