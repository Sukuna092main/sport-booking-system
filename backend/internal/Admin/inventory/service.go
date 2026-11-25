package inventory

import (
	"context"
	"encoding/json"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"

	court "github.com/Sukuna092main/sport-booking-system/backend/internal/Court"
	sport "github.com/Sukuna092main/sport-booking-system/backend/internal/SportType"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/httpinput"
)

type Fields map[string]json.RawMessage
type Service struct{ repo *SQLRepository }

func (s *Service) ListSports(ctx context.Context) ([]sport.SportType, error) {
	return s.repo.ListSports(ctx)
}

type CourtList struct {
	Data []court.Court  `json:"data"`
	Meta court.PageMeta `json:"meta"`
}

var pricePattern = regexp.MustCompile(`^[0-9]+(\.[0-9]{1,2})?$`)

func invalid(field string) error { return apperror.Invalid(field, "Giá trị không hợp lệ.") }
func checkFields(f Fields, isCourt, create bool) error {
	if len(f) == 0 {
		return invalid("body")
	}
	allowed := map[string]bool{"name": true, "description": true, "isActive": true}
	if isCourt {
		for _, k := range []string{"sportTypeId", "code", "slotDurationMinutes", "minConsecutiveSlots", "maxConsecutiveSlots", "referencePriceAmount", "referencePriceCurrency"} {
			allowed[k] = true
		}
	}
	for k, v := range f {
		if !allowed[k] {
			return invalid(k)
		}
		if string(v) == "null" {
			if k == "description" || k == "referencePriceAmount" || k == "referencePriceCurrency" {
				continue
			}
			return invalid(k)
		}
		switch k {
		case "isActive":
			var value bool
			if json.Unmarshal(v, &value) != nil {
				return invalid(k)
			}
		case "slotDurationMinutes", "minConsecutiveSlots", "maxConsecutiveSlots":
			var value int
			if json.Unmarshal(v, &value) != nil || value < 1 || value > 32767 {
				return invalid(k)
			}
		default:
			var value string
			if json.Unmarshal(v, &value) != nil || strings.ContainsRune(value, 0) {
				return invalid(k)
			}
			limit := 0
			switch k {
			case "name":
				limit = 100
				if isCourt {
					limit = 120
				}
			case "code":
				limit = 50
			}
			if limit > 0 {
				value = strings.TrimSpace(value)
				if value == "" || utf8.RuneCountInString(value) > limit {
					return invalid(k)
				}
				f[k], _ = json.Marshal(value)
			}
			if k == "sportTypeId" && !httpinput.UUID(value) {
				return invalid(k)
			}
			if k == "referencePriceAmount" && !pricePattern.MatchString(value) {
				return invalid(k)
			}
			if k == "referencePriceCurrency" && utf8.RuneCountInString(value) != 3 {
				return invalid(k)
			}
		}
	}
	if create {
		for _, k := range []string{"name"} {
			if _, ok := f[k]; !ok {
				return invalid(k)
			}
		}
		if isCourt {
			for _, k := range []string{"code", "sportTypeId"} {
				if _, ok := f[k]; !ok {
					return invalid(k)
				}
			}
		}
	}
	return nil
}
func mergeCourt(old court.Court, f Fields) (court.Court, error) {
	raw, _ := json.Marshal(f)
	if err := json.Unmarshal(raw, &old); err != nil {
		return old, invalid("body")
	}
	if old.MinConsecutiveSlots > old.MaxConsecutiveSlots {
		return old, invalid("maxConsecutiveSlots")
	}
	if (old.ReferencePriceAmount == nil) != (old.ReferencePriceCurrency == nil) {
		return old, invalid("referencePriceCurrency")
	}
	return old, nil
}
func (s *Service) SaveCourt(ctx context.Context, id, actor, request string, f Fields) (court.Court, error) {
	if id != "" && !httpinput.UUID(id) {
		return court.Court{}, invalid("courtId")
	}
	if err := checkFields(f, true, id == ""); err != nil {
		return court.Court{}, err
	}
	if id == "" {
		if _, err := mergeCourt(court.Court{IsActive: true, SlotDurationMinutes: 60, MinConsecutiveSlots: 1, MaxConsecutiveSlots: 4}, f); err != nil {
			return court.Court{}, err
		}
	}
	return s.repo.SaveCourt(ctx, id, actor, request, f)
}
func (s *Service) SaveSport(ctx context.Context, id, actor, request string, f Fields) (sport.SportType, error) {
	if id != "" && !httpinput.UUID(id) {
		return sport.SportType{}, invalid("sportTypeId")
	}
	if err := checkFields(f, false, id == ""); err != nil {
		return sport.SportType{}, err
	}
	return s.repo.SaveSport(ctx, id, actor, request, f)
}
func (s *Service) Delete(ctx context.Context, isCourt bool, id, actor, request string) error {
	if !httpinput.UUID(id) {
		return invalid("id")
	}
	return s.repo.Delete(ctx, isCourt, id, actor, request)
}
func (s *Service) ListCourts(ctx context.Context, q url.Values) (CourtList, error) {
	page, size := 1, 20
	for _, p := range []struct {
		name   string
		target *int
		max    int
	}{{"page", &page, 2147483647}, {"pageSize", &size, 100}} {
		if values, ok := q[p.name]; ok {
			if len(values) != 1 {
				return CourtList{}, invalid(p.name)
			}
			n, err := strconv.ParseInt(values[0], 10, 32)
			if err != nil || n < 1 || n > int64(p.max) {
				return CourtList{}, invalid(p.name)
			}
			*p.target = int(n)
		}
	}
	data, total, err := s.repo.ListCourts(ctx, page, size)
	return CourtList{Data: data, Meta: court.PageMeta{Page: page, PageSize: size, Total: total}}, err
}
