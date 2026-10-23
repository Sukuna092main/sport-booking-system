package booking

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
)

// AdminFilter selects booking parents before loading their historical slots.
type AdminFilter struct {
	CourtID  string
	Date     string
	Status   string
	Page     int
	PageSize int
}

type Statistics struct {
	From              string `json:"from"`
	To                string `json:"to"`
	TotalBookings     int64  `json:"totalBookings"`
	ConfirmedBookings int64  `json:"confirmedBookings"`
	CancelledBookings int64  `json:"cancelledBookings"`
}

func (r *SQLRepository) AdminList(ctx context.Context, f AdminFilter) ([]Booking, int64, error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return nil, 0, err
	}
	defer tx.Rollback()
	const predicate = ` FROM bookings WHERE ($1='' OR court_id=NULLIF($1,'')::uuid) AND ($2='' OR booking_date=NULLIF($2,'')::date) AND ($3='' OR status=$3)`
	var total int64
	if err = tx.QueryRowContext(ctx, `SELECT count(*)`+predicate, f.CourtID, f.Date, f.Status).Scan(&total); err != nil {
		return nil, 0, err
	}
	values, err := readBookings(ctx, tx, `SELECT *`+predicate+` ORDER BY created_at DESC,id DESC LIMIT $4 OFFSET $5`, f.CourtID, f.Date, f.Status, f.PageSize, int64(f.Page-1)*int64(f.PageSize))
	if err != nil {
		return nil, 0, err
	}
	return values, total, tx.Commit()
}

func loadAdmin(ctx context.Context, tx *sql.Tx, id string) (Booking, error) {
	values, err := readBookings(ctx, tx, `SELECT * FROM bookings WHERE id=$1`, id)
	if err != nil {
		return Booking{}, err
	}
	if len(values) == 0 {
		return Booking{}, notFound()
	}
	return values[0], nil
}

func (r *SQLRepository) AdminByID(ctx context.Context, id string) (Booking, error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return Booking{}, err
	}
	defer tx.Rollback()
	value, err := loadAdmin(ctx, tx, id)
	if err != nil {
		return Booking{}, err
	}
	return value, tx.Commit()
}

// AdminCancel uses the same customer -> court -> booking lock order and slot
// snapshots as customer writes. The owner row is locked even when inactive:
// administrators still need to resolve affected bookings for those accounts.
func (r *SQLRepository) AdminCancel(ctx context.Context, actorID, id, requestID, reason string) (value Booking, err error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return Booking{}, err
	}
	defer tx.Rollback()
	defer func() { err = writeError(err) }()
	var owner, court, status string
	err = tx.QueryRowContext(ctx, `SELECT customer_id::text,court_id::text FROM bookings WHERE id=$1`, id).Scan(&owner, &court)
	if errors.Is(err, sql.ErrNoRows) {
		return Booking{}, notFound()
	}
	if err != nil {
		return Booking{}, err
	}
	if err = tx.QueryRowContext(ctx, `SELECT id::text FROM users WHERE id=$1 FOR UPDATE`, owner).Scan(&owner); err != nil {
		return Booking{}, err
	}
	if err = tx.QueryRowContext(ctx, `SELECT id::text FROM courts WHERE id=$1 FOR UPDATE`, court).Scan(&court); err != nil {
		return Booking{}, err
	}
	if err = tx.QueryRowContext(ctx, `SELECT status FROM bookings WHERE id=$1 FOR UPDATE`, id).Scan(&status); err != nil {
		return Booking{}, err
	}
	if status == "CANCELLED" {
		return Booking{}, apperror.New(409, "already_cancelled", "Booking đã được hủy.")
	}
	value, err = loadAdmin(ctx, tx, id)
	if err != nil {
		return Booking{}, err
	}
	value, err = r.cancelLocked(ctx, tx, value, actorID, requestID, &reason)
	if err != nil {
		return Booking{}, err
	}
	return value, tx.Commit()
}

// cancelLocked is the shared cancellation core. Callers must already hold the
// owner, court, and booking locks and have loaded the verified target snapshots.
func (r *SQLRepository) cancelLocked(ctx context.Context, tx *sql.Tx, value Booking, actorID, requestID string, reason *string) (Booking, error) {
	now := r.now().UTC().Truncate(time.Microsecond)
	if value.Status != "CONFIRMED" || !value.Slots[0].StartsAt.After(now) {
		return Booking{}, apperror.New(409, "cancellation_closed", "Chỉ được hủy trước thời điểm bắt đầu slot đầu tiên.")
	}
	if _, err := tx.ExecContext(ctx, `UPDATE bookings SET status='CANCELLED',cancelled_at=$2 WHERE id=$1`, value.ID, now); err != nil {
		return Booking{}, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE booking_slots SET released_at=$2 WHERE booking_id=$1 AND released_at IS NULL`, value.ID, now); err != nil {
		return Booking{}, err
	}
	details := `{"previousStatus":"CONFIRMED","status":"CANCELLED"}`
	if reason != nil {
		encoded, _ := json.Marshal(struct {
			PreviousStatus string `json:"previousStatus"`
			Status         string `json:"status"`
			Reason         string `json:"reason"`
			Result         string `json:"result"`
		}{"CONFIRMED", "CANCELLED", *reason, "success"})
		details = string(encoded)
	}
	if err := audit(ctx, tx, actorID, value.ID, "BOOKING_CANCELLED", requestID, details, now); err != nil {
		return Booking{}, err
	}
	value.Status, value.CancelledAt = "CANCELLED", &now
	return value, nil
}

func (r *SQLRepository) AdminStatistics(ctx context.Context, from, to string) (Statistics, error) {
	value := Statistics{From: from, To: to}
	err := r.db.QueryRowContext(ctx, `SELECT count(*),count(*) FILTER (WHERE status='CONFIRMED'),count(*) FILTER (WHERE status='CANCELLED') FROM bookings WHERE booking_date >= $1::date AND booking_date <= $2::date`, from, to).Scan(&value.TotalBookings, &value.ConfirmedBookings, &value.CancelledBookings)
	return value, err
}
