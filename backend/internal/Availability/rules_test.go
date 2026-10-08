package availability

import (
	"testing"
	"time"
)

func TestHalfOpenExclusionRules(t *testing.T) {
	base := time.Date(2026, 10, 9, 0, 0, 0, 0, time.UTC)
	slot := Interval{base.Add(time.Hour), base.Add(2 * time.Hour)}
	for _, tc := range []struct {
		name   string
		now    time.Time
		blocks []Interval
		want   bool
	}{
		{"free", base, nil, true},
		{"past", slot.Start, nil, false},
		{"partial", base, []Interval{{base.Add(90 * time.Minute), base.Add(100 * time.Minute)}}, false},
		{"adjacent before", base, []Interval{{base, slot.Start}}, true},
		{"adjacent after", base, []Interval{{slot.End, slot.End.Add(time.Hour)}}, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := CanReadAsAvailable(slot, tc.now, tc.blocks); got != tc.want {
				t.Fatal(got)
			}
		})
	}
}
