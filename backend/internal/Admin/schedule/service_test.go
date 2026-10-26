package schedule

import (
	"encoding/json"
	"testing"
	"time"
)

func TestPatchPresenceAndNull(t *testing.T) {
	for _, body := range []string{`{}`, `{"isActive":null}`, `{"startsAt":null}`, `{"endsAt":"bad"}`, `{"other":true}`, `{"reason":3}`} {
		var raw map[string]json.RawMessage
		_ = json.Unmarshal([]byte(body), &raw)
		if _, err := parsePatch(raw); err == nil {
			t.Fatalf("accepted %s", body)
		}
	}
	var raw map[string]json.RawMessage
	_ = json.Unmarshal([]byte(`{"reason":null,"isActive":false}`), &raw)
	p, err := parsePatch(raw)
	if err != nil || !p.ReasonSet || p.Reason != nil || p.IsActive == nil || *p.IsActive {
		t.Fatalf("patch=%+v err=%v", p, err)
	}
}

func TestValidateHours(t *testing.T) {
	tests := []struct {
		name  string
		hours []OperatingHour
		valid bool
	}{
		{"empty closes week", []OperatingHour{}, true},
		{"adjacent", []OperatingHour{{1, "08:00:00", "09:00:00"}, {1, "09:00:00", "10:00:00"}}, true},
		{"overlap unsorted", []OperatingHour{{1, "09:00:00", "11:00:00"}, {1, "08:00:00", "10:00:00"}}, false},
		{"different days", []OperatingHour{{1, "08:00:00", "10:00:00"}, {2, "08:00:00", "10:00:00"}}, true},
		{"weekday", []OperatingHour{{0, "08:00:00", "10:00:00"}}, false},
		{"strict format", []OperatingHour{{1, "8:00:00", "10:00:00"}}, false},
		{"invalid clock", []OperatingHour{{1, "08:60:00", "10:00:00"}}, false},
		{"overnight", []OperatingHour{{1, "22:00:00", "08:00:00"}}, false},
		{"zero interval", []OperatingHour{{1, "08:00:00", "08:00:00"}}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := validateHours(tt.hours); (err == nil) != tt.valid {
				t.Fatalf("error=%v, valid=%v", err, tt.valid)
			}
		})
	}
}

func TestSlotGeneration(t *testing.T) {
	slots, err := buildSlots([]OperatingHour{{1, "08:00:00", "10:30:00"}, {2, "09:00:15", "10:00:15"}}, 60)
	if err != nil {
		t.Fatal(err)
	}
	if len(slots) != 3 || slots[0].StartsAt != "08:00:00" || slots[1].EndsAt != "10:00:00" || slots[2].StartsAt != "09:00:15" {
		t.Fatalf("slots=%+v", slots)
	}
	if _, err = buildSlots(nil, 0); err == nil {
		t.Fatal("zero duration accepted")
	}
}

func TestBlackoutValidation(t *testing.T) {
	start := time.Date(2027, 1, 1, 8, 0, 0, 0, time.UTC)
	if err := validateBlackout(Blackout{StartsAt: start, EndsAt: start.Add(time.Hour)}); err != nil {
		t.Fatal(err)
	}
	for _, end := range []time.Time{start, start.Add(-time.Second), {}} {
		if err := validateBlackout(Blackout{StartsAt: start, EndsAt: end}); err == nil {
			t.Fatal("invalid range accepted")
		}
	}
}
