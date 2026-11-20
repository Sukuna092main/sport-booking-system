package bootstrap

import (
	"database/sql"
	"log/slog"
	"net/http"
	"time"

	adminbookings "github.com/Sukuna092main/sport-booking-system/backend/internal/Admin/bookings"
	admininventory "github.com/Sukuna092main/sport-booking-system/backend/internal/Admin/inventory"
	adminschedule "github.com/Sukuna092main/sport-booking-system/backend/internal/Admin/schedule"
	"github.com/gin-gonic/gin"

	auth "github.com/Sukuna092main/sport-booking-system/backend/internal/Auth"
	availability "github.com/Sukuna092main/sport-booking-system/backend/internal/Availability"
	booking "github.com/Sukuna092main/sport-booking-system/backend/internal/Booking"
	court "github.com/Sukuna092main/sport-booking-system/backend/internal/Court"
	health "github.com/Sukuna092main/sport-booking-system/backend/internal/Health"
	notification "github.com/Sukuna092main/sport-booking-system/backend/internal/Notification"
	payment "github.com/Sukuna092main/sport-booking-system/backend/internal/Payment"
	sporttype "github.com/Sukuna092main/sport-booking-system/backend/internal/SportType"
	user "github.com/Sukuna092main/sport-booking-system/backend/internal/User"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/config"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/middleware"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/openapi"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/response"
)

func NewRouter(cfg config.Config, log *slog.Logger, db *sql.DB) *gin.Engine {
	return newRouter(cfg, log, db, time.Now)
}

func newRouter(cfg config.Config, log *slog.Logger, db *sql.DB, now func() time.Time) *gin.Engine {
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
	router.Use(middleware.CORS(cfg.CORSAllowedOrigins, true))
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
	tokens := auth.NewTokens(cfg.JWTSecret, cfg.AppName, cfg.JWTTTL, now)
	var resetQueue notification.EmailQueue
	if cfg.EmailEnabled {
		encryptor, err := notification.NewEncryptor(cfg.EmailEncryptionKey)
		if err != nil {
			panic("EMAIL_ENCRYPTION_KEY must be configured before email features are enabled")
		}
		resetQueue = notification.NewSQLQueue(encryptor)
	}
	sessions := auth.NewSQLSessionStore(db)
	authService := auth.NewServiceWithOptions(users, tokens, auth.Options{
		Sessions: sessions, Credentials: auth.NewSQLCredentialStore(db), ResetQueue: resetQueue,
		RefreshTTL: cfg.RefreshTokenTTL, ResetTTL: cfg.PasswordResetTTL, FrontendPublicURL: cfg.FrontendPublicURL,
	})
	sameSite := http.SameSiteLaxMode
	switch cfg.RefreshCookieSameSite {
	case "strict":
		sameSite = http.SameSiteStrictMode
	case "none":
		sameSite = http.SameSiteNoneMode
	}
	authHandler := auth.NewHandler(authService, auth.CookieConfig{Secure: cfg.RefreshCookieSecure, SameSite: sameSite, TTL: cfg.RefreshTokenTTL})
	v1.POST("/auth/register", auth.RateLimitByIP(10, time.Hour), authHandler.Register)
	v1.POST("/auth/login", auth.RateLimitByIP(10, time.Minute), authHandler.Login)
	v1.POST("/auth/refresh", auth.RateLimitByIP(30, time.Minute), auth.RequireAllowedOrigin(cfg.CORSAllowedOrigins), authHandler.Refresh)
	v1.POST("/auth/logout", auth.RequireAllowedOrigin(cfg.CORSAllowedOrigins), authHandler.Logout)
	v1.POST("/auth/forgot-password", auth.RateLimitByIP(5, time.Minute), authHandler.ForgotPassword)
	v1.POST("/auth/reset-password", auth.RateLimitByIP(10, time.Minute), authHandler.ResetPassword)
	profile := user.NewHandler(user.NewService(users))
	protected := v1.Group("/users", auth.Authenticate(users, tokens, sessions))
	protected.GET("/me", profile.Get)
	protected.PATCH("/me", profile.Update)
	account := v1.Group("/auth", auth.Authenticate(users, tokens, sessions))
	account.POST("/logout-all", authHandler.LogoutAll)
	account.POST("/change-password", authHandler.ChangePassword)
	courts := court.NewHandler(court.NewService(court.NewRepository(db)))
	v1.GET("/courts", courts.List)
	v1.GET("/courts/:courtId", courts.Detail)
	sports := sporttype.NewHandler(sporttype.NewService(sporttype.NewRepository(db)))
	v1.GET("/sport-types", sports.List)
	location, err := time.LoadLocation(cfg.AppTimezone)
	if err != nil {
		panic("APP_TIMEZONE must be validated before router initialization")
	}
	availabilityHandler := availability.NewHandler(availability.NewService(availability.NewRepository(db), location, now))
	v1.GET("/courts/:courtId/availability", availabilityHandler.Read)
	myBookings := v1.Group("/bookings", auth.Authenticate(users, tokens, sessions))
	bookingOptions := booking.Options{PaymentEnabled: cfg.PaymentEnabled, PaymentProvider: cfg.PaymentProvider, DepositBPS: cfg.PaymentDepositBPS, PaymentHoldTTL: cfg.PaymentHoldTTL}
	bookings := booking.NewHandler(booking.NewService(booking.NewRepository(db, location, now, cfg.EmailEnabled), bookingOptions))
	myBookings.POST("", bookings.Create)
	myBookings.GET("", bookings.List)
	myBookings.GET("/:bookingId", bookings.Detail)
	myBookings.POST("/:bookingId/cancel", bookings.Cancel)
	paymentRepository := payment.NewRepository(db, location, now, cfg.EmailEnabled)
	var gateway payment.Gateway
	var verifier payment.WebhookVerifier
	if cfg.PaymentProvider == "vnpay" {
		vnpay := payment.NewVNPAYGateway(payment.VNPAYConfig{PaymentURL: cfg.VNPAYPaymentURL, TMNCode: cfg.VNPAYTMNCode, HashSecret: cfg.VNPAYHashSecret, ReturnURL: cfg.VNPAYReturnURL, Location: time.FixedZone("ICT", 7*3600)}, now)
		gateway, verifier = vnpay, vnpay
	} else {
		gateway = payment.NewMockGateway(cfg.FrontendPublicURL)
	}
	paymentService := payment.NewService(paymentRepository, gateway, verifier, payment.Options{Enabled: cfg.PaymentEnabled, Provider: cfg.PaymentProvider, MockAllowed: cfg.Environment != "production", FrontendPublicURL: cfg.FrontendPublicURL}, now)
	paymentHandler := payment.NewHandler(paymentService)
	myBookings.POST("/:bookingId/payments", paymentHandler.StartCheckout)
	myBookings.GET("/:bookingId/payments", paymentHandler.Status)
	mockPayments := v1.Group("/payments/mock", auth.Authenticate(users, tokens, sessions))
	mockPayments.POST("/:orderRef/complete", paymentHandler.CompleteMock)
	v1.GET("/payments/vnpay/return", paymentHandler.VNPAYReturn)
	v1.GET("/payments/vnpay/ipn", paymentHandler.VNPAYIPN)
	v1.GET("/courts/:courtId/pricing", paymentHandler.GetPricing)
	admin := v1.Group("/admin", auth.Authenticate(users, tokens, sessions), auth.RequireRole("ADMIN"))
	admininventory.Register(admin, db)
	adminschedule.RegisterWithTimezone(admin, db, cfg.AppTimezone)
	adminbookings.Register(admin, db, location, now, cfg.EmailEnabled)
	admin.PUT("/courts/:courtId/pricing", paymentHandler.SetPricing)
	openapi.Register(v1)

	return router
}
