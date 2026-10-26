package bookings

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"testing"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
)

func TestRejectNULReason(t *testing.T) {
	defer func() {
		if recover() != nil {
			t.Fatal("NUL reason reached repository instead of returning validation error")
		}
	}()
	_, err := NewService(nil).Cancel(context.Background(), "10000000-0000-4000-8000-000000000001", "20000000-0000-4000-8000-000000000001", "request", CancelRequest{Reason: "bad\x00text"})
	var safe *apperror.Error
	if !errors.As(err, &safe) || safe.Status != 400 {
		t.Fatalf("expected400: %v", err)
	}
}

func TestInvalidFilters(t *testing.T) {
	for _, raw := range []string{"status=", "status=confirmed", "status=CONFIRMED&status=CANCELLED", "courtId=bad", "courtId=", "date=2026-02-30", "date=", "date=2026-10-23&date=2026-10-24", "page=0", "page=-1", "page=2147483648", "page=1&page=2", "pageSize=101", "pageSize="} {
		t.Run(raw, func(t *testing.T) {
			q, _ := url.ParseQuery(raw)
			_, err := NewService(nil).List(context.Background(), q)
			var safe *apperror.Error
			if !errors.As(err, &safe) || safe.Status != 400 {
				t.Fatalf("expected 400, got %v", err)
			}
		})
	}
}

func TestInvalidStatisticsRange(t *testing.T) {
	for _, raw := range []string{"", "from=2026-10-23", "from=2026-10-24&to=2026-10-23", "from=2026-02-30&to=2026-10-23", "from=2026-10-23&from=2026-10-24&to=2026-10-25"} {
		q, _ := url.ParseQuery(raw)
		_, err := NewService(nil).Statistics(context.Background(), q)
		var safe *apperror.Error
		if !errors.As(err, &safe) || safe.Status != 400 {
			t.Fatalf("%s: %v", raw, err)
		}
	}
}

func TestInvalidCancellation(t *testing.T) {
	for _, tc := range []struct{ id, reason string }{{"bad", "reason"}, {"11111111-1111-1111-1111-111111111111", ""}, {"11111111-1111-1111-1111-111111111111", " \t\n "}, {"11111111-1111-1111-1111-111111111111", strings.Repeat("ế", 501)}} {
		_, err := NewService(nil).Cancel(context.Background(), "admin", tc.id, "request", CancelRequest{Reason: tc.reason})
		var safe *apperror.Error
		if !errors.As(err, &safe) || safe.Status != 400 {
			t.Fatalf("expected 400, got %v", err)
		}
	}
}
