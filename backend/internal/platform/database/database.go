// Package database cung cấp kết nối GORM/PostgreSQL và quản lý vòng đời connection pool.
// Bắt buộc TLS (sslmode=require) — kiểm tra qua DATABASE_URL truyền từ config.
package database

import (
	"context"
	"fmt"
	"log/slog"
	"net/url"
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
	// SQL parameters can include password hashes and private profile fields.
	gormLogLevel := logger.Silent

	dsn, err := url.Parse(cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("invalid DATABASE_URL")
	}
	query := dsn.Query()
	if query.Get("connect_timeout") == "" {
		query.Set("connect_timeout", "10")
	}
	dsn.RawQuery = query.Encode()
	db, err := gorm.Open(postgres.Open(dsn.String()), &gorm.Config{
		Logger: logger.Default.LogMode(gormLogLevel),
		// Tắt tự động tạo bảng — migration do Goose quản lý
		DisableAutomaticPing: true,
	})
	if err != nil {
		return nil, fmt.Errorf("database connection failed; check DATABASE_URL and TLS")
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
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := sqlDB.PingContext(ctx); err != nil {
		_ = sqlDB.Close()
		return nil, fmt.Errorf("database ping failed; check DATABASE_URL, TLS and availability")
	}

	log.Info("kết nối database thành công",
		"max_open_conns", cfg.DBMaxOpenConns,
		"max_idle_conns", cfg.DBMaxIdleConns,
		"conn_max_lifetime", cfg.DBConnMaxLifetime/time.Minute,
	)

	return db, nil
}
