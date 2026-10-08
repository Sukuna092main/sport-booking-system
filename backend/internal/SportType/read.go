package sporttype

import (
	"context"
	"database/sql"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/response"
	"github.com/gin-gonic/gin"
	"net/http"
)

type SportType struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	IsActive    bool    `json:"isActive"`
}
type Repository interface {
	ListActive(context.Context) ([]SportType, error)
}
type SQLRepository struct{ db *sql.DB }

func NewRepository(db *sql.DB) *SQLRepository { return &SQLRepository{db: db} }
func (r *SQLRepository) ListActive(ctx context.Context) ([]SportType, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT id::text,name,description,is_active FROM sport_types WHERE is_active ORDER BY name,id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]SportType, 0)
	for rows.Next() {
		var s SportType
		if err = rows.Scan(&s.ID, &s.Name, &s.Description, &s.IsActive); err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, rows.Err()
}

type Service struct{ repo Repository }

func NewService(repo Repository) *Service                        { return &Service{repo: repo} }
func (s *Service) List(ctx context.Context) ([]SportType, error) { return s.repo.ListActive(ctx) }

type Handler struct{ service *Service }

func NewHandler(service *Service) *Handler { return &Handler{service: service} }
func (h *Handler) List(c *gin.Context) {
	rows, err := h.service.List(c.Request.Context())
	if err != nil {
		apperror.Write(c, err)
		return
	}
	response.Data(c, http.StatusOK, rows)
}
