package booking

import "time"

type Slot struct {
	TimeSlotID string    `json:"timeSlotId"`
	StartsAt   time.Time `json:"startsAt"`
	EndsAt     time.Time `json:"endsAt"`
}

type Booking struct {
	ID          string     `json:"id"`
	BookingCode string     `json:"bookingCode"`
	CustomerID  string     `json:"customerId"`
	CourtID     string     `json:"courtId"`
	BookingDate string     `json:"bookingDate"`
	Status      string     `json:"status"`
	Slots       []Slot     `json:"slots"`
	CreatedAt   time.Time  `json:"createdAt"`
	CancelledAt *time.Time `json:"cancelledAt"`
}

type CreateRequest struct {
	CourtID     string   `json:"courtId"`
	BookingDate string   `json:"bookingDate"`
	TimeSlotIDs []string `json:"timeSlotIds"`
}

type CreateCommand struct {
	CustomerID string
	Key        string
	Hash       [32]byte
	RequestID  string
	Request    CreateRequest
}

type Filter struct {
	Status   string
	Page     int
	PageSize int
}

type PageMeta struct {
	Page     int   `json:"page"`
	PageSize int   `json:"pageSize"`
	Total    int64 `json:"total"`
}

type ListResult struct {
	Data []Booking `json:"data"`
	Meta PageMeta  `json:"meta"`
}
