package schedule

import "time"

type OperatingHour struct {
	Weekday  int    `json:"weekday"`
	OpensAt  string `json:"opensAt"`
	ClosesAt string `json:"closesAt"`
}
type TimeSlot struct {
	ID       string `json:"id"`
	Weekday  int    `json:"weekday"`
	StartsAt string `json:"startsAt"`
	EndsAt   string `json:"endsAt"`
}
type OperatingHours struct {
	CourtID   string          `json:"courtId"`
	TimeZone  string          `json:"timeZone"`
	Hours     []OperatingHour `json:"hours"`
	TimeSlots []TimeSlot      `json:"timeSlots"`
}
type Blackout struct {
	ID        string    `json:"id"`
	CourtID   string    `json:"courtId"`
	StartsAt  time.Time `json:"startsAt"`
	EndsAt    time.Time `json:"endsAt"`
	Reason    *string   `json:"reason"`
	IsActive  bool      `json:"isActive"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}
