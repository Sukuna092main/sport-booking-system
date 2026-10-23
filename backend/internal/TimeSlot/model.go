package timeslot

// Template is a weekly local-time interval, not a dated booking snapshot.
type Template struct {
	ID       string
	Weekday  int
	StartsAt string
	EndsAt   string
	IsActive bool
}
