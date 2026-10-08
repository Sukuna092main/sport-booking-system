package bootstrap

import (
	"database/sql"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	auth "github.com/Sukuna092main/sport-booking-system/backend/internal/Auth"
	court "github.com/Sukuna092main/sport-booking-system/backend/internal/Court"
	health "github.com/Sukuna092main/sport-booking-system/backend/internal/Health"
	sporttype "github.com/Sukuna092main/sport-booking-system/backend/internal/SportType"
	user "github.com/Sukuna092main/sport-booking-system/backend/internal/User"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/config"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/middleware"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/openapi"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/response"
)

func NewRouter(cfg config.Config, log *slog.Logger, db *sql.DB) *gin.Engine {
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
	router.Use(middleware.RequestID(), middleware.AccessLog(log), middleware.Recovery(log))
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
	users := user.NewRepository(db)
	tokens := auth.NewTokens(cfg.JWTSecret, cfg.AppName, cfg.JWTTTL, time.Now)
	authHandler := auth.NewHandler(auth.NewService(users, tokens))
	v1.POST("/auth/register", authHandler.Register)
	v1.POST("/auth/login", authHandler.Login)
	profile := user.NewHandler(user.NewService(users))
	protected := v1.Group("/users", auth.Authenticate(users, tokens))
	protected.GET("/me", profile.Get)
	protected.PATCH("/me", profile.Update)
	courts := court.NewHandler(court.NewService(court.NewRepository(db)))
	v1.GET("/courts", courts.List)
	v1.GET("/courts/:courtId", courts.Detail)
	sports := sporttype.NewHandler(sporttype.NewService(sporttype.NewRepository(db)))
	v1.GET("/sport-types", sports.List)
	openapi.Register(v1)

	return router
}
