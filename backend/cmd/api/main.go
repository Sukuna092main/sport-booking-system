package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/bootstrap"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/config"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/database"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/logger"
)

func main() {
	if err := run(); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "api server: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	log, err := logger.New(cfg.LogLevel)
	if err != nil {
		return err
	}

	// Khởi tạo kết nối GORM → PostgreSQL (Neon), kiểm tra TLS ngay tại đây
	db, err := database.New(cfg, log)
	if err != nil {
		return fmt.Errorf("database init: %w", err)
	}
	// Đóng connection pool khi server tắt
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("lấy sql.DB để defer close: %w", err)
	}
	defer func() {
		if closeErr := sqlDB.Close(); closeErr != nil {
			log.Error("đóng database thất bại", "error", closeErr)
		}
	}()

	server := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           bootstrap.NewRouter(cfg, log, sqlDB),
		ReadHeaderTimeout: cfg.HTTPReadHeaderTimeout,
		ReadTimeout:       cfg.HTTPReadTimeout,
		WriteTimeout:      cfg.HTTPWriteTimeout,
		IdleTimeout:       cfg.HTTPIdleTimeout,
	}

	serverErrors := make(chan error, 1)
	go func() {
		log.Info("starting HTTP server", "address", cfg.HTTPAddr, "environment", cfg.Environment)
		serverErrors <- server.ListenAndServe()
	}()

	shutdownContext, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	select {
	case err := <-serverErrors:
		if !errors.Is(err, http.ErrServerClosed) {
			return fmt.Errorf("listen and serve: %w", err)
		}
		return nil
	case <-shutdownContext.Done():
	}

	log.Info("shutting down HTTP server")
	ctx, cancel := context.WithTimeout(context.Background(), cfg.HTTPShutdownTimeout)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		_ = server.Close()
		return fmt.Errorf("graceful shutdown: %w", err)
	}

	if err := <-serverErrors; !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("server stopped unexpectedly: %w", err)
	}
	return nil
}
