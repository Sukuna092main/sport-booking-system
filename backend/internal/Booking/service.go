package booking

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/httpinput"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/response"
)

type Repository interface {
	Create(context.Context, CreateCommand) (Booking, bool, error)
	List(context.Context, string, Filter) ([]Booking, int64, error)
	ByID(context.Context, string, string) (Booking, error)
	Cancel(context.Context, string, string, string) (Booking, error)
}

type Service struct{ repo Repository }

func NewService(repo Repository) *Service { return &Service{repo: repo} }

func (s *Service) Create(ctx context.Context, customerID, key, requestID string, input CreateRequest) (Booking, bool, error) {
	// Keys are opaque and scoped to a verified customer. Never trim or case-fold.
	if !utf8.ValidString(key) || utf8.RuneCountInString(key) < 1 || utf8.RuneCountInString(key) > 128 || strings.IndexFunc(key, func(r rune) bool { return r < 32 || r == 127 }) >= 0 {
		return Booking{}, false, apperror.Invalid("Idempotency-Key", "Cần một khóa 1–128 ký tự, không chứa ký tự điều khiển.")
	}
	if !httpinput.UUID(input.CourtID) {
		return Booking{}, false, apperror.Invalid("courtId", "ID sân phải là UUID hợp lệ.")
	}
	input.CourtID = strings.ToLower(input.CourtID)
	if len(input.BookingDate) != 10 {
		return Booking{}, false, apperror.Invalid("bookingDate", "Ngày phải theo YYYY-MM-DD.")
	}
	if _, err := parseDay(input.BookingDate); err != nil {
		return Booking{}, false, err
	}
	if len(input.TimeSlotIDs) == 0 {
		return Booking{}, false, apperror.Invalid("timeSlotIds", "Phải chọn ít nhất một slot.")
	}
	ids := make([]string, len(input.TimeSlotIDs))
	seen := make(map[string]bool, len(ids))
	for i, id := range input.TimeSlotIDs {
		if !httpinput.UUID(id) {
			return Booking{}, false, apperror.Invalid("timeSlotIds", "Mỗi slot phải là UUID hợp lệ.")
		}
		id = strings.ToLower(id)
		if seen[id] {
			return Booking{}, false, apperror.Invalid("timeSlotIds", "Không được chọn slot trùng.")
		}
		seen[id] = true
		ids[i] = id
	}
	input.TimeSlotIDs = ids
	return s.repo.Create(ctx, CreateCommand{CustomerID: customerID, Key: key, Hash: requestHash(input), RequestID: requestID, Request: input})
}

// Hash the semantic selection: UUID casing, JSON layout and slot array order do
// not change a retry. New bookings still require chronological slot order.
func requestHash(input CreateRequest) [32]byte {
	input.TimeSlotIDs = append([]string(nil), input.TimeSlotIDs...)
	sort.Strings(input.TimeSlotIDs)
	encoded, _ := json.Marshal(input) // Only strings/slices: encoding cannot fail.
	return sha256.Sum256(encoded)
}

func (s *Service) List(ctx context.Context, customerID string, query url.Values) (ListResult, error) {
	f := Filter{Page: 1, PageSize: 20}
	for _, name := range []string{"page", "pageSize", "status"} {
		if len(query[name]) > 1 {
			return ListResult{}, apperror.Invalid(name, "Chỉ được gửi một giá trị.")
		}
	}
	if values, ok := query["status"]; ok {
		if values[0] != "CONFIRMED" && values[0] != "CANCELLED" {
			return ListResult{}, apperror.Invalid("status", "Trạng thái phải là CONFIRMED hoặc CANCELLED.")
		}
		f.Status = values[0]
	}
	for _, field := range []struct {
		name   string
		target *int
		max    int64
	}{{"page", &f.Page, 2147483647}, {"pageSize", &f.PageSize, 100}} {
		if values, ok := query[field.name]; ok {
			n, err := strconv.ParseInt(values[0], 10, 32)
			if err != nil || n < 1 || n > field.max {
				return ListResult{}, apperror.Invalid(field.name, "Phải là số nguyên dương trong phạm vi cho phép.")
			}
			*field.target = int(n)
		}
	}
	data, total, err := s.repo.List(ctx, customerID, f)
	return ListResult{Data: data, Meta: PageMeta{Page: f.Page, PageSize: f.PageSize, Total: total}}, err
}

func (s *Service) Detail(ctx context.Context, customerID, id string) (Booking, error) {
	if !httpinput.UUID(id) {
		return Booking{}, apperror.Invalid("bookingId", "ID booking phải là UUID hợp lệ.")
	}
	return s.repo.ByID(ctx, customerID, id)
}

func (s *Service) Cancel(ctx context.Context, customerID, id, requestID string) (Booking, error) {
	if !httpinput.UUID(id) {
		return Booking{}, apperror.Invalid("bookingId", "ID booking phải là UUID hợp lệ.")
	}
	return s.repo.Cancel(ctx, customerID, id, requestID)
}

func notFound() error {
	return apperror.New(http.StatusNotFound, "not_found", "Không tìm thấy booking.")
}

func ruleViolation(message string) error {
	return &apperror.Error{Status: http.StatusUnprocessableEntity, Code: "booking_rule_violation", Message: message, Details: []response.Detail{{Field: "booking", Message: message}}}
}
