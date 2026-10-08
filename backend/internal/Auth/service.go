package auth

import (
	"context"
	"errors"
	"net/http"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"

	user "github.com/Sukuna092main/sport-booking-system/backend/internal/User"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
)

type RegisterRequest struct {
	Email    string  `json:"email"`
	Password string  `json:"password"`
	FullName string  `json:"fullName"`
	Phone    *string `json:"phone"`
}
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}
type LoginResult struct {
	AccessToken string    `json:"accessToken"`
	TokenType   string    `json:"tokenType"`
	ExpiresAt   time.Time `json:"expiresAt"`
	User        user.User `json:"user"`
}
type Service struct {
	users     user.Repository
	tokens    *Tokens
	dummyHash []byte
}

func NewService(users user.Repository, tokens *Tokens) *Service {
	// One dummy hash per process: missing emails still perform bcrypt verification.
	hash, err := bcrypt.GenerateFromPassword([]byte("dummy-password-for-timing"), bcrypt.DefaultCost)
	if err != nil {
		panic("bcrypt initialization failed")
	}
	return &Service{users: users, tokens: tokens, dummyHash: hash}
}

func normalizeEmail(value string) (string, error) {
	value = strings.ToLower(strings.TrimSpace(value))
	address, err := mail.ParseAddress(value)
	if err != nil || address.Address != value || len(value) > 254 {
		return "", apperror.Invalid("email", "Email không hợp lệ (tối đa 254 ký tự).")
	}
	return value, nil
}

func (s *Service) Register(ctx context.Context, in RegisterRequest) (user.User, error) {
	email, err := normalizeEmail(in.Email)
	if err != nil {
		return user.User{}, err
	}
	if utf8.RuneCountInString(in.Password) < 8 || len(in.Password) > 72 {
		return user.User{}, apperror.Invalid("password", "Mật khẩu ít nhất 8 ký tự và tối đa 72 byte UTF-8.")
	}
	name := strings.TrimSpace(in.FullName)
	if utf8.RuneCountInString(name) < 1 || utf8.RuneCountInString(name) > 120 {
		return user.User{}, apperror.Invalid("fullName", "Họ tên từ 1 đến 120 ký tự.")
	}
	if in.Phone != nil {
		phone := strings.TrimSpace(*in.Phone)
		if utf8.RuneCountInString(phone) > 30 {
			return user.User{}, apperror.Invalid("phone", "Số điện thoại tối đa 30 ký tự.")
		}
		in.Phone = &phone
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		return user.User{}, err
	}
	u, err := s.users.Create(ctx, email, string(hash), name, in.Phone)
	if errors.Is(err, user.ErrEmailTaken) {
		return user.User{}, apperror.New(http.StatusConflict, "email_taken", "Email đã được sử dụng.")
	}
	return u, err
}

func (s *Service) Login(ctx context.Context, in LoginRequest) (LoginResult, error) {
	email, err := normalizeEmail(in.Email)
	if err != nil {
		return LoginResult{}, err
	}
	if len(in.Password) == 0 || len(in.Password) > 72 {
		return LoginResult{}, apperror.Invalid("password", "Mật khẩu bắt buộc và tối đa 72 byte UTF-8.")
	}
	u, err := s.users.ByEmail(ctx, email)
	if err != nil && !errors.Is(err, user.ErrNotFound) {
		return LoginResult{}, err
	}
	hash := []byte(u.PasswordHash)
	if errors.Is(err, user.ErrNotFound) {
		hash = s.dummyHash
	}
	passwordErr := bcrypt.CompareHashAndPassword(hash, []byte(in.Password))
	if passwordErr != nil || errors.Is(err, user.ErrNotFound) {
		return LoginResult{}, apperror.New(http.StatusUnauthorized, "invalid_credentials", "Email hoặc mật khẩu không đúng.")
	}
	if u.Status != "ACTIVE" {
		return LoginResult{}, apperror.New(http.StatusForbidden, "account_inactive", "Tài khoản không hoạt động.")
	}
	if u.Role != "USER" && u.Role != "ADMIN" {
		return LoginResult{}, apperror.New(http.StatusForbidden, "forbidden", "Tài khoản không có quyền hợp lệ.")
	}
	encoded, expires, err := s.tokens.Issue(u.ID, u.Role)
	return LoginResult{AccessToken: encoded, TokenType: "Bearer", ExpiresAt: expires, User: u}, err
}
