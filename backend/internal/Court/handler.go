package court

import (
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/response"
	"github.com/gin-gonic/gin"
	"net/http"
	"net/url"
)

type Handler struct{ service *Service }

func NewHandler(service *Service) *Handler { return &Handler{service: service} }
func (h *Handler) List(c *gin.Context) {
	query, err := url.ParseQuery(c.Request.URL.RawQuery)
	if err != nil {
		apperror.Write(c, apperror.Invalid("query", "Query không hợp lệ."))
		return
	}
	result, err := h.service.List(c.Request.Context(), query)
	if err != nil {
		apperror.Write(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}
func (h *Handler) Detail(c *gin.Context) {
	value, err := h.service.Detail(c.Request.Context(), c.Param("courtId"))
	if err != nil {
		apperror.Write(c, err)
		return
	}
	response.Data(c, http.StatusOK, value)
}
