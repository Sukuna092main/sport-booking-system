package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/httpinput"
)

type Claims struct {
	Role string `json:"role"`
	jwt.RegisteredClaims
}

type Tokens struct {
	secret []byte
	issuer string
	ttl    time.Duration
	now    func() time.Time
}

func NewTokens(secret, issuer string, ttl time.Duration, now func() time.Time) *Tokens {
	return &Tokens{secret: []byte(secret), issuer: issuer, ttl: ttl, now: now}
}

func (t *Tokens) Issue(id, role string) (string, time.Time, error) {
	now := t.now().UTC().Truncate(time.Second)
	expires := now.Add(t.ttl)
	claims := Claims{Role: role, RegisteredClaims: jwt.RegisteredClaims{
		Issuer: t.issuer, Subject: id, Audience: jwt.ClaimStrings{t.issuer},
		IssuedAt: jwt.NewNumericDate(now), ExpiresAt: jwt.NewNumericDate(expires),
	}}
	encoded, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(t.secret)
	return encoded, expires, err
}

func (t *Tokens) Verify(encoded string) (Claims, error) {
	var claims Claims
	_, err := jwt.ParseWithClaims(encoded, &claims, func(token *jwt.Token) (any, error) { return t.secret, nil },
		jwt.WithValidMethods([]string{"HS256"}), jwt.WithIssuer(t.issuer), jwt.WithAudience(t.issuer),
		jwt.WithExpirationRequired(), jwt.WithIssuedAt(), jwt.WithTimeFunc(t.now))
	if err != nil {
		return Claims{}, err
	}
	if !httpinput.UUID(claims.Subject) || (claims.Role != "USER" && claims.Role != "ADMIN") || claims.IssuedAt == nil {
		return Claims{}, fmt.Errorf("invalid identity claims")
	}
	return claims, nil
}
