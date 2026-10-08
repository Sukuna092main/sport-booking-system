package user

import (
	"encoding/json"
	"net/http"

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
		response.Error(c, http.StatusUnauthorized, "unauthorized", "Cần đăng nhập.")
		return "", false
	}
	return actor.ID, true
}

func (h *Handler) Get(c *gin.Context) {
	id, ok := actorID(c)
	if !ok {
		return
	}
	u, err := h.service.Get(c.Request.Context(), id)
	if err != nil {
		apperror.Write(c, err)
		return
	}
	response.Data(c, http.StatusOK, u)
}

func (h *Handler) Update(c *gin.Context) {
	id, ok := actorID(c)
	if !ok {
		return
	}
	var fields map[string]json.RawMessage
	if err := httpinput.JSON(c, &fields); err != nil {
		apperror.Write(c, err)
		return
	}
	u, err := h.service.Update(c.Request.Context(), id, fields)
	if err != nil {
		apperror.Write(c, err)
		return
	}
	response.Data(c, http.StatusOK, u)
}
