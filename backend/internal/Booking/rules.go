package booking

import (
	"time"

	availability "github.com/Sukuna092main/sport-booking-system/backend/internal/Availability"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
)

func parseDay(value string) (time.Time, error) {
	day, err := time.Parse("2006-01-02", value)
	if err != nil || len(value) != 10 {
		return time.Time{}, apperror.Invalid("bookingDate", "Ngày phải theo YYYY-MM-DD.")
	}
	return day, nil
}

func validateHorizon(day, now time.Time, location *time.Location) error {
	local := now.In(location)
	today := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, time.UTC)
	if day.Before(today) || day.After(today.AddDate(0, 0, 30)) {
		return ruleViolation("Chỉ được đặt từ hôm nay đến tối đa 30 ngày lịch theo múi giờ sân.")
	}
	return nil
}

func validateSelection(ids []string, candidates []availability.Slot, minSlots, maxSlots int, now time.Time) ([]Slot, error) {
	if len(ids) < minSlots || len(ids) > maxSlots {
		return nil, ruleViolation("Số slot phải nằm trong giới hạn liên tiếp của sân.")
	}
	byID := make(map[string]availability.Slot, len(candidates))
	for _, slot := range candidates {
		byID[slot.ID] = slot
	}
	selected := make([]Slot, 0, len(ids))
	for _, id := range ids {
		slot, ok := byID[id]
		if !ok {
			return nil, ruleViolation("Slot phải đang hoạt động, cùng sân/thứ, đúng thời lượng và nằm trong giờ mở cửa.")
		}
		if len(selected) > 0 && !selected[len(selected)-1].EndsAt.Equal(slot.StartsAt) {
			return nil, ruleViolation("Các slot phải được gửi theo thứ tự thời gian và liên tiếp.")
		}
		selected = append(selected, Slot{TimeSlotID: id, StartsAt: slot.StartsAt, EndsAt: slot.EndsAt})
	}
	for _, id := range ids {
		if !byID[id].StartsAt.After(now) {
			return nil, ruleViolation("Không được đặt slot đã bắt đầu hoặc đã qua.")
		}
		if !byID[id].Available {
			return nil, apperror.New(409, "slot_unavailable", "Slot bị chặn hoặc đã có người đặt. Vui lòng tải lại lịch.")
		}
	}
	return selected, nil
}
