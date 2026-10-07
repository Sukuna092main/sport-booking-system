// Package database cung cấp kết nối GORM/PostgreSQL và quản lý vòng đời connection pool.
// Bắt buộc TLS (sslmode=require) — kiểm tra qua DATABASE_URL truyền từ config.
package database

import (
	"fmt"
	"log/slog"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/config"
)

// New khởi tạo kết nối GORM tới PostgreSQL (Neon) và cấu hình connection pool.
// Hàm thực hiện Ping ngay khi khởi động; trả lỗi rõ ràng nếu kết nối thất bại.
func New(cfg config.Config, log *slog.Logger) (*gorm.DB, error) {
	// Chọn log level của GORM theo môi trường
	gormLogLevel := logger.Warn
	if cfg.Environment == "development" {
		gormLogLevel = logger.Info
	}

	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{
		Logger: logger.Default.LogMode(gormLogLevel),
		// Tắt tự động tạo bảng — migration do Goose quản lý
		DisableAutomaticPing: false,
	})
	if err != nil {
		return nil, fmt.Errorf("gorm open: %w", err)
	}

	// Lấy *sql.DB bên dưới để cấu hình connection pool
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("lấy sql.DB từ gorm: %w", err)
	}

	// Giới hạn số kết nối tối đa → tránh vượt quota Neon Free
	sqlDB.SetMaxOpenConns(cfg.DBMaxOpenConns)
	// Số kết nối nhàn rỗi giữ trong pool
	sqlDB.SetMaxIdleConns(cfg.DBMaxIdleConns)
	// Sau thời gian này, kết nối cũ bị đóng và tạo mới → tránh dùng kết nối "chết" sau khi Neon suspend
	sqlDB.SetConnMaxLifetime(cfg.DBConnMaxLifetime)
	// Kết nối nhàn rỗi quá thời gian này sẽ bị dọn dẹp
	sqlDB.SetConnMaxIdleTime(cfg.DBConnMaxIdleTime)

	// Ping kiểm tra kết nối và TLS ngay khi khởi động
	if err := sqlDB.Ping(); err != nil {
		_ = sqlDB.Close()
		return nil, fmt.Errorf("ping database thất bại (kiểm tra DATABASE_URL và sslmode=require): %w", err)
	}

	log.Info("kết nối database thành công",
		"max_open_conns", cfg.DBMaxOpenConns,
		"max_idle_conns", cfg.DBMaxIdleConns,
		"conn_max_lifetime", cfg.DBConnMaxLifetime/time.Minute,
	)

	return db, nil
}
