package payment

import "time"

type Payment struct {
	ID               string     `json:"id"`
	BookingID        string     `json:"bookingId"`
	Provider         string     `json:"provider"`
	ProviderOrderRef string     `json:"providerOrderRef"`
	AmountVND        int64      `json:"amountVnd"`
	Currency         string     `json:"currency"`
	Status           string     `json:"status"`
	CheckoutURL      *string    `json:"checkoutUrl,omitempty"`
	CreatedAt        time.Time  `json:"createdAt"`
	PaidAt           *time.Time `json:"paidAt"`
	BookingCode      string     `json:"-"`
	HoldExpiresAt    time.Time  `json:"-"`
}

type Pricing struct {
	CourtID         string    `json:"courtId"`
	PricePerSlotVND int64     `json:"pricePerSlotVnd"`
	IsActive        bool      `json:"isActive"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type PaymentStatus struct {
	BookingID          string     `json:"bookingId"`
	BookingStatus      string     `json:"bookingStatus"`
	HoldExpiresAt      *time.Time `json:"holdExpiresAt,omitempty"`
	TotalAmountVND     int64      `json:"totalAmountVnd"`
	DepositAmountVND   int64      `json:"depositAmountVnd"`
	RemainingAmountVND int64      `json:"remainingAmountVnd"`
	Payment            *Payment   `json:"payment,omitempty"`
}

type WebhookAck struct {
	RspCode string `json:"RspCode"`
	Message string `json:"Message"`
}
