package bootstrap

import (
	"log/slog"

	"github.com/gin-gonic/gin"

	health "github.com/Sukuna092main/sport-booking-system/backend/internal/Health"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/config"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/middleware"
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
	router.Use(gin.Recovery(), middleware.RequestID(), middleware.AccessLog(log))
	_ = router.SetTrustedProxies(nil)

	healthRepository := health.NewConfigRepository(cfg.AppName, cfg.Environment)
	healthService := health.NewService(healthRepository)
	healthHandler := health.NewHandler(healthService)

	v1 := router.Group("/api/v1")
	v1.GET("/ping", healthHandler.Ping)

	return router
}
