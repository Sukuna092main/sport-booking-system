package court

type Court struct {
	ID                     string  `json:"id"`
	SportTypeID            string  `json:"sportTypeId"`
	Code                   string  `json:"code"`
	Name                   string  `json:"name"`
	Description            *string `json:"description"`
	IsActive               bool    `json:"isActive"`
	SlotDurationMinutes    int     `json:"slotDurationMinutes"`
	MinConsecutiveSlots    int     `json:"minConsecutiveSlots"`
	MaxConsecutiveSlots    int     `json:"maxConsecutiveSlots"`
	ReferencePriceAmount   *string `json:"referencePriceAmount"`
	ReferencePriceCurrency *string `json:"referencePriceCurrency"`
}

type OperatingHours struct {
	Weekday  int
	OpensAt  string
	ClosesAt string
	IsActive bool
}
