package config

import (
	"fmt"
	"net"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	AppName               string
	Environment           string
	AppTimezone           string
	HTTPAddr              string
	HTTPReadHeaderTimeout time.Duration
	HTTPReadTimeout       time.Duration
	HTTPWriteTimeout      time.Duration
	HTTPIdleTimeout       time.Duration
	HTTPShutdownTimeout   time.Duration
	LogLevel              string
}

func Load() (Config, error) {
	cfg := Config{
		AppName:     stringValue("APP_NAME", "sport-booking-api"),
		Environment: strings.ToLower(stringValue("APP_ENV", "development")),
		AppTimezone: stringValue("APP_TIMEZONE", ""),
		HTTPAddr:    stringValue("HTTP_ADDR", ":8080"),
		LogLevel:    strings.ToLower(stringValue("LOG_LEVEL", "info")),
	}

	var err error
	if cfg.HTTPReadHeaderTimeout, err = durationValue("HTTP_READ_HEADER_TIMEOUT", 5*time.Second); err != nil {
		return Config{}, err
	}
	if cfg.HTTPReadTimeout, err = durationValue("HTTP_READ_TIMEOUT", 10*time.Second); err != nil {
		return Config{}, err
	}
	if cfg.HTTPWriteTimeout, err = durationValue("HTTP_WRITE_TIMEOUT", 15*time.Second); err != nil {
		return Config{}, err
	}
	if cfg.HTTPIdleTimeout, err = durationValue("HTTP_IDLE_TIMEOUT", 60*time.Second); err != nil {
		return Config{}, err
	}
	if cfg.HTTPShutdownTimeout, err = durationValue("HTTP_SHUTDOWN_TIMEOUT", 10*time.Second); err != nil {
		return Config{}, err
	}
	if err := cfg.Validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func (c Config) Validate() error {
	if strings.TrimSpace(c.AppName) == "" {
		return fmt.Errorf("APP_NAME must not be empty")
	}
	switch c.Environment {
	case "development", "test", "production":
	default:
		return fmt.Errorf("APP_ENV must be one of development, test, production")
	}
	if c.AppTimezone == "" {
		return fmt.Errorf("APP_TIMEZONE must be an IANA timezone name")
	}
	if _, err := time.LoadLocation(c.AppTimezone); err != nil {
		return fmt.Errorf("APP_TIMEZONE must be a valid IANA timezone: %w", err)
	}
	_, port, err := net.SplitHostPort(c.HTTPAddr)
	if err != nil {
		return fmt.Errorf("HTTP_ADDR must be in host:port format: %w", err)
	}
	portNumber, err := strconv.Atoi(port)
	if err != nil || portNumber < 1 || portNumber > 65535 {
		return fmt.Errorf("HTTP_ADDR must include a valid TCP port")
	}
	if c.LogLevel != "debug" && c.LogLevel != "info" && c.LogLevel != "warn" && c.LogLevel != "error" {
		return fmt.Errorf("LOG_LEVEL must be one of debug, info, warn, error")
	}
	for name, duration := range map[string]time.Duration{
		"HTTP_READ_HEADER_TIMEOUT": c.HTTPReadHeaderTimeout,
		"HTTP_READ_TIMEOUT":        c.HTTPReadTimeout,
		"HTTP_WRITE_TIMEOUT":       c.HTTPWriteTimeout,
		"HTTP_IDLE_TIMEOUT":        c.HTTPIdleTimeout,
		"HTTP_SHUTDOWN_TIMEOUT":    c.HTTPShutdownTimeout,
	} {
		if duration <= 0 {
			return fmt.Errorf("%s must be greater than zero", name)
		}
	}
	return nil
}

func stringValue(name, fallback string) string {
	value, ok := os.LookupEnv(name)
	if !ok {
		return fallback
	}
	return strings.TrimSpace(value)
}

func durationValue(name string, fallback time.Duration) (time.Duration, error) {
	value, ok := os.LookupEnv(name)
	if !ok || strings.TrimSpace(value) == "" {
		return fallback, nil
	}
	duration, err := time.ParseDuration(strings.TrimSpace(value))
	if err != nil {
		return 0, fmt.Errorf("%s must be a valid duration: %w", name, err)
	}
	return duration, nil
}
