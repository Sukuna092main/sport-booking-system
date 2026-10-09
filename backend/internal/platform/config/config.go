package config

import (
	"fmt"
	"net"
	"net/url"
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

	// PostgreSQL (Neon)
	DatabaseURL        string
	DBMaxOpenConns     int
	DBMaxIdleConns     int
	DBConnMaxLifetime  time.Duration
	DBConnMaxIdleTime  time.Duration
	JWTSecret          string
	JWTTTL             time.Duration
	CORSAllowedOrigins []string
}

func Load() (Config, error) {
	cfg := Config{
		AppName:     stringValue("APP_NAME", "sport-booking-api"),
		Environment: strings.ToLower(stringValue("APP_ENV", "development")),
		AppTimezone: stringValue("APP_TIMEZONE", ""),
		HTTPAddr:    stringValue("HTTP_ADDR", ":8080"),
		LogLevel:    strings.ToLower(stringValue("LOG_LEVEL", "info")),

		DatabaseURL: stringValue("DATABASE_URL", ""),
		JWTSecret:   os.Getenv("JWT_SECRET"),
	}

	var err error
	if cfg.DBMaxOpenConns, err = intValue("DB_MAX_OPEN_CONNS", 20); err != nil {
		return Config{}, err
	}
	if cfg.DBMaxIdleConns, err = intValue("DB_MAX_IDLE_CONNS", 5); err != nil {
		return Config{}, err
	}
	if cfg.JWTTTL, err = durationValue("JWT_TTL", 15*time.Minute); err != nil {
		return Config{}, err
	}
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
	if cfg.DBConnMaxLifetime, err = durationValue("DB_CONN_MAX_LIFETIME", 15*time.Minute); err != nil {
		return Config{}, err
	}
	if cfg.DBConnMaxIdleTime, err = durationValue("DB_CONN_MAX_IDLE_TIME", 5*time.Minute); err != nil {
		return Config{}, err
	}

	rawOrigins, configured := os.LookupEnv("CORS_ALLOWED_ORIGINS")
	if !configured && cfg.Environment == "development" {
		rawOrigins = "http://localhost:5173,http://127.0.0.1:5173"
	}
	if cfg.CORSAllowedOrigins, err = parseCORSOrigins(rawOrigins); err != nil {
		return Config{}, err
	}

	if err := cfg.Validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func (c Config) Validate() error {
	if len(c.JWTSecret) < 32 || strings.TrimSpace(c.JWTSecret) == "" {
		return fmt.Errorf("JWT_SECRET must contain at least 32 bytes")
	}
	if c.JWTTTL < time.Minute || c.JWTTTL > 24*time.Hour {
		return fmt.Errorf("JWT_TTL must be between 1m and 24h")
	}
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
	if strings.TrimSpace(c.DatabaseURL) == "" {
		return fmt.Errorf("DATABASE_URL must not be empty")
	}
	url, err := url.Parse(c.DatabaseURL)
	if err != nil || (url.Scheme != "postgres" && url.Scheme != "postgresql") || url.Hostname() == "" || url.User == nil || url.Path == "" || url.Path == "/" {
		return fmt.Errorf("DATABASE_URL must be a valid PostgreSQL URL")
	}
	sslmode := url.Query().Get("sslmode")
	if c.Environment == "production" || strings.HasSuffix(url.Hostname(), ".neon.tech") {
		if sslmode != "require" && sslmode != "verify-ca" && sslmode != "verify-full" {
			return fmt.Errorf("DATABASE_URL must require TLS for production/Neon")
		}
	}
	for _, origin := range c.CORSAllowedOrigins {
		canonical, err := canonicalOrigin(origin)
		if err != nil || canonical != origin {
			return fmt.Errorf("CORS_ALLOWED_ORIGINS must use serialized HTTP origins")
		}
	}
	if c.DBMaxOpenConns < 1 {
		return fmt.Errorf("DB_MAX_OPEN_CONNS must be at least 1")
	}
	if c.DBMaxIdleConns < 0 || c.DBMaxIdleConns > c.DBMaxOpenConns {
		return fmt.Errorf("DB_MAX_IDLE_CONNS must be between 0 and DB_MAX_OPEN_CONNS")
	}
	if c.DBConnMaxLifetime <= 0 || c.DBConnMaxIdleTime <= 0 {
		return fmt.Errorf("database connection lifetimes must be positive")
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

func intValue(name string, fallback int) (int, error) {
	value, ok := os.LookupEnv(name)
	if !ok || strings.TrimSpace(value) == "" {
		return fallback, nil
	}
	n, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || n < 0 {
		return 0, fmt.Errorf("%s must be a nonnegative integer", name)
	}
	return n, nil
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

// Empty explicitly disables cross-origin browser access; it does not disable JWT authorization.
func parseCORSOrigins(raw string) ([]string, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}
	var origins []string
	seen := map[string]bool{}
	for _, entry := range strings.Split(raw, ",") {
		origin, err := canonicalOrigin(strings.TrimSpace(entry))
		if err != nil {
			return nil, fmt.Errorf("CORS_ALLOWED_ORIGINS must contain HTTP origins without credentials, paths, queries, fragments or wildcards")
		}
		if !seen[origin] {
			origins = append(origins, origin)
			seen[origin] = true
		}
	}
	return origins, nil
}

func canonicalOrigin(raw string) (string, error) {
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", fmt.Errorf("invalid origin")
	}
	scheme := strings.ToLower(parsed.Scheme)
	if (scheme != "http" && scheme != "https") || parsed.Hostname() == "" || parsed.User != nil || parsed.Opaque != "" || (parsed.Path != "" && parsed.Path != "/") || parsed.RawQuery != "" || parsed.ForceQuery || strings.Contains(raw, "#") || strings.Contains(parsed.Host, "*") {
		return "", fmt.Errorf("invalid origin")
	}
	host := strings.ToLower(parsed.Hostname())
	for _, char := range host {
		if char > 127 || char <= 32 {
			return "", fmt.Errorf("use the ASCII hostname serialized by the browser")
		}
	}
	if strings.Contains(host, ":") {
		if net.ParseIP(host) == nil {
			return "", fmt.Errorf("invalid IPv6 origin")
		}
		host = "[" + host + "]"
	}
	if port := parsed.Port(); port != "" {
		number, err := strconv.Atoi(port)
		if err != nil || number < 1 || number > 65535 {
			return "", fmt.Errorf("invalid origin port")
		}
		if !((scheme == "http" && number == 80) || (scheme == "https" && number == 443)) {
			host += ":" + strconv.Itoa(number)
		}
	}
	return scheme + "://" + host, nil
}
