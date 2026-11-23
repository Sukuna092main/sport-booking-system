package payment

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/httpinput"
)

type Options struct {
	Enabled           bool
	Provider          string
	FrontendPublicURL string
}
type Service struct {
	repo     *SQLRepository
	gateway  Gateway
	verifier *StripeGateway
	options  Options
	now      func() time.Time
}

func NewService(repo *SQLRepository, gateway Gateway, verifier *StripeGateway, options Options, now func() time.Time) *Service {
	if now == nil {
		now = time.Now
	}
	if options.Provider == "" {
		options.Provider = "stripe"
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
	if value.HoldExpiresAt.Before(s.now().Add(30 * time.Minute)) {
		return Payment{}, apperror.New(409, "payment_window_closed", "Không còn đủ 30 phút để tạo Stripe Checkout.")
	}
	checkout, err := s.gateway.CreatePayment(ctx, PaymentRequest{BookingID: value.BookingID, OrderRef: value.ProviderOrderRef, BookingCode: value.BookingCode, AmountVND: value.AmountVND, ClientIP: clientIP, ExpiresAt: value.HoldExpiresAt})
	if err != nil {
		return Payment{}, apperror.New(503, "provider_unavailable", "Chưa tạo được Stripe Checkout. Vui lòng thử lại cùng booking.")
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

func (s *Service) ProcessStripe(ctx context.Context, body []byte, signature string) error {
	if s.verifier == nil {
		return apperror.New(503, "payment_unavailable", "Stripe chưa được cấu hình.")
	}
	event, err := s.verifier.Verify(body, signature)
	if errors.Is(err, ErrIgnoredStripeEvent) {
		return nil
	}
	if err != nil {
		return apperror.New(400, "invalid_webhook", "Webhook Stripe không hợp lệ.")
	}
	ack, err := s.repo.ProcessEvent(ctx, "stripe", event)
	if err != nil {
		return err
	}
	if ack.RspCode != "00" && ack.RspCode != "02" {
		return apperror.New(409, "payment_mismatch", "Thông tin thanh toán không khớp.")
	}
	return nil
}

func (s *Service) SetPricing(ctx context.Context, courtID, actorID, requestID string, value Pricing) (Pricing, error) {
	if !httpinput.UUID(courtID) {
		return Pricing{}, apperror.Invalid("courtId", "ID sân phải là UUID hợp lệ.")
	}
	if value.PricePerSlotVND < 1 || value.PricePerSlotVND > min(int64(9007199254740991), math.MaxInt64/100) {
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
