package auth

import (
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/httpinput"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/response"
	"github.com/gin-gonic/gin"
	"net/http"
)

type Handler struct{ service *Service }

func NewHandler(service *Service) *Handler { return &Handler{service: service} }
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
	response.Data(c, http.StatusOK, data)
}
