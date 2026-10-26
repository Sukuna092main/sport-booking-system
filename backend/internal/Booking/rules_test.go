package booking

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"testing"
	"time"

	availability "github.com/Sukuna092main/sport-booking-system/backend/internal/Availability"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
)

func TestConsecutiveSelection(t *testing.T) {
	now := time.Date(2026, 10, 15, 0, 0, 0, 0, time.UTC)
	candidates := []availability.Slot{
		{ID: "a", StartsAt: now.Add(time.Hour), EndsAt: now.Add(2 * time.Hour), Available: true},
		{ID: "b", StartsAt: now.Add(2 * time.Hour), EndsAt: now.Add(3 * time.Hour), Available: true},
		{ID: "c", StartsAt: now.Add(3 * time.Hour), EndsAt: now.Add(4 * time.Hour), Available: true},
		{ID: "d", StartsAt: now.Add(4 * time.Hour), EndsAt: now.Add(5 * time.Hour), Available: true},
		{ID: "blocked", StartsAt: now.Add(5 * time.Hour), EndsAt: now.Add(6 * time.Hour), Available: false},
		{ID: "past", StartsAt: now, EndsAt: now.Add(time.Hour), Available: false},
	}
	for _, tc := range []struct {
		name     string
		ids      []string
		min, max int
		code     string
	}{
		{"one", []string{"a"}, 1, 4, ""},
		{"four_adjacent", []string{"a", "b", "c", "d"}, 1, 4, ""},
		{"per_court_min", []string{"a"}, 2, 4, "booking_rule_violation"},
		{"per_court_max", []string{"a", "b", "c"}, 1, 2, "booking_rule_violation"},
		{"gap", []string{"a", "c"}, 1, 4, "booking_rule_violation"},
		{"reverse", []string{"b", "a"}, 1, 4, "booking_rule_violation"},
		{"foreign_or_inactive", []string{"missing"}, 1, 4, "booking_rule_violation"},
		{"blackout_or_occupied", []string{"blocked"}, 1, 4, "slot_unavailable"},
		{"at_start", []string{"past"}, 1, 4, "booking_rule_violation"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			slots, err := validateSelection(tc.ids, candidates, tc.min, tc.max, now)
			if tc.code == "" {
				if err != nil || len(slots) != len(tc.ids) || slots[0].TimeSlotID != tc.ids[0] {
					t.Fatal(slots, err)
				}
				return
			}
			var safe *apperror.Error
			if !errors.As(err, &safe) || safe.Code != tc.code {
				t.Fatal(err)
			}
		})
	}
}

func TestCalendarHorizon(t *testing.T) {
	loc, err := time.LoadLocation("Asia/Ho_Chi_Minh")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 15, 17, 30, 0, 0, time.UTC) // Oct 16 locally.
	for _, tc := range []struct {
		date  string
		valid bool
	}{{"2026-10-15", false}, {"2026-10-16", true}, {"2026-11-15", true}, {"2026-11-16", false}} {
		day, err := parseDay(tc.date)
		if err != nil {
			t.Fatal(err)
		}
		if err = validateHorizon(day, now, loc); (err == nil) != tc.valid {
			t.Fatal(tc, err)
		}
	}
}

func TestCreateRejectsMalformedInputsBeforeRepository(t *testing.T) {
	valid := CreateRequest{CourtID: "20000000-0000-4000-8000-000000000001", BookingDate: "2026-10-16", TimeSlotIDs: []string{"a0000000-0000-4000-8000-000000000001"}}
	for _, tc := range []struct {
		name, key string
		change    func(*CreateRequest)
	}{
		{"missing_key", "", nil}, {"long_key", strings.Repeat("a", 129), nil}, {"control_key", "a\tb", nil},
		{"bad_court", "key", func(r *CreateRequest) { r.CourtID = "bad" }},
		{"bad_date", "key", func(r *CreateRequest) { r.BookingDate = "2026-02-30" }},
		{"empty_slots", "key", func(r *CreateRequest) { r.TimeSlotIDs = nil }},
		{"null_slot", "key", func(r *CreateRequest) { r.TimeSlotIDs = []string{""} }},
		{"bad_slot", "key", func(r *CreateRequest) { r.TimeSlotIDs = []string{"bad"} }},
		{"duplicate_case", "key", func(r *CreateRequest) {
			r.TimeSlotIDs = []string{valid.TimeSlotIDs[0], strings.ToUpper(valid.TimeSlotIDs[0])}
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			input := valid
			if tc.change != nil {
				tc.change(&input)
			}
			_, _, err := NewService(nil).Create(context.Background(), "owner", tc.key, "request", input)
			var safe *apperror.Error
			if !errors.As(err, &safe) || safe.Status != 400 {
				t.Fatal(err)
			}
		})
	}
}

func TestBookingQueryValidation(t *testing.T) {
	for _, query := range []string{"page=0", "page=", "page=-1", "page=2147483648", "page=1&page=2", "pageSize=101", "status=", "status=confirmed", "status=CONFIRMED&status=CANCELLED"} {
		values, err := url.ParseQuery(query)
		if err != nil {
			t.Fatal(err)
		}
		_, err = NewService(nil).List(context.Background(), "owner", values)
		var safe *apperror.Error
		if !errors.As(err, &safe) || safe.Status != 400 {
			t.Fatal(query, err)
		}
	}
}
