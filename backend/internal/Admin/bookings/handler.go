package bookings

import (
	"database/sql"
	"net/http"
	"net/url"
	"time"

	booking "github.com/Sukuna092main/sport-booking-system/backend/internal/Booking"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/httpinput"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/identity"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/response"
	"github.com/gin-gonic/gin"
)

type Handler struct{ service *Service }

// Register requires the parent group to authenticate and authorize the current
// database ADMIN role, exactly as the other administrative route modules do.
func Register(routes *gin.RouterGroup, db *sql.DB, location *time.Location, now func() time.Time) {
	h := &Handler{service: NewService(booking.NewRepository(db, location, now))}
	routes.GET("/bookings", h.List)
	routes.GET("/bookings/:bookingId", h.Detail)
	routes.POST("/bookings/:bookingId/cancel", h.Cancel)
	routes.GET("/statistics", h.Statistics)
}
func query(c *gin.Context) (url.Values, error) {
	q, err := url.ParseQuery(c.Request.URL.RawQuery)
	if err != nil {
		return nil, apperror.Invalid("query", "Query không hợp lệ.")
	}
	return q, nil
}
func (h *Handler) List(c *gin.Context) {
	q, err := query(c)
	if err != nil {
		apperror.Write(c, err)
		return
	}
	value, err := h.service.List(c.Request.Context(), q)
	if err != nil {
		apperror.Write(c, err)
		return
	}
	c.JSON(http.StatusOK, value)
}
func (h *Handler) Detail(c *gin.Context) {
	value, err := h.service.Detail(c.Request.Context(), c.Param("bookingId"))
	if err != nil {
		apperror.Write(c, err)
		return
	}
	response.Data(c, http.StatusOK, value)
}
func (h *Handler) Cancel(c *gin.Context) {
	actor, ok := identity.Get(c)
	if !ok {
		response.Error(c, 401, "unauthorized", "Cần đăng nhập.")
		return
	}
	var input CancelRequest
	if err := httpinput.JSON(c, &input); err != nil {
		apperror.Write(c, err)
		return
	}
	value, err := h.service.Cancel(c.Request.Context(), actor.ID, c.Param("bookingId"), c.GetString("request_id"), input)
	if err != nil {
		apperror.Write(c, err)
		return
	}
	response.Data(c, http.StatusOK, value)
}
func (h *Handler) Statistics(c *gin.Context) {
	q, err := query(c)
	if err != nil {
		apperror.Write(c, err)
		return
	}
	value, err := h.service.Statistics(c.Request.Context(), q)
	if err != nil {
		apperror.Write(c, err)
		return
	}
	response.Data(c, http.StatusOK, value)
}
