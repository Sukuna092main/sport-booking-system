package auth

import (
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/response"
	"github.com/gin-gonic/gin"
)

type ipWindow struct {
	started time.Time
	count   int
}
type ipLimiter struct {
	mu      sync.Mutex
	entries map[string]ipWindow
	limit   int
	window  time.Duration
	now     func() time.Time
}

func RateLimitByIP(limit int, window time.Duration) gin.HandlerFunc {
	if limit < 1 {
		limit = 5
	}
	if window <= 0 {
		window = time.Minute
	}
	limiter := &ipLimiter{entries: make(map[string]ipWindow), limit: limit, window: window, now: time.Now}
	return func(c *gin.Context) {
		key := c.ClientIP()
		now := limiter.now()
		limiter.mu.Lock()
		state := limiter.entries[key]
		if state.started.IsZero() || now.Sub(state.started) >= limiter.window {
			state = ipWindow{started: now}
		}
		state.count++
		limiter.entries[key] = state
		if len(limiter.entries) > 2048 {
			for candidate, value := range limiter.entries {
				if now.Sub(value.started) >= limiter.window {
					delete(limiter.entries, candidate)
				}
			}
		}
		limiter.mu.Unlock()
		if state.count > limiter.limit {
			c.Header("Retry-After", strconv.Itoa(max(1, int(limiter.window.Seconds()))))
			response.Error(c, http.StatusTooManyRequests, "rate_limited", "Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau.")
			return
		}
		c.Next()
	}
}

func RequireAllowedOrigin(origins []string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(origins))
	for _, origin := range origins {
		allowed[origin] = true
	}
	return func(c *gin.Context) {
		values := c.Request.Header.Values("Origin")
		if len(values) > 1 || (len(values) == 1 && !allowed[strings.TrimSpace(values[0])]) {
			response.Error(c, http.StatusForbidden, "origin_not_allowed", "Origin không được phép thực hiện thao tác phiên.")
			return
		}
		c.Next()
	}
}
