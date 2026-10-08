package user

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
)

type ProfilePatch struct {
	NameSet  bool
	Name     string
	PhoneSet bool
	Phone    *string
}
type ProfileRepository interface {
	ByID(context.Context, string) (User, error)
	UpdateProfile(context.Context, string, ProfilePatch) (User, error)
}
type Service struct{ repo ProfileRepository }

func NewService(repo ProfileRepository) *Service { return &Service{repo: repo} }

func (s *Service) Get(ctx context.Context, id string) (User, error) {
	u, err := s.repo.ByID(ctx, id)
	if errors.Is(err, ErrNotFound) {
		return User{}, apperror.New(http.StatusUnauthorized, "unauthorized", "Cần đăng nhập bằng token hợp lệ.")
	}
	if err != nil {
		return User{}, err
	}
	if u.Status != "ACTIVE" {
		return User{}, apperror.New(http.StatusForbidden, "account_inactive", "Tài khoản không hoạt động.")
	}
	return u, nil
}

func (s *Service) Update(ctx context.Context, id string, fields map[string]json.RawMessage) (User, error) {
	if len(fields) == 0 {
		return User{}, apperror.Invalid("body", "Phải gửi fullName hoặc phone.")
	}
	for key := range fields {
		if key != "fullName" && key != "phone" {
			return User{}, apperror.Invalid(key, "Trường này không được phép cập nhật.")
		}
	}
	var patch ProfilePatch
	if raw, ok := fields["fullName"]; ok {
		patch.NameSet = true
		if string(raw) == "null" || json.Unmarshal(raw, &patch.Name) != nil {
			return User{}, apperror.Invalid("fullName", "Họ tên phải là chuỗi.")
		}
		patch.Name = strings.TrimSpace(patch.Name)
		if utf8.RuneCountInString(patch.Name) < 1 || utf8.RuneCountInString(patch.Name) > 120 {
			return User{}, apperror.Invalid("fullName", "Họ tên từ 1 đến 120 ký tự.")
		}
	}
	if raw, ok := fields["phone"]; ok {
		patch.PhoneSet = true
		if json.Unmarshal(raw, &patch.Phone) != nil {
			return User{}, apperror.Invalid("phone", "Số điện thoại phải là chuỗi hoặc null.")
		}
		if patch.Phone != nil {
			phone := strings.TrimSpace(*patch.Phone)
			if utf8.RuneCountInString(phone) > 30 {
				return User{}, apperror.Invalid("phone", "Số điện thoại tối đa 30 ký tự.")
			}
			patch.Phone = &phone
		}
	}
	u, err := s.repo.UpdateProfile(ctx, id, patch)
	if errors.Is(err, ErrNotFound) {
		if _, err = s.Get(ctx, id); err != nil {
			return User{}, err
		}
		return User{}, apperror.New(http.StatusUnauthorized, "unauthorized", "Cần đăng nhập lại.")
	}
	return u, err
}
