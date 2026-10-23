package logger

import (
	"fmt"
	"log/slog"
	"os"
	"strings"
)

func New(level string) (*slog.Logger, error) {
	var parsedLevel slog.Level
	switch strings.ToLower(level) {
	case "debug":
		parsedLevel = slog.LevelDebug
	case "info":
		parsedLevel = slog.LevelInfo
	case "warn":
		parsedLevel = slog.LevelWarn
	case "error":
		parsedLevel = slog.LevelError
	default:
		return nil, fmt.Errorf("unsupported log level %q", level)
	}

	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: parsedLevel})), nil
}
