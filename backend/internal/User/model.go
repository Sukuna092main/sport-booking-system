package user

import "time"

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	FullName     string    `json:"fullName"`
	Phone        *string   `json:"phone"`
	Role         string    `json:"role"`
	Status       string    `json:"status"`
	AuthVersion  int64     `json:"-"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}
