package availability

import (
	"context"
	"errors"
	"testing"
	"time"

	court "github.com/Sukuna092main/sport-booking-system/backend/internal/Court"
	timeslot "github.com/Sukuna092main/sport-booking-system/backend/internal/TimeSlot"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
)

const courtID = "20000000-0000-4000-8000-000000000001"

type fakeRead struct {
	snapshot Snapshot
	err      error
}

func (f fakeRead) Read(context.Context, string, int, time.Time, time.Time) (Snapshot, error) {
	return f.snapshot, f.err
}
func location(t *testing.T, name string) *time.Location {
	t.Helper()
	l, err := time.LoadLocation(name)
	if err != nil {
		t.Fatal(err)
	}
	return l
}

func TestAvailabilityTemplateExclusions(t *testing.T) {
	loc := location(t, "Asia/Ho_Chi_Minh")
	now := time.Date(2026, 10, 8, 0, 0, 0, 0, time.UTC)
	base := Snapshot{CourtID: courtID, Active: true, DurationMinutes: 60, Hours: []court.OperatingHours{{Weekday: 5, OpensAt: "07:00", ClosesAt: "13:00", IsActive: true}}, Templates: []timeslot.Template{{ID: "slot", Weekday: 5, StartsAt: "07:00", EndsAt: "08:00", IsActive: true}}}
	for _, tc := range []struct {
		name   string
		change func(*Snapshot)
		want   int
	}{
		{"valid", func(s *Snapshot) {}, 1}, {"wrong weekday", func(s *Snapshot) { s.Templates[0].Weekday = 6 }, 0},
		{"inactive template", func(s *Snapshot) { s.Templates[0].IsActive = false }, 0}, {"inactive hours", func(s *Snapshot) { s.Hours[0].IsActive = false }, 0},
		{"wrong hours weekday", func(s *Snapshot) { s.Hours[0].Weekday = 6 }, 0}, {"outside hours", func(s *Snapshot) { s.Hours[0].OpensAt = "08:00" }, 0},
		{"wrong duration", func(s *Snapshot) { s.Templates[0].EndsAt = "07:30" }, 0}, {"bad clock", func(s *Snapshot) { s.Templates[0].StartsAt = "invalid" }, 0},
		{"closed", func(s *Snapshot) { s.Hours = nil }, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := base
			s.Hours = append([]court.OperatingHours(nil), base.Hours...)
			s.Templates = append([]timeslot.Template(nil), base.Templates...)
			tc.change(&s)
			result, err := NewService(fakeRead{snapshot: s}, loc, func() time.Time { return now }).Read(context.Background(), courtID, "2026-10-09")
			if err != nil || len(result.Slots) != tc.want {
				t.Fatal(result, err)
			}
			if len(result.Slots) > 0 && (!result.Slots[0].Available || result.Slots[0].StartsAt.Location() != time.UTC) {
				t.Fatal(result)
			}
		})
	}
	now = time.Date(2026, 10, 9, 0, 0, 0, 0, time.UTC)
	result, err := NewService(fakeRead{snapshot: base}, loc, func() time.Time { return now }).Read(context.Background(), courtID, "2026-10-09")
	if err != nil || result.Slots[0].Available {
		t.Fatal("past boundary", result, err)
	}
}

func TestAvailabilityCalendarHorizon(t *testing.T) {
	loc := location(t, "Asia/Ho_Chi_Minh")
	now := time.Date(2026, 10, 8, 18, 0, 0, 0, time.UTC)
	s := NewService(fakeRead{snapshot: Snapshot{CourtID: courtID, Active: true}}, loc, func() time.Time { return now })
	for _, date := range []string{"2026-10-09", "2026-11-08"} {
		if _, err := s.Read(context.Background(), courtID, date); err != nil {
			t.Fatal(date, err)
		}
	}
	for _, date := range []string{"", "2026-10-8", "2026-02-30", "2026-10-08", "2026-11-09"} {
		_, err := s.Read(context.Background(), courtID, date)
		var e *apperror.Error
		if !errors.As(err, &e) || e.Status != 400 {
			t.Fatal(date, err)
		}
	}
	_, err := s.Read(context.Background(), "bad", "2026-10-09")
	if err == nil {
		t.Fatal("bad UUID accepted")
	}
	s.repo = fakeRead{err: ErrCourtNotFound}
	_, err = s.Read(context.Background(), courtID, "2026-10-09")
	var e *apperror.Error
	if !errors.As(err, &e) || e.Status != 404 {
		t.Fatal(err)
	}
}

func TestDSTLocalInstants(t *testing.T) {
	for _, tc := range []struct {
		zone, date, clock string
		want              bool
	}{
		{"America/New_York", "2026-03-08", "02:30", false}, {"America/New_York", "2026-03-08", "03:30", true},
		{"America/New_York", "2026-11-01", "01:30", false}, {"America/New_York", "2026-11-01", "02:30", true},
		{"Australia/Lord_Howe", "2026-04-05", "01:45", false}, {"Pacific/Apia", "2011-12-30", "12:00", false},
		{"Asia/Ho_Chi_Minh", "2026-10-09", "07:00", true},
	} {
		t.Run(tc.zone+tc.date+tc.clock, func(t *testing.T) {
			day, _ := time.Parse("2006-01-02", tc.date)
			clock, _ := clockTime(tc.clock)
			_, ok := localInstant(day, clock, location(t, tc.zone))
			if ok != tc.want {
				t.Fatal(ok)
			}
		})
	}
}

func TestDSTDurationAndSorting(t *testing.T) {
	loc := location(t, "America/New_York")
	now := time.Date(2026, 3, 7, 12, 0, 0, 0, time.UTC)
	snapshot := Snapshot{CourtID: courtID, Active: true, DurationMinutes: 120, Hours: []court.OperatingHours{{Weekday: 7, OpensAt: "00:00", ClosesAt: "08:00", IsActive: true}}, Templates: []timeslot.Template{
		{ID: "later", Weekday: 7, StartsAt: "05:00", EndsAt: "07:00", IsActive: true}, {ID: "across DST", Weekday: 7, StartsAt: "01:00", EndsAt: "03:00", IsActive: true}, {ID: "earlier", Weekday: 7, StartsAt: "03:00", EndsAt: "05:00", IsActive: true},
	}}
	result, err := NewService(fakeRead{snapshot: snapshot}, loc, func() time.Time { return now }).Read(context.Background(), courtID, "2026-03-08")
	if err != nil || len(result.Slots) != 2 || result.Slots[0].ID != "earlier" || result.Slots[1].ID != "later" {
		t.Fatal(result, err)
	}
}
