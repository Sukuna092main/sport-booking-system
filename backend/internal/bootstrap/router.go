package bootstrap

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	health "github.com/Sukuna092main/sport-booking-system/backend/internal/Health"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/config"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/middleware"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/openapi"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/response"
)

func NewRouter(cfg config.Config, log *slog.Logger) *gin.Engine {
	switch cfg.Environment {
	case "production":
		gin.SetMode(gin.ReleaseMode)
	case "test":
		gin.SetMode(gin.TestMode)
	default:
		gin.SetMode(gin.DebugMode)
	}

	router := gin.New()
	router.HandleMethodNotAllowed = true
	router.Use(gin.Recovery(), middleware.RequestID(), middleware.AccessLog(log))
	_ = router.SetTrustedProxies(nil)
	router.NoRoute(func(c *gin.Context) {
		response.Error(c, http.StatusNotFound, "not_found", "Không tìm thấy tài nguyên.")
	})
	router.NoMethod(func(c *gin.Context) {
		response.Error(c, http.StatusMethodNotAllowed, "method_not_allowed", "Phương thức HTTP không được hỗ trợ.")
	})

	healthRepository := health.NewConfigRepository(cfg.AppName, cfg.Environment)
	healthService := health.NewService(healthRepository)
	healthHandler := health.NewHandler(healthService)

	v1 := router.Group("/api/v1")
	v1.GET("/ping", healthHandler.Ping)
	openapi.Register(v1)

	return router
}
