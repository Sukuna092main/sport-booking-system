package schedule

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/httpinput"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/identity"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/response"
	"github.com/gin-gonic/gin"
)

type Handler struct{ service *Service }

// Register uses the venue default. Applications with a configured venue timezone
// should use RegisterWithTimezone.
func Register(routes *gin.RouterGroup, db *sql.DB) {
	RegisterWithTimezone(routes, db, "Asia/Ho_Chi_Minh")
}
func RegisterWithTimezone(routes *gin.RouterGroup, db *sql.DB, timeZone string) {
	h := &Handler{NewService(NewRepository(db), timeZone)}
	routes.GET("/courts/:courtId/operating-hours", h.hours)
	routes.PUT("/courts/:courtId/operating-hours", h.replace)
	routes.GET("/courts/:courtId/blackouts", h.blackouts)
	routes.POST("/courts/:courtId/blackouts", h.create)
	routes.PATCH("/courts/:courtId/blackouts/:blackoutId", h.patch)
	routes.DELETE("/courts/:courtId/blackouts/:blackoutId", h.remove)
}
func actorID(c *gin.Context) (string, bool) {
	actor, ok := identity.Get(c)
	if !ok {
		response.Error(c, 401, "unauthorized", "Cần đăng nhập.")
	}
	return actor.ID, ok
}
func (h *Handler) hours(c *gin.Context) {
	v, err := h.service.Hours(c.Request.Context(), c.Param("courtId"))
	if err != nil {
		apperror.Write(c, err)
		return
	}
	response.Data(c, 200, v)
}
func (h *Handler) replace(c *gin.Context) {
	actor, ok := actorID(c)
	if !ok {
		return
	}
	var body struct {
		Hours *[]OperatingHour `json:"hours"`
	}
	if err := httpinput.JSON(c, &body); err != nil {
		apperror.Write(c, err)
		return
	}
	if body.Hours == nil {
		apperror.Write(c, apperror.Invalid("hours", "Phải gửi mảng hours."))
		return
	}
	v, err := h.service.Replace(c.Request.Context(), c.Param("courtId"), actor, c.GetString("request_id"), *body.Hours)
	if err != nil {
		apperror.Write(c, err)
		return
	}
	response.Data(c, 200, v)
}
func (h *Handler) blackouts(c *gin.Context) {
	v, err := h.service.Blackouts(c.Request.Context(), c.Param("courtId"))
	if err != nil {
		apperror.Write(c, err)
		return
	}
	response.Data(c, 200, v)
}
func (h *Handler) create(c *gin.Context) {
	actor, ok := actorID(c)
	if !ok {
		return
	}
	var body struct {
		StartsAt *time.Time `json:"startsAt"`
		EndsAt   *time.Time `json:"endsAt"`
		Reason   *string    `json:"reason"`
	}
	if err := httpinput.JSON(c, &body); err != nil {
		apperror.Write(c, err)
		return
	}
	if body.StartsAt == nil || body.EndsAt == nil {
		apperror.Write(c, apperror.Invalid("startsAt", "Phải gửi startsAt và endsAt."))
		return
	}
	v, err := h.service.Create(c.Request.Context(), c.Param("courtId"), actor, c.GetString("request_id"), Blackout{StartsAt: *body.StartsAt, EndsAt: *body.EndsAt, Reason: body.Reason})
	if err != nil {
		apperror.Write(c, err)
		return
	}
	response.Data(c, 201, v)
}

type BlackoutPatch struct {
	StartsAt  *time.Time
	EndsAt    *time.Time
	Reason    *string
	ReasonSet bool
	IsActive  *bool
}

func parsePatch(raw map[string]json.RawMessage) (BlackoutPatch, error) {
	var p BlackoutPatch
	if len(raw) == 0 {
		return p, apperror.Invalid("body", "Phải gửi ít nhất một trường.")
	}
	for key, value := range raw {
		if bytes.Equal(bytes.TrimSpace(value), []byte("null")) && key != "reason" {
			return p, apperror.Invalid(key, "Trường không được null.")
		}
		var err error
		switch key {
		case "startsAt":
			err = json.Unmarshal(value, &p.StartsAt)
		case "endsAt":
			err = json.Unmarshal(value, &p.EndsAt)
		case "reason":
			p.ReasonSet = true
			err = json.Unmarshal(value, &p.Reason)
		case "isActive":
			err = json.Unmarshal(value, &p.IsActive)
		default:
			return p, apperror.Invalid(key, "Trường không được hỗ trợ.")
		}
		if err != nil {
			return p, apperror.Invalid(key, "Sai định dạng dữ liệu.")
		}
	}
	return p, nil
}
func (h *Handler) patch(c *gin.Context) {
	actor, ok := actorID(c)
	if !ok {
		return
	}
	var raw map[string]json.RawMessage
	if err := httpinput.JSON(c, &raw); err != nil {
		apperror.Write(c, err)
		return
	}
	input, err := parsePatch(raw)
	if err != nil {
		apperror.Write(c, err)
		return
	}
	v, err := h.service.Patch(c.Request.Context(), c.Param("courtId"), c.Param("blackoutId"), actor, c.GetString("request_id"), input)
	if err != nil {
		apperror.Write(c, err)
		return
	}
	response.Data(c, 200, v)
}
func (h *Handler) remove(c *gin.Context) {
	actor, ok := actorID(c)
	if !ok {
		return
	}
	if err := h.service.Delete(c.Request.Context(), c.Param("courtId"), c.Param("blackoutId"), actor, c.GetString("request_id")); err != nil {
		apperror.Write(c, err)
		return
	}
	c.Status(204)
}
