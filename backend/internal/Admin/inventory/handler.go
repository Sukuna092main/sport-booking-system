package inventory

import (
	"database/sql"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/httpinput"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/identity"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/response"
	"github.com/gin-gonic/gin"
	"net/url"
)

type Handler struct{ service *Service }

func Register(routes *gin.RouterGroup, db *sql.DB) {
	h := &Handler{service: &Service{repo: &SQLRepository{db: db}}}
	routes.GET("/sport-types", h.listSports)
	routes.POST("/sport-types", h.saveSport)
	routes.PATCH("/sport-types/:sportTypeId", h.saveSport)
	routes.DELETE("/sport-types/:sportTypeId", h.deleteSport)
	routes.GET("/courts", h.listCourts)
	routes.POST("/courts", h.saveCourt)
	routes.PATCH("/courts/:courtId", h.saveCourt)
	routes.DELETE("/courts/:courtId", h.deleteCourt)
}
func actor(c *gin.Context) (string, bool) {
	a, ok := identity.Get(c)
	if !ok {
		response.Error(c, 401, "unauthorized", "Cần đăng nhập.")
		return "", false
	}
	return a.ID, true
}
func (h *Handler) listSports(c *gin.Context) {
	v, err := h.service.ListSports(c.Request.Context())
	if err != nil {
		apperror.Write(c, err)
		return
	}
	response.Data(c, 200, v)
}
func (h *Handler) listCourts(c *gin.Context) {
	q, err := url.ParseQuery(c.Request.URL.RawQuery)
	if err != nil {
		apperror.Write(c, invalid("query"))
		return
	}
	v, err := h.service.ListCourts(c.Request.Context(), q)
	if err != nil {
		apperror.Write(c, err)
		return
	}
	c.JSON(200, v)
}
func (h *Handler) saveSport(c *gin.Context) {
	a, ok := actor(c)
	if !ok {
		return
	}
	var f Fields
	if err := httpinput.JSON(c, &f); err != nil {
		apperror.Write(c, err)
		return
	}
	v, err := h.service.SaveSport(c.Request.Context(), c.Param("sportTypeId"), a, c.GetString("request_id"), f)
	if err != nil {
		apperror.Write(c, err)
		return
	}
	status := 200
	if c.Request.Method == "POST" {
		status = 201
	}
	response.Data(c, status, v)
}
func (h *Handler) saveCourt(c *gin.Context) {
	a, ok := actor(c)
	if !ok {
		return
	}
	var f Fields
	if err := httpinput.JSON(c, &f); err != nil {
		apperror.Write(c, err)
		return
	}
	v, err := h.service.SaveCourt(c.Request.Context(), c.Param("courtId"), a, c.GetString("request_id"), f)
	if err != nil {
		apperror.Write(c, err)
		return
	}
	status := 200
	if c.Request.Method == "POST" {
		status = 201
	}
	response.Data(c, status, v)
}
func (h *Handler) deleteSport(c *gin.Context) { h.delete(c, false, c.Param("sportTypeId")) }
func (h *Handler) deleteCourt(c *gin.Context) { h.delete(c, true, c.Param("courtId")) }
func (h *Handler) delete(c *gin.Context, isCourt bool, id string) {
	a, ok := actor(c)
	if !ok {
		return
	}
	if err := h.service.Delete(c.Request.Context(), isCourt, id, a, c.GetString("request_id")); err != nil {
		apperror.Write(c, err)
		return
	}
	c.Status(204)
}
