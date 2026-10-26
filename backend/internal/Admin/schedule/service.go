package schedule

import (
	"context"
	"sort"
	"strings"
	"time"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/httpinput"
)

type Service struct {
	repo     *Repository
	timeZone string
}

func NewService(repo *Repository, timeZone string) *Service { return &Service{repo, timeZone} }

func validID(field, id string) error {
	if !httpinput.UUID(id) {
		return apperror.Invalid(field, "Phải là UUID hợp lệ.")
	}
	return nil
}
func clockSeconds(value string) (int, error) {
	parsed, err := time.Parse("15:04:05", value)
	if err != nil || len(value) != 8 {
		return 0, apperror.Invalid("hours", "Giờ phải có định dạng HH:mm:ss.")
	}
	return parsed.Hour()*3600 + parsed.Minute()*60 + parsed.Second(), nil
}
func validateHours(hours []OperatingHour) error {
	ordered := append([]OperatingHour(nil), hours...)
	sort.Slice(ordered, func(i, j int) bool {
		if ordered[i].Weekday == ordered[j].Weekday {
			return ordered[i].OpensAt < ordered[j].OpensAt
		}
		return ordered[i].Weekday < ordered[j].Weekday
	})
	for i, h := range ordered {
		if h.Weekday < 1 || h.Weekday > 7 {
			return apperror.Invalid("hours.weekday", "Thứ phải từ 1 đến 7.")
		}
		start, err := clockSeconds(h.OpensAt)
		if err != nil {
			return err
		}
		end, err := clockSeconds(h.ClosesAt)
		if err != nil {
			return err
		}
		if start >= end {
			return apperror.Invalid("hours", "Giờ mở phải trước giờ đóng trong cùng ngày.")
		}
		if i > 0 && ordered[i-1].Weekday == h.Weekday && ordered[i-1].ClosesAt > h.OpensAt {
			return apperror.New(409, "schedule_overlap", "Giờ mở cửa bị trùng.")
		}
	}
	return nil
}
func buildSlots(hours []OperatingHour, duration int) ([]TimeSlot, error) {
	if duration <= 0 || duration > 32767 {
		return nil, apperror.Invalid("slotDurationMinutes", "Thời lượng slot phải từ 1 đến 32767 phút.")
	}
	if err := validateHours(hours); err != nil {
		return nil, err
	}
	slots := make([]TimeSlot, 0)
	base := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)
	for _, h := range hours {
		start, _ := clockSeconds(h.OpensAt)
		end, _ := clockSeconds(h.ClosesAt)
		for at := start; at+duration*60 <= end; at += duration * 60 {
			slots = append(slots, TimeSlot{Weekday: h.Weekday, StartsAt: base.Add(time.Duration(at) * time.Second).Format("15:04:05"), EndsAt: base.Add(time.Duration(at+duration*60) * time.Second).Format("15:04:05")})
		}
	}
	return slots, nil
}
func validateBlackout(value Blackout) error {
	if value.Reason != nil && strings.ContainsRune(*value.Reason, 0) {
		return apperror.Invalid("reason", "Lý do chứa ký tự không hợp lệ.")
	}
	if value.StartsAt.IsZero() || value.EndsAt.IsZero() || !value.StartsAt.Before(value.EndsAt) {
		return apperror.Invalid("endsAt", "Thời điểm kết thúc phải sau thời điểm bắt đầu.")
	}
	return nil
}
func (s *Service) Hours(ctx context.Context, id string) (OperatingHours, error) {
	if err := validID("courtId", id); err != nil {
		return OperatingHours{}, err
	}
	v, err := s.repo.Hours(ctx, id)
	v.TimeZone = s.timeZone
	return v, err
}
func (s *Service) Replace(ctx context.Context, id, actor, requestID string, hours []OperatingHour) (OperatingHours, error) {
	if err := validID("courtId", id); err != nil {
		return OperatingHours{}, err
	}
	if err := validateHours(hours); err != nil {
		return OperatingHours{}, err
	}
	v, err := s.repo.Replace(ctx, id, actor, requestID, hours)
	v.TimeZone = s.timeZone
	return v, err
}
func (s *Service) Blackouts(ctx context.Context, id string) ([]Blackout, error) {
	if err := validID("courtId", id); err != nil {
		return nil, err
	}
	return s.repo.Blackouts(ctx, id)
}
func (s *Service) Create(ctx context.Context, id, actor, requestID string, value Blackout) (Blackout, error) {
	if err := validID("courtId", id); err != nil {
		return Blackout{}, err
	}
	if err := validateBlackout(value); err != nil {
		return Blackout{}, err
	}
	value.CourtID = id
	value.IsActive = true
	return s.repo.Create(ctx, actor, requestID, value)
}
func (s *Service) Patch(ctx context.Context, courtID, id, actor, requestID string, patch BlackoutPatch) (Blackout, error) {
	if err := validID("courtId", courtID); err != nil {
		return Blackout{}, err
	}
	if err := validID("blackoutId", id); err != nil {
		return Blackout{}, err
	}
	return s.repo.Patch(ctx, courtID, id, actor, requestID, patch)
}
func (s *Service) Delete(ctx context.Context, courtID, id, actor, requestID string) error {
	if err := validID("courtId", courtID); err != nil {
		return err
	}
	if err := validID("blackoutId", id); err != nil {
		return err
	}
	return s.repo.Delete(ctx, courtID, id, actor, requestID)
}
