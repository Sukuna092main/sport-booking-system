package payment

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/httpinput"
)

type Options struct {
	Enabled           bool
	Provider          string
	MockAllowed       bool
	FrontendPublicURL string
}
type Service struct {
	repo     *SQLRepository
	gateway  Gateway
	verifier WebhookVerifier
	options  Options
	now      func() time.Time
}

func NewService(repo *SQLRepository, gateway Gateway, verifier WebhookVerifier, options Options, now func() time.Time) *Service {
	if now == nil {
		now = time.Now
	}
	if options.Provider == "" {
		options.Provider = "mock"
	}
	return &Service{repo: repo, gateway: gateway, verifier: verifier, options: options, now: now}
}

func orderReference() (string, error) {
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return "SBP" + strings.ToUpper(hex.EncodeToString(raw)), nil
}

func (s *Service) StartCheckout(ctx context.Context, ownerID, bookingID, clientIP string) (Payment, error) {
	if !s.options.Enabled || s.gateway == nil {
		return Payment{}, apperror.New(http.StatusServiceUnavailable, "payment_unavailable", "Thanh toán trực tuyến chưa được bật.")
	}
	if !httpinput.UUID(bookingID) {
		return Payment{}, apperror.Invalid("bookingId", "ID booking phải là UUID hợp lệ.")
	}
	ref, err := orderReference()
	if err != nil {
		return Payment{}, err
	}
	value, _, err := s.repo.StartAttempt(ctx, ownerID, bookingID, s.gateway.Name(), ref)
	if err != nil {
		return Payment{}, err
	}
	if value.CheckoutURL != nil && *value.CheckoutURL != "" {
		return value, nil
	}
	if s.gateway.Name() == "vnpay" && value.AmountVND < 5000 {
		_, _ = s.repo.db.ExecContext(ctx, `UPDATE payments SET status='FAILED',provider_response_code='AMOUNT_TOO_SMALL',updated_at=clock_timestamp() WHERE id=$1 AND status='PENDING'`, value.ID)
		return Payment{}, apperror.New(http.StatusUnprocessableEntity, "payment_amount_too_small", "Tiền cọc phải tối thiểu 5.000 VND để thanh toán qua VNPAY.")
	}
	checkout, err := s.gateway.CreatePayment(ctx, PaymentRequest{OrderRef: value.ProviderOrderRef, BookingCode: value.BookingCode, AmountVND: value.AmountVND, ClientIP: clientIP, ExpiresAt: value.HoldExpiresAt})
	if err != nil {
		_, _ = s.repo.db.ExecContext(ctx, `UPDATE payments SET status='FAILED',updated_at=clock_timestamp() WHERE id=$1 AND status='PENDING'`, value.ID)
		return Payment{}, err
	}
	if err = s.repo.SetCheckoutURL(ctx, value.ID, checkout); err != nil {
		return Payment{}, err
	}
	value.CheckoutURL = &checkout
	return value, nil
}

func (s *Service) Status(ctx context.Context, ownerID, bookingID string) (PaymentStatus, error) {
	if !httpinput.UUID(bookingID) {
		return PaymentStatus{}, apperror.Invalid("bookingId", "ID booking phải là UUID hợp lệ.")
	}
	return s.repo.OwnedStatus(ctx, ownerID, bookingID)
}

func (s *Service) ProcessVNPAY(ctx context.Context, values url.Values) WebhookAck {
	if s.options.Provider != "vnpay" || s.verifier == nil {
		return WebhookAck{RspCode: "99", Message: "System error"}
	}
	event, err := s.verifier.Verify(values)
	if err != nil {
		return WebhookAck{RspCode: "97", Message: "Invalid signature"}
	}
	ack, err := s.repo.ProcessEvent(ctx, "vnpay", event)
	if err != nil {
		return WebhookAck{RspCode: "99", Message: "System error"}
	}
	return ack
}

func (s *Service) VerifyVNPAYReturn(values url.Values) (GatewayEvent, error) {
	if s.options.Provider != "vnpay" || s.verifier == nil {
		return GatewayEvent{}, fmt.Errorf("vnpay is not enabled")
	}
	return s.verifier.Verify(values)
}

func (s *Service) CompleteMock(ctx context.Context, ownerID, orderRef string, success bool) (WebhookAck, error) {
	if !s.options.MockAllowed || s.options.Provider != "mock" {
		return WebhookAck{}, apperror.New(http.StatusNotFound, "not_found", "Không tìm thấy giao dịch.")
	}
	event, err := s.repo.MockEvent(ctx, ownerID, orderRef, success)
	if err != nil {
		return WebhookAck{}, err
	}
	return s.repo.ProcessEvent(ctx, "mock", event)
}

func (s *Service) SetPricing(ctx context.Context, courtID, actorID, requestID string, value Pricing) (Pricing, error) {
	if !httpinput.UUID(courtID) {
		return Pricing{}, apperror.Invalid("courtId", "ID sân phải là UUID hợp lệ.")
	}
	if value.PricePerSlotVND < 1 || value.PricePerSlotVND > math.MaxInt64/100 {
		return Pricing{}, apperror.Invalid("pricePerSlotVnd", "Giá mỗi slot phải là số nguyên VND dương trong phạm vi cho phép.")
	}
	return s.repo.SetPricing(ctx, courtID, actorID, requestID, value.PricePerSlotVND, value.IsActive)
}

func (s *Service) Pricing(ctx context.Context, courtID string) (Pricing, error) {
	if !httpinput.UUID(courtID) {
		return Pricing{}, apperror.Invalid("courtId", "ID sân phải là UUID hợp lệ.")
	}
	return s.repo.GetPricing(ctx, courtID)
}

func (s *Service) ReturnRedirect(event GatewayEvent) string {
	status := "failed"
	if event.ResponseCode == "00" && event.TransactionStatus == "00" {
		status = "pending"
	}
	u, err := url.Parse(strings.TrimRight(s.options.FrontendPublicURL, "/") + "/payment-result")
	if err != nil {
		return s.options.FrontendPublicURL
	}
	q := u.Query()
	q.Set("ref", event.OrderRef)
	q.Set("gateway", status)
	u.RawQuery = q.Encode()
	return u.String()
}

func mockEventKey(ref string, success bool) string {
	sum := sha256.Sum256([]byte(fmt.Sprintf("mock:%s:%t", ref, success)))
	return hex.EncodeToString(sum[:])
}
