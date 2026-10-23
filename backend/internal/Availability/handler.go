package availability

import (
	"net/http"
	"net/url"

	"github.com/gin-gonic/gin"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/response"
)

type Handler struct{ service *Service }

func NewHandler(service *Service) *Handler { return &Handler{service: service} }
func (h *Handler) Read(c *gin.Context) {
	query, err := url.ParseQuery(c.Request.URL.RawQuery)
	if err != nil || len(query["date"]) != 1 {
		apperror.Write(c, apperror.Invalid("date", "Phải gửi đúng một ngày YYYY-MM-DD."))
		return
	}
	result, err := h.service.Read(c.Request.Context(), c.Param("courtId"), query.Get("date"))
	if err != nil {
		apperror.Write(c, err)
		return
	}
	response.Data(c, http.StatusOK, result)
}
