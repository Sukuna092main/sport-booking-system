package payment

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/sha512"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"math"
	"net"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

type PaymentRequest struct {
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

type WebhookVerifier interface {
	Verify(url.Values) (GatewayEvent, error)
}

type GatewayEvent struct {
	OrderRef          string
	AmountMinor       int64
	TransactionID     string
	ResponseCode      string
	TransactionStatus string
	EventKey          string
}

type MockGateway struct{ frontendURL string }

func NewMockGateway(frontendURL string) *MockGateway {
	return &MockGateway{frontendURL: strings.TrimRight(frontendURL, "/")}
}
func (g *MockGateway) Name() string { return "mock" }
func (g *MockGateway) CreatePayment(_ context.Context, request PaymentRequest) (string, error) {
	u, err := url.Parse(g.frontendURL + "/mock-payment")
	if err != nil {
		return "", err
	}
	q := u.Query()
	q.Set("ref", request.OrderRef)
	u.RawQuery = q.Encode()
	return u.String(), nil
}

type VNPAYConfig struct {
	PaymentURL, TMNCode, HashSecret, ReturnURL string
	Location                                   *time.Location
}
type VNPAYGateway struct {
	config VNPAYConfig
	now    func() time.Time
}

func NewVNPAYGateway(config VNPAYConfig, now func() time.Time) *VNPAYGateway {
	if config.Location == nil {
		config.Location = time.FixedZone("ICT", 7*3600)
	}
	if now == nil {
		now = time.Now
	}
	return &VNPAYGateway{config: config, now: now}
}
func (g *VNPAYGateway) Name() string { return "vnpay" }

func (g *VNPAYGateway) CreatePayment(_ context.Context, request PaymentRequest) (string, error) {
	if request.AmountVND < 1 || request.AmountVND > math.MaxInt64/100 {
		return "", fmt.Errorf("invalid vnpay amount")
	}
	ip := request.ClientIP
	if host, _, err := net.SplitHostPort(ip); err == nil {
		ip = host
	}
	if net.ParseIP(ip) == nil {
		ip = "127.0.0.1"
	}
	now := g.now().In(g.config.Location)
	params := map[string]string{
		"vnp_Version": "2.1.0", "vnp_Command": "pay", "vnp_TmnCode": g.config.TMNCode,
		"vnp_Amount": strconv.FormatInt(request.AmountVND*100, 10), "vnp_CurrCode": "VND", "vnp_TxnRef": request.OrderRef,
		"vnp_OrderInfo": "Deposit for booking " + request.BookingCode, "vnp_OrderType": "other", "vnp_Locale": "vn",
		"vnp_ReturnUrl": g.config.ReturnURL, "vnp_IpAddr": ip, "vnp_CreateDate": now.Format("20060102150405"),
		"vnp_ExpireDate": request.ExpiresAt.In(g.config.Location).Format("20060102150405"),
	}
	return g.signedURL(params)
}

func (g *VNPAYGateway) signedURL(params map[string]string) (string, error) {
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	hashParts := make([]string, 0, len(keys))
	for _, key := range keys {
		value := params[key]
		if value == "" {
			continue
		}
		parts = append(parts, url.QueryEscape(key)+"="+url.QueryEscape(value))
		hashParts = append(hashParts, key+"="+value)
	}
	hash := hmac.New(sha512.New, []byte(g.config.HashSecret))
	_, _ = hash.Write([]byte(strings.Join(hashParts, "&")))
	base := strings.TrimRight(g.config.PaymentURL, "?")
	return base + "?" + strings.Join(parts, "&") + "&vnp_SecureHash=" + hex.EncodeToString(hash.Sum(nil)), nil
}

func (g *VNPAYGateway) Verify(values url.Values) (GatewayEvent, error) {
	for key, items := range values {
		if len(items) != 1 {
			return GatewayEvent{}, fmt.Errorf("duplicate callback field %s", key)
		}
	}
	provided := values.Get("vnp_SecureHash")
	if provided == "" {
		return GatewayEvent{}, fmt.Errorf("missing vnpay signature")
	}
	params := make(map[string]string)
	for key, items := range values {
		if key == "vnp_SecureHash" || key == "vnp_SecureHashType" {
			continue
		}
		if len(items) > 0 {
			params[key] = items[0]
		}
	}
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		if params[key] != "" {
			parts = append(parts, key+"="+params[key])
		}
	}
	hash := hmac.New(sha512.New, []byte(g.config.HashSecret))
	_, _ = hash.Write([]byte(strings.Join(parts, "&")))
	expected := []byte(hex.EncodeToString(hash.Sum(nil)))
	if len(provided) != len(expected) || subtle.ConstantTimeCompare([]byte(strings.ToLower(provided)), expected) != 1 {
		return GatewayEvent{}, fmt.Errorf("invalid vnpay signature")
	}
	if values.Get("vnp_TmnCode") != g.config.TMNCode {
		return GatewayEvent{}, fmt.Errorf("invalid vnpay merchant")
	}
	amount, err := strconv.ParseInt(values.Get("vnp_Amount"), 10, 64)
	if err != nil || amount < 0 {
		return GatewayEvent{}, fmt.Errorf("invalid vnpay amount")
	}
	canonical := values.Encode()
	digest := sha256.Sum256([]byte(canonical))
	return GatewayEvent{OrderRef: values.Get("vnp_TxnRef"), AmountMinor: amount, TransactionID: values.Get("vnp_TransactionNo"), ResponseCode: values.Get("vnp_ResponseCode"), TransactionStatus: values.Get("vnp_TransactionStatus"), EventKey: hex.EncodeToString(digest[:])}, nil
}
