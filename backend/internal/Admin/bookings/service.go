package bookings

import (
	"context"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	booking "github.com/Sukuna092main/sport-booking-system/backend/internal/Booking"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/httpinput"
)

type Repository interface {
	AdminList(context.Context, booking.AdminFilter) ([]booking.Booking, int64, error)
	AdminByID(context.Context, string) (booking.Booking, error)
	AdminCancel(context.Context, string, string, string, string) (booking.Booking, error)
	AdminStatistics(context.Context, string, string) (booking.Statistics, error)
}
type Service struct{ repo Repository }

func NewService(repo Repository) *Service { return &Service{repo: repo} }

type CancelRequest struct {
	Reason string `json:"reason"`
}

func single(query url.Values, name string) (string, bool, error) {
	values, present := query[name]
	if !present {
		return "", false, nil
	}
	if len(values) != 1 {
		return "", true, apperror.Invalid(name, "Chỉ được gửi một giá trị.")
	}
	return values[0], true, nil
}
func date(value, field string) error {
	if _, err := time.Parse("2006-01-02", value); err != nil || len(value) != 10 {
		return apperror.Invalid(field, "Ngày phải theo YYYY-MM-DD.")
	}
	return nil
}
func (s *Service) List(ctx context.Context, q url.Values) (booking.ListResult, error) {
	f := booking.AdminFilter{Page: 1, PageSize: 20}
	for _, field := range []struct {
		name   string
		target *int
		max    int64
	}{{"page", &f.Page, 2147483647}, {"pageSize", &f.PageSize, 100}} {
		value, present, err := single(q, field.name)
		if err != nil {
			return booking.ListResult{}, err
		}
		if present {
			n, err := strconv.ParseInt(value, 10, 32)
			if err != nil || n < 1 || n > field.max {
				return booking.ListResult{}, apperror.Invalid(field.name, "Phải là số nguyên dương trong phạm vi cho phép.")
			}
			*field.target = int(n)
		}
	}
	for _, field := range []string{"courtId", "date", "status"} {
		value, present, err := single(q, field)
		if err != nil {
			return booking.ListResult{}, err
		}
		if !present {
			continue
		}
		switch field {
		case "courtId":
			if !httpinput.UUID(value) {
				return booking.ListResult{}, apperror.Invalid(field, "ID sân phải là UUID hợp lệ.")
			}
			f.CourtID = strings.ToLower(value)
		case "date":
			if err = date(value, field); err != nil {
				return booking.ListResult{}, err
			}
			f.Date = value
		case "status":
			if value != "CONFIRMED" && value != "CANCELLED" {
				return booking.ListResult{}, apperror.Invalid(field, "Trạng thái phải là CONFIRMED hoặc CANCELLED.")
			}
			f.Status = value
		}
	}
	data, total, err := s.repo.AdminList(ctx, f)
	return booking.ListResult{Data: data, Meta: booking.PageMeta{Page: f.Page, PageSize: f.PageSize, Total: total}}, err
}
func (s *Service) Detail(ctx context.Context, id string) (booking.Booking, error) {
	if !httpinput.UUID(id) {
		return booking.Booking{}, apperror.Invalid("bookingId", "ID booking phải là UUID hợp lệ.")
	}
	return s.repo.AdminByID(ctx, id)
}
func (s *Service) Cancel(ctx context.Context, actor, id, requestID string, input CancelRequest) (booking.Booking, error) {
	if !httpinput.UUID(id) {
		return booking.Booking{}, apperror.Invalid("bookingId", "ID booking phải là UUID hợp lệ.")
	}
	reason := strings.TrimSpace(input.Reason)
	if !utf8.ValidString(reason) || strings.ContainsRune(reason, 0) || utf8.RuneCountInString(reason) < 1 || utf8.RuneCountInString(reason) > 500 {
		return booking.Booking{}, apperror.Invalid("reason", "Lý do phải có từ 1 đến 500 ký tự.")
	}
	return s.repo.AdminCancel(ctx, actor, id, requestID, reason)
}
func (s *Service) Statistics(ctx context.Context, q url.Values) (booking.Statistics, error) {
	from, _, err := single(q, "from")
	if err != nil {
		return booking.Statistics{}, err
	}
	if err = date(from, "from"); err != nil {
		return booking.Statistics{}, err
	}
	to, _, err := single(q, "to")
	if err != nil {
		return booking.Statistics{}, err
	}
	if err = date(to, "to"); err != nil {
		return booking.Statistics{}, err
	}
	if from > to {
		return booking.Statistics{}, apperror.Invalid("to", "Ngày kết thúc phải từ ngày bắt đầu trở đi.")
	}
	return s.repo.AdminStatistics(ctx, from, to)
}
