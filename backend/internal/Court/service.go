package court

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/httpinput"
)

type PageMeta struct {
	Page     int   `json:"page"`
	PageSize int   `json:"pageSize"`
	Total    int64 `json:"total"`
}
type ListResult struct {
	Data []Court  `json:"data"`
	Meta PageMeta `json:"meta"`
}
type Service struct{ repo Repository }

func NewService(repo Repository) *Service { return &Service{repo: repo} }

func (s *Service) Detail(ctx context.Context, id string) (Court, error) {
	if !httpinput.UUID(id) {
		return Court{}, apperror.Invalid("courtId", "ID sân phải là UUID hợp lệ.")
	}
	c, err := s.repo.ActiveByID(ctx, id)
	if errors.Is(err, ErrNotFound) {
		return Court{}, apperror.New(http.StatusNotFound, "not_found", "Không tìm thấy sân đang hoạt động.")
	}
	return c, err
}

func (s *Service) List(ctx context.Context, query url.Values) (ListResult, error) {
	for _, key := range []string{"q", "sportTypeId", "page", "pageSize"} {
		if len(query[key]) > 1 {
			return ListResult{}, apperror.Invalid(key, "Chỉ được gửi một giá trị.")
		}
	}
	f := Filter{Search: strings.TrimSpace(query.Get("q")), Page: 1, PageSize: 20}
	if utf8.RuneCountInString(f.Search) > 100 {
		return ListResult{}, apperror.Invalid("q", "Từ khóa tối đa 100 ký tự.")
	}
	if values, ok := query["sportTypeId"]; ok {
		id := values[0]
		if !httpinput.UUID(id) {
			return ListResult{}, apperror.Invalid("sportTypeId", "Loại thể thao phải là UUID hợp lệ.")
		}
		f.SportTypeID = &id
	}
	for _, field := range []struct {
		name   string
		target *int
		max    int
	}{{"page", &f.Page, 2147483647}, {"pageSize", &f.PageSize, 100}} {
		if values, ok := query[field.name]; ok {
			n, err := strconv.ParseInt(values[0], 10, 32)
			if err != nil || n < 1 || n > int64(field.max) {
				return ListResult{}, apperror.Invalid(field.name, "Phải là số nguyên dương trong phạm vi cho phép.")
			}
			*field.target = int(n)
		}
	}
	rows, total, err := s.repo.List(ctx, f)
	return ListResult{Data: rows, Meta: PageMeta{Page: f.Page, PageSize: f.PageSize, Total: total}}, err
}
