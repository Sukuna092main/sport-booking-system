package health

import (
	"net/http"

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
		c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": gin.H{"code": "service_unavailable", "message": "service is unavailable"}})
		return
	}
	c.JSON(http.StatusOK, result)
}
