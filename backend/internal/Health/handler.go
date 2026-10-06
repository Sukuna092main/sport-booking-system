package health

import (
	"net/http"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/response"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Ping(c *gin.Context) {
	result, err := h.service.Ping(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "service_unavailable", "Dịch vụ tạm thời không sẵn sàng.")
		return
	}
	c.JSON(http.StatusOK, result)
}
