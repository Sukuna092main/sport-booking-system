package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/Notification"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/Payment"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/config"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/database"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/logger"
)

func main() {
	if err := run(); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "background worker: %v\n", err)
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
	gormDB, err := database.New(cfg, log)
	if err != nil {
		return fmt.Errorf("database init: %w", err)
	}
	db, err := gormDB.DB()
	if err != nil {
		return err
	}
	defer db.Close()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	workEnabled := false
	if cfg.EmailWorkerEnabled {
		key, err := notification.NewEncryptor(cfg.EmailEncryptionKey)
		if err != nil {
			return err
		}
		sender := notification.NewSMTPSender(notification.SMTPConfig{Host: cfg.SMTPHost, Port: cfg.SMTPPort, Username: cfg.SMTPUsername, Password: cfg.SMTPPassword, From: cfg.SMTPFrom, UseTLS: cfg.SMTPUseTLS})
		worker := notification.NewWorker(db, sender, key)
		workEnabled = true
		go func() {
			if runErr := worker.Run(ctx, cfg.EmailWorkerPollInterval); runErr != nil && !errors.Is(runErr, context.Canceled) {
				log.Error("email worker stopped", "error", runErr)
				stop()
			}
		}()
		log.Info("email outbox worker enabled")
	}
	if cfg.PaymentEnabled {
		repository := payment.NewRepository(db, nil, time.Now, cfg.EmailEnabled)
		workEnabled = true
		go func() {
			ticker := time.NewTicker(15 * time.Second)
			defer ticker.Stop()
			for {
				if count, expireErr := repository.ExpireHolds(ctx, 100); expireErr != nil {
					log.Error("payment hold expiry failed", "error", expireErr)
				} else if count > 0 {
					log.Info("expired unpaid booking holds", "count", count)
				}
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
				}
			}
		}()
		log.Info("booking hold expiry worker enabled")
	}
	if !workEnabled {
		log.Info("no background jobs enabled; waiting for shutdown")
	}
	<-ctx.Done()
	return nil
}
