package auth

import (
	"context"
	"database/sql"
	"encoding/hex"
	"errors"
	"html"
	"net/http"
	"net/mail"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"

	notification "github.com/Sukuna092main/sport-booking-system/backend/internal/Notification"
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
	AccessToken  string    `json:"accessToken"`
	TokenType    string    `json:"tokenType"`
	ExpiresAt    time.Time `json:"expiresAt"`
	User         user.User `json:"user"`
	RefreshToken string    `json:"-"`
}

type Options struct {
	Sessions          SessionStore
	Credentials       CredentialStore
	ResetQueue        notification.EmailQueue
	RefreshTTL        time.Duration
	ResetTTL          time.Duration
	FrontendPublicURL string
}

type Service struct {
	users       user.Repository
	tokens      *Tokens
	dummyHash   []byte
	sessions    SessionStore
	credentials CredentialStore
	resetQueue  notification.EmailQueue
	refreshTTL  time.Duration
	resetTTL    time.Duration
	frontendURL string
}

func NewService(users user.Repository, tokens *Tokens) *Service {
	return NewServiceWithOptions(users, tokens, Options{})
}

func NewServiceWithOptions(users user.Repository, tokens *Tokens, options Options) *Service {
	// One dummy hash per process: missing emails still perform bcrypt verification.
	hash, err := bcrypt.GenerateFromPassword([]byte("dummy-password-for-timing"), bcrypt.DefaultCost)
	if err != nil {
		panic("bcrypt initialization failed")
	}
	if options.RefreshTTL <= 0 {
		options.RefreshTTL = 7 * 24 * time.Hour
	}
	if options.ResetTTL <= 0 {
		options.ResetTTL = 15 * time.Minute
	}
	return &Service{users: users, tokens: tokens, dummyHash: hash, sessions: options.Sessions,
		credentials: options.Credentials, resetQueue: options.ResetQueue, refreshTTL: options.RefreshTTL,
		resetTTL: options.ResetTTL, frontendURL: strings.TrimRight(options.FrontendPublicURL, "/")}
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
	version := u.AuthVersion
	if version < 1 {
		version = 1
	}
	result := LoginResult{TokenType: "Bearer", User: u}
	var family string
	if s.sessions != nil {
		refresh, createErr := newRefreshToken()
		if createErr != nil {
			return LoginResult{}, createErr
		}
		family, createErr = s.sessions.Create(ctx, u.ID, version, refresh, time.Now().UTC().Add(s.refreshTTL))
		if errors.Is(createErr, ErrInvalidSession) {
			return LoginResult{}, apperror.New(http.StatusUnauthorized, "invalid_credentials", "Email hoặc mật khẩu không đúng.")
		}
		if createErr != nil {
			return LoginResult{}, createErr
		}
		result.RefreshToken = refresh
	}
	result.AccessToken, result.ExpiresAt, err = s.tokens.issueSession(u.ID, u.Role, version, family)
	return result, err
}

func (s *Service) Refresh(ctx context.Context, raw string) (LoginResult, error) {
	if s.sessions == nil || raw == "" {
		return LoginResult{}, apperror.New(http.StatusUnauthorized, "invalid_session", "Phiên đăng nhập không còn hợp lệ.")
	}
	next, err := newRefreshToken()
	if err != nil {
		return LoginResult{}, err
	}
	userID, family, version, err := s.sessions.Rotate(ctx, raw, next)
	if errors.Is(err, ErrInvalidSession) {
		return LoginResult{}, apperror.New(http.StatusUnauthorized, "invalid_session", "Phiên đăng nhập không còn hợp lệ.")
	}
	if err != nil {
		return LoginResult{}, err
	}
	u, err := s.users.ByID(ctx, userID)
	if err != nil || u.Status != "ACTIVE" || u.AuthVersion != version || (u.Role != "USER" && u.Role != "ADMIN") {
		if errors.Is(err, user.ErrNotFound) || err == nil {
			return LoginResult{}, apperror.New(http.StatusUnauthorized, "invalid_session", "Phiên đăng nhập không còn hợp lệ.")
		}
		return LoginResult{}, err
	}
	access, expires, err := s.tokens.issueSession(u.ID, u.Role, version, family)
	if err != nil {
		return LoginResult{}, err
	}
	return LoginResult{AccessToken: access, TokenType: "Bearer", ExpiresAt: expires, User: u, RefreshToken: next}, nil
}

func (s *Service) Logout(ctx context.Context, raw string) error {
	if s.sessions == nil {
		return nil
	}
	return s.sessions.Revoke(ctx, raw)
}

func (s *Service) LogoutAll(ctx context.Context, userID string) error {
	if s.sessions == nil {
		return nil
	}
	return s.sessions.RevokeAll(ctx, userID)
}

func (s *Service) ForgotPassword(ctx context.Context, rawEmail string) error {
	// Always perform bcrypt work and return the same HTTP response for unknown
	// addresses. The database rate limit is per account; the route also limits IPs.
	_ = bcrypt.CompareHashAndPassword(s.dummyHash, []byte("constant-work"))
	email, err := normalizeEmail(rawEmail)
	if err != nil || s.credentials == nil || s.resetQueue == nil || s.frontendURL == "" {
		return nil
	}
	u, err := s.users.ByEmail(ctx, email)
	if errors.Is(err, user.ErrNotFound) || (err == nil && u.Status != "ACTIVE") {
		return nil
	}
	if err != nil {
		return err
	}
	token, err := newRefreshToken()
	if err != nil {
		return err
	}
	expires := time.Now().UTC().Add(s.resetTTL)
	link := s.frontendURL + "/reset-password?token=" + url.QueryEscape(token)
	message := notification.EmailMessage{To: u.Email, Subject: "Đặt lại mật khẩu Sport Booking System",
		TextBody: "Mở liên kết sau để đặt lại mật khẩu (liên kết chỉ dùng một lần và có thời hạn): " + link,
		HTMLBody: `<p>Bạn vừa yêu cầu đặt lại mật khẩu Sport Booking System.</p><p><a href="` + html.EscapeString(link) + `">Đặt lại mật khẩu</a></p><p>Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email.</p>`}
	digest := tokenHash(token)
	err = s.credentials.CreateResetToken(ctx, u.ID, digest, expires, func(tx *sql.Tx) error {
		return s.resetQueue.EnqueuePasswordReset(ctx, tx, message, "password-reset:"+hex.EncodeToString(digest))
	})
	if err != nil && !errors.Is(err, ErrResetRateLimited) && !errors.Is(err, ErrResetInvalid) {
		return err
	}
	return nil
}

type ResetPasswordRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"newPassword"`
}
type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

func validatePassword(value string) error {
	if utf8.RuneCountInString(value) < 8 || len(value) > 72 {
		return apperror.Invalid("newPassword", "Mật khẩu ít nhất 8 ký tự và tối đa 72 byte UTF-8.")
	}
	return nil
}

func (s *Service) ResetPassword(ctx context.Context, input ResetPasswordRequest) error {
	if s.credentials == nil {
		return apperror.New(http.StatusServiceUnavailable, "password_reset_unavailable", "Chức năng đặt lại mật khẩu chưa được cấu hình.")
	}
	if input.Token == "" || len(input.Token) > 256 {
		return apperror.New(http.StatusBadRequest, "invalid_reset_token", "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.")
	}
	if err := validatePassword(input.NewPassword); err != nil {
		return err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	err = s.credentials.ResetPassword(ctx, tokenHash(input.Token), string(hash), time.Now().UTC())
	if errors.Is(err, ErrResetInvalid) {
		return apperror.New(http.StatusBadRequest, "invalid_reset_token", "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.")
	}
	return err
}

func (s *Service) ChangePassword(ctx context.Context, userID string, input ChangePasswordRequest) error {
	if s.credentials == nil {
		return apperror.New(http.StatusServiceUnavailable, "password_change_unavailable", "Chức năng đổi mật khẩu chưa được cấu hình.")
	}
	if len(input.CurrentPassword) == 0 || len(input.CurrentPassword) > 72 {
		return apperror.Invalid("currentPassword", "Mật khẩu hiện tại bắt buộc.")
	}
	if err := validatePassword(input.NewPassword); err != nil {
		return err
	}
	u, err := s.users.ByID(ctx, userID)
	if err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(input.CurrentPassword)) != nil {
		return apperror.New(http.StatusUnauthorized, "invalid_current_password", "Mật khẩu hiện tại không đúng.")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	err = s.credentials.ChangePassword(ctx, userID, u.PasswordHash, string(hash))
	if errors.Is(err, ErrPasswordChanged) {
		return apperror.New(http.StatusConflict, "password_changed", "Mật khẩu đã được thay đổi trong một thao tác khác. Hãy đăng nhập lại.")
	}
	return err
}
