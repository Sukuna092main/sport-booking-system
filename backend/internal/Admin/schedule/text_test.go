package schedule

import (
	"testing"
	"time"
)

func TestRejectNULReason(t *testing.T) {
	reason := "bad\x00text"
	start := time.Now()
	if err := validateBlackout(Blackout{StartsAt: start, EndsAt: start.Add(time.Hour), Reason: &reason}); err == nil {
		t.Fatal("accepted NUL reason")
	}
}
