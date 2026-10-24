package booking

import (
	"net/http"
	"net/url"

	"github.com/gin-gonic/gin"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/httpinput"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/identity"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/response"
)

type Handler struct{ service *Service }

func NewHandler(service *Service) *Handler { return &Handler{service: service} }

func actorID(c *gin.Context) (string, bool) {
	actor, ok := identity.Get(c)
	if !ok {
		response.Error(c, 401, "unauthorized", "Cần đăng nhập.")
		return "", false
	}
	return actor.ID, true
}

func (h *Handler) Create(c *gin.Context) {
	id, ok := actorID(c)
	if !ok {
		return
	}
	keys := c.Request.Header.Values("Idempotency-Key")
	if len(keys) != 1 {
		apperror.Write(c, apperror.Invalid("Idempotency-Key", "Phải gửi đúng một header Idempotency-Key."))
		return
	}
	var input CreateRequest
	if err := httpinput.JSON(c, &input); err != nil {
		apperror.Write(c, err)
		return
	}
	value, replay, err := h.service.Create(c.Request.Context(), id, keys[0], c.GetString("request_id"), input)
	if err != nil {
		apperror.Write(c, err)
		return
	}
	status := http.StatusCreated
	if replay {
		status = http.StatusOK
	}
	response.Data(c, status, value)
}

func (h *Handler) List(c *gin.Context) {
	id, ok := actorID(c)
	if !ok {
		return
	}
	query, err := url.ParseQuery(c.Request.URL.RawQuery)
	if err != nil {
		apperror.Write(c, apperror.Invalid("query", "Query không hợp lệ."))
		return
	}
	result, err := h.service.List(c.Request.Context(), id, query)
	if err != nil {
		apperror.Write(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) Detail(c *gin.Context) {
	id, ok := actorID(c)
	if !ok {
		return
	}
	value, err := h.service.Detail(c.Request.Context(), id, c.Param("bookingId"))
	if err != nil {
		apperror.Write(c, err)
		return
	}
	response.Data(c, http.StatusOK, value)
}

func (h *Handler) Cancel(c *gin.Context) {
	id, ok := actorID(c)
	if !ok {
		return
	}
	// This operation has no request body; ownership and cancellation time are
	// taken from verified identity and stored snapshots, never client fields.
	value, err := h.service.Cancel(c.Request.Context(), id, c.Param("bookingId"), c.GetString("request_id"))
	if err != nil {
		apperror.Write(c, err)
		return
	}
	response.Data(c, http.StatusOK, value)
}
