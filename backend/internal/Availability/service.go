package availability

import (
	"context"
	"errors"
	"net/http"
	"sort"
	"time"
	_ "time/tzdata"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/httpinput"
)

type Slot struct {
	ID        string    `json:"id"`
	StartsAt  time.Time `json:"startsAt"`
	EndsAt    time.Time `json:"endsAt"`
	Available bool      `json:"available"`
}
type Result struct {
	CourtID  string `json:"courtId"`
	Date     string `json:"date"`
	TimeZone string `json:"timeZone"`
	Slots    []Slot `json:"slots"`
}
type Service struct {
	repo     Repository
	location *time.Location
	now      func() time.Time
}

func NewService(repo Repository, location *time.Location, now func() time.Time) *Service {
	return &Service{repo: repo, location: location, now: now}
}

func (s *Service) Read(ctx context.Context, id, date string) (Result, error) {
	if !httpinput.UUID(id) {
		return Result{}, apperror.Invalid("courtId", "ID sân phải là UUID hợp lệ.")
	}
	day, err := time.Parse("2006-01-02", date)
	if err != nil || len(date) != 10 {
		return Result{}, apperror.Invalid("date", "Ngày bắt buộc theo YYYY-MM-DD.")
	}
	now := s.now()
	localNow := now.In(s.location)
	today := time.Date(localNow.Year(), localNow.Month(), localNow.Day(), 0, 0, 0, 0, time.UTC)
	if day.Before(today) || day.After(today.AddDate(0, 0, 30)) {
		return Result{}, apperror.Invalid("date", "Ngày phải từ hôm nay đến tối đa 30 ngày lịch theo múi giờ sân.")
	}
	weekday := int(day.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	// A broad UTC bound also covers days with midnight transitions or skipped local times.
	// Only intervals overlapping valid dated slots are used by the predicate below.
	snapshot, err := s.repo.Read(ctx, id, weekday, day.Add(-24*time.Hour), day.Add(48*time.Hour))
	if errors.Is(err, ErrCourtNotFound) {
		return Result{}, apperror.New(http.StatusNotFound, "not_found", "Không tìm thấy sân đang hoạt động.")
	}
	if err != nil {
		return Result{}, err
	}
	if !snapshot.Active {
		return Result{}, apperror.New(http.StatusNotFound, "not_found", "Không tìm thấy sân đang hoạt động.")
	}
	result := Result{CourtID: snapshot.CourtID, Date: date, TimeZone: s.location.String(), Slots: make([]Slot, 0)}
	for _, template := range snapshot.Templates {
		if !template.IsActive || template.Weekday != weekday || snapshot.DurationMinutes <= 0 {
			continue
		}
		wallStart, okStart := clockTime(template.StartsAt)
		wallEnd, okEnd := clockTime(template.EndsAt)
		duration := time.Duration(snapshot.DurationMinutes) * time.Minute
		if !okStart || !okEnd || wallEnd-wallStart != duration {
			continue
		}
		inside := false
		for _, h := range snapshot.Hours {
			opens, okOpens := clockTime(h.OpensAt)
			closes, okCloses := clockTime(h.ClosesAt)
			if h.IsActive && h.Weekday == weekday && okOpens && okCloses && opens < closes && wallStart >= opens && wallEnd <= closes {
				inside = true
				break
			}
		}
		if !inside {
			continue
		}
		start, okStart := localInstant(day, wallStart, s.location)
		end, okEnd := localInstant(day, wallEnd, s.location)
		if !okStart || !okEnd || end.Sub(start) != duration {
			continue
		}
		interval := Interval{Start: start, End: end}
		result.Slots = append(result.Slots, Slot{ID: template.ID, StartsAt: start, EndsAt: end, Available: CanReadAsAvailable(interval, now, snapshot.Blocked)})
	}
	sort.Slice(result.Slots, func(i, j int) bool {
		a, b := result.Slots[i], result.Slots[j]
		if a.StartsAt.Equal(b.StartsAt) {
			return a.ID < b.ID
		}
		return a.StartsAt.Before(b.StartsAt)
	})
	return result, nil
}

func clockTime(value string) (time.Duration, bool) {
	t, err := time.Parse("15:04:05.999999999", value)
	if err != nil {
		t, err = time.Parse("15:04", value)
	}
	if err != nil {
		return 0, false
	}
	return time.Duration(t.Hour())*time.Hour + time.Duration(t.Minute())*time.Minute + time.Duration(t.Second())*time.Second + time.Duration(t.Nanosecond()), true
}

// localInstant rejects both nonexistent and ambiguous DST wall-clock times.
func localInstant(day time.Time, clock time.Duration, location *time.Location) (time.Time, bool) {
	wall := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, time.UTC).Add(clock)
	candidate := time.Date(wall.Year(), wall.Month(), wall.Day(), wall.Hour(), wall.Minute(), wall.Second(), wall.Nanosecond(), location)
	_, offset := candidate.Zone()
	offsets := map[int]bool{offset: true}
	from, to := candidate.ZoneBounds()
	if !from.IsZero() {
		_, prior := from.Add(-time.Nanosecond).In(location).Zone()
		offsets[prior] = true
	}
	if !to.IsZero() {
		_, next := to.In(location).Zone()
		offsets[next] = true
	}
	var result time.Time
	count := 0
	for offset := range offsets {
		instant := wall.Add(-time.Duration(offset) * time.Second)
		local := instant.In(location)
		if local.Year() == wall.Year() && local.Month() == wall.Month() && local.Day() == wall.Day() && local.Hour() == wall.Hour() && local.Minute() == wall.Minute() && local.Second() == wall.Second() && local.Nanosecond() == wall.Nanosecond() {
			result = instant
			count++
		}
	}
	return result.UTC(), count == 1
}
