package availability

import "time"

// Interval uses half-open [Start,End) bounds: adjacent reservations are allowed.
type Interval struct {
	Start time.Time
	End   time.Time
}

func Overlaps(a, b Interval) bool { return a.Start.Before(b.End) && b.Start.Before(a.End) }

// CanReadAsAvailable is independent of user limits and booking selection rules.
// The caller first validates court, weekday, hours and slot duration.
func CanReadAsAvailable(slot Interval, now time.Time, blocked []Interval) bool {
	if !slot.Start.After(now) || !slot.End.After(slot.Start) {
		return false
	}
	for _, interval := range blocked {
		if Overlaps(slot, interval) {
			return false
		}
	}
	return true
}
