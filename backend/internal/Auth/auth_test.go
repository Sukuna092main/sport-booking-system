package auth

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	user "github.com/Sukuna092main/sport-booking-system/backend/internal/User"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/testdb"
)

const testUserID = "11111111-1111-4111-8111-111111111111"

type memoryUsers struct {
	value user.User
	err   error
}

func (m *memoryUsers) Create(_ context.Context, email, hash, name string, phone *string) (user.User, error) {
	if m.err != nil {
		return user.User{}, m.err
	}
	m.value = user.User{ID: testUserID, Email: email, PasswordHash: hash, FullName: name, Phone: phone, Role: "USER", Status: "ACTIVE"}
	return m.value, nil
}
func (m *memoryUsers) ByEmail(context.Context, string) (user.User, error) { return m.value, m.err }
func (m *memoryUsers) ByID(context.Context, string) (user.User, error)    { return m.value, m.err }

func assertCode(t *testing.T, err error, code string) {
	t.Helper()
	var safe *apperror.Error
	if !errors.As(err, &safe) || safe.Code != code {
		t.Fatalf("want %s, got %v", code, err)
	}
}

func TestRegisterAndLogin(t *testing.T) {
	ctx := context.Background()
	repo := &memoryUsers{}
	tokens := NewTokens(strings.Repeat("s", 32), "sport", 15*time.Minute, time.Now)
	s := NewService(repo, tokens)
	u, err := s.Register(ctx, RegisterRequest{Email: "  HUY@example.com ", Password: " mật khẩu ", FullName: " Huy "})
	if err != nil {
		t.Fatal(err)
	}
	if u.Email != "huy@example.com" || u.Role != "USER" || u.Status != "ACTIVE" || u.FullName != "Huy" {
		t.Fatalf("bad user: %#v", u)
	}
	if u.PasswordHash == " mật khẩu " || bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(" mật khẩu ")) != nil {
		t.Fatal("password must be hashed without trimming")
	}
	result, err := s.Login(ctx, LoginRequest{Email: "HUY@example.com", Password: " mật khẩu "})
	if err != nil {
		t.Fatal(err)
	}
	claims, err := tokens.Verify(result.AccessToken)
	if err != nil || claims.Subject != u.ID {
		t.Fatalf("bad JWT: %v", err)
	}
	_, err = s.Login(ctx, LoginRequest{Email: u.Email, Password: "wrong"})
	assertCode(t, err, "invalid_credentials")
	repo.value.Status = "INACTIVE"
	_, err = s.Login(ctx, LoginRequest{Email: u.Email, Password: "wrong"})
	assertCode(t, err, "invalid_credentials")
	_, err = s.Login(ctx, LoginRequest{Email: u.Email, Password: " mật khẩu "})
	assertCode(t, err, "account_inactive")
	repo.err = user.ErrNotFound
	_, err = s.Login(ctx, LoginRequest{Email: u.Email, Password: " mật khẩu "})
	assertCode(t, err, "invalid_credentials")
}

func TestRegisterValidation(t *testing.T) {
	repo := &memoryUsers{}
	s := NewService(repo, NewTokens(strings.Repeat("s", 32), "sport", time.Minute, time.Now))
	valid := RegisterRequest{Email: "a@example.com", Password: "abcdefgh", FullName: "Huy"}
	for _, change := range []func(*RegisterRequest){
		func(r *RegisterRequest) { r.Email = "Name <a@example.com>" }, func(r *RegisterRequest) { r.Password = "1234567" },
		func(r *RegisterRequest) { r.Password = strings.Repeat("á", 37) }, func(r *RegisterRequest) { r.FullName = "  " },
		func(r *RegisterRequest) { r.FullName = strings.Repeat("á", 121) }, func(r *RegisterRequest) { p := strings.Repeat("1", 31); r.Phone = &p },
	} {
		r := valid
		change(&r)
		_, err := s.Register(context.Background(), r)
		assertCode(t, err, "validation_error")
	}
	r := valid
	r.Password = strings.Repeat("á", 36)
	if _, err := s.Register(context.Background(), r); err != nil {
		t.Fatal("72 bytes should pass", err)
	}
	repo.err = user.ErrEmailTaken
	_, err := s.Register(context.Background(), valid)
	assertCode(t, err, "email_taken")
}

func TestJWTValidation(t *testing.T) {
	now := time.Date(2026, 10, 8, 10, 0, 0, 0, time.UTC)
	clock := func() time.Time { return now }
	tokens := NewTokens(strings.Repeat("s", 32), "sport", time.Minute, clock)
	encoded, _, err := tokens.Issue(testUserID, "USER")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = tokens.Verify(encoded); err != nil {
		t.Fatal(err)
	}
	other := NewTokens(strings.Repeat("x", 32), "sport", time.Minute, clock)
	if _, err = other.Verify(encoded); err == nil {
		t.Fatal("wrong key accepted")
	}
	now = now.Add(time.Minute)
	if _, err = tokens.Verify(encoded); err == nil {
		t.Fatal("expired token accepted")
	}
	now = now.Add(-time.Minute)
	for _, modify := range []func(*Claims){
		func(c *Claims) { c.ExpiresAt = nil }, func(c *Claims) { c.Subject = "bad" }, func(c *Claims) { c.Role = "ROOT" },
		func(c *Claims) { c.Issuer = "other" }, func(c *Claims) { c.Audience = nil }, func(c *Claims) { c.IssuedAt = jwt.NewNumericDate(now.Add(time.Hour)) },
	} {
		c := Claims{Role: "USER", RegisteredClaims: jwt.RegisteredClaims{Subject: testUserID, Issuer: "sport", Audience: jwt.ClaimStrings{"sport"}, IssuedAt: jwt.NewNumericDate(now), ExpiresAt: jwt.NewNumericDate(now.Add(time.Minute))}}
		modify(&c)
		bad, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(tokens.secret)
		if _, err = tokens.Verify(bad); err == nil {
			t.Fatal("invalid claims accepted")
		}
	}
	c := Claims{Role: "USER", RegisteredClaims: jwt.RegisteredClaims{Subject: testUserID, Issuer: "sport", Audience: jwt.ClaimStrings{"sport"}, IssuedAt: jwt.NewNumericDate(now), ExpiresAt: jwt.NewNumericDate(now.Add(time.Minute))}}
	for _, method := range []jwt.SigningMethod{jwt.SigningMethodHS384, jwt.SigningMethodNone} {
		var key any = tokens.secret
		if method == jwt.SigningMethodNone {
			key = jwt.UnsafeAllowNoneSignatureType
		}
		bad, _ := jwt.NewWithClaims(method, c).SignedString(key)
		if _, err = tokens.Verify(bad); err == nil {
			t.Fatal("wrong algorithm accepted")
		}
	}
}

func TestAuthPostgreSQL(t *testing.T) {
	db := testdb.Open(t)
	repo := user.NewRepository(db)
	s := NewService(repo, NewTokens(strings.Repeat("s", 32), "sport", 15*time.Minute, time.Now))
	ctx := context.Background()
	request := RegisterRequest{Email: "HUY@example.com", Password: "abcdefgh", FullName: "Huy"}
	u, err := s.Register(ctx, request)
	if err != nil {
		t.Fatal(err)
	}
	request.Email = "huy@EXAMPLE.com"
	_, err = s.Register(ctx, request)
	assertCode(t, err, "email_taken")
	loaded, err := repo.ByID(ctx, u.ID)
	if err != nil || loaded.Email != "huy@example.com" {
		t.Fatalf("persisted user: %v", err)
	}
	if _, err = s.Login(ctx, LoginRequest{Email: request.Email, Password: request.Password}); err != nil {
		t.Fatal(err)
	}
	if _, err = db.ExecContext(ctx, "UPDATE users SET status='INACTIVE' WHERE id=$1", u.ID); err != nil {
		t.Fatal(err)
	}
	_, err = s.Login(ctx, LoginRequest{Email: request.Email, Password: request.Password})
	assertCode(t, err, "account_inactive")
}

func TestConcurrentDuplicateRegistration(t *testing.T) {
	db := testdb.Open(t)
	s := NewService(user.NewRepository(db), NewTokens(strings.Repeat("s", 32), "sport", time.Minute, time.Now))
	done := make(chan error, 3)
	for _, email := range []string{"race@example.test", "RACE@example.test", " race@example.test "} {
		go func(email string) {
			_, err := s.Register(context.Background(), RegisterRequest{Email: email, Password: "password123", FullName: "Race"})
			done <- err
		}(email)
	}
	created := 0
	for i := 0; i < 3; i++ {
		err := <-done
		if err == nil {
			created++
		} else {
			assertCode(t, err, "email_taken")
		}
	}
	if created != 1 {
		t.Fatalf("created %d accounts for one email", created)
	}
}
