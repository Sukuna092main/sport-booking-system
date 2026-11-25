package payment

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type PaymentRequest struct {
	BookingID   string
	OrderRef    string
	BookingCode string
	AmountVND   int64
	ClientIP    string
	ExpiresAt   time.Time
}
type Gateway interface {
	Name() string
	CreatePayment(context.Context, PaymentRequest) (string, error)
}
type GatewayEvent struct {
	OrderRef          string
	AmountMinor       int64
	TransactionID     string
	ResponseCode      string
	TransactionStatus string
	EventKey          string
}
type StripeGateway struct {
	secret        string
	webhookSecret string
	frontend      string
	client        *http.Client
	now           func() time.Time
}

func NewStripeGateway(secret, webhookSecret, frontend string) *StripeGateway {
	return &StripeGateway{secret: secret, webhookSecret: webhookSecret, frontend: strings.TrimRight(frontend, "/"), client: &http.Client{Timeout: 15 * time.Second}, now: time.Now}
}
func (g *StripeGateway) Name() string { return "stripe" }
func (g *StripeGateway) CreatePayment(ctx context.Context, in PaymentRequest) (string, error) {
	if in.AmountVND < 1 || in.ExpiresAt.Before(g.now().Add(30*time.Minute)) {
		return "", fmt.Errorf("Stripe checkout requires at least 30 minutes remaining")
	}
	fields := url.Values{
		"mode": {"payment"}, "allowed_payment_method_types[0]": {"card"},
		"client_reference_id": {in.OrderRef}, "metadata[order_ref]": {in.OrderRef},
		"line_items[0][price_data][currency]":           {"vnd"},
		"line_items[0][price_data][unit_amount]":        {strconv.FormatInt(in.AmountVND, 10)},
		"line_items[0][price_data][product_data][name]": {"Deposit " + in.BookingCode},
		"line_items[0][quantity]":                       {"1"}, "expires_at": {strconv.FormatInt(in.ExpiresAt.Unix(), 10)},
		"success_url": {g.frontend + "/payment-result?bookingId=" + url.QueryEscape(in.BookingID) + "&ref=" + url.QueryEscape(in.OrderRef) + "&gateway=pending&session_id={CHECKOUT_SESSION_ID}"},
		"cancel_url":  {g.frontend + "/payment-result?bookingId=" + url.QueryEscape(in.BookingID) + "&ref=" + url.QueryEscape(in.OrderRef) + "&gateway=failed"},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.stripe.com/v1/checkout/sessions", strings.NewReader(fields.Encode()))
	if err != nil {
		return "", err
	}
	req.SetBasicAuth(g.secret, "")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Idempotency-Key", in.OrderRef)
	req.Header.Set("Stripe-Version", "2026-11-18.endive")
	res, err := g.client.Do(req)
	if err != nil {
		return "", errors.New("Stripe checkout request failed")
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return "", fmt.Errorf("Stripe checkout returned HTTP %d", res.StatusCode)
	}
	var session struct {
		ID  string
		URL string
	}
	if err = json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(&session); err != nil {
		return "", errors.New("invalid Stripe checkout response")
	}
	parsed, err := url.Parse(session.URL)
	if err != nil || parsed.Scheme != "https" || parsed.Hostname() != "checkout.stripe.com" || session.ID == "" {
		return "", errors.New("invalid Stripe checkout URL")
	}
	return session.URL, nil
}

var ErrIgnoredStripeEvent = errors.New("ignored Stripe event")

func (g *StripeGateway) Verify(body []byte, signature string) (GatewayEvent, error) {
	var timestamp string
	var signatures []string
	for _, part := range strings.Split(signature, ",") {
		k, v, ok := strings.Cut(strings.TrimSpace(part), "=")
		if ok && k == "t" {
			if timestamp != "" {
				return GatewayEvent{}, errors.New("duplicate timestamp")
			}
			timestamp = v
		}
		if ok && k == "v1" {
			signatures = append(signatures, v)
		}
	}
	stamp, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil || g.webhookSecret == "" || g.now().Sub(time.Unix(stamp, 0)).Abs() > 5*time.Minute {
		return GatewayEvent{}, errors.New("invalid Stripe timestamp")
	}
	mac := hmac.New(sha256.New, []byte(g.webhookSecret))
	mac.Write([]byte(timestamp + "."))
	mac.Write(body)
	valid := false
	for _, sig := range signatures {
		decoded, e := hex.DecodeString(sig)
		if e == nil && hmac.Equal(decoded, mac.Sum(nil)) {
			valid = true
		}
	}
	if !valid {
		return GatewayEvent{}, errors.New("invalid Stripe signature")
	}
	var event struct {
		ID   string
		Type string
		Data struct {
			Object struct {
				ID                string
				Object            string
				ClientReferenceID string `json:"client_reference_id"`
				AmountTotal       int64  `json:"amount_total"`
				Currency          string
				PaymentStatus     string `json:"payment_status"`
			}
		}
	}
	if err = json.Unmarshal(body, &event); err != nil {
		return GatewayEvent{}, err
	}
	if event.Type != "checkout.session.completed" && event.Type != "checkout.session.async_payment_succeeded" && event.Type != "checkout.session.async_payment_failed" && event.Type != "checkout.session.expired" {
		return GatewayEvent{}, ErrIgnoredStripeEvent
	}
	s := event.Data.Object
	if event.ID == "" || s.ID == "" || s.Object != "checkout.session" || s.ClientReferenceID == "" || s.Currency != "vnd" || s.AmountTotal < 1 {
		return GatewayEvent{}, errors.New("invalid Stripe event data")
	}
	result := GatewayEvent{OrderRef: s.ClientReferenceID, AmountMinor: s.AmountTotal, TransactionID: s.ID, EventKey: event.ID, ResponseCode: "failed", TransactionStatus: "failed"}
	if s.PaymentStatus == "paid" && (event.Type == "checkout.session.completed" || event.Type == "checkout.session.async_payment_succeeded") {
		result.ResponseCode = "00"
		result.TransactionStatus = "00"
	} else if event.Type == "checkout.session.completed" {
		return GatewayEvent{}, ErrIgnoredStripeEvent
	}
	return result, nil
}
