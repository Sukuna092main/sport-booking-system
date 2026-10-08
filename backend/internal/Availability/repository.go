package availability

import (
	"context"
	"database/sql"
	"errors"
	"time"

	court "github.com/Sukuna092main/sport-booking-system/backend/internal/Court"
	timeslot "github.com/Sukuna092main/sport-booking-system/backend/internal/TimeSlot"
)

var ErrCourtNotFound = errors.New("active court not found")

type Snapshot struct {
	CourtID         string
	Active          bool
	DurationMinutes int
	Hours           []court.OperatingHours
	Templates       []timeslot.Template
	Blocked         []Interval
}
type Repository interface {
	Read(context.Context, string, int, time.Time, time.Time) (Snapshot, error)
}
type SQLRepository struct{ db *sql.DB }

func NewRepository(db *sql.DB) *SQLRepository { return &SQLRepository{db: db} }

func (r *SQLRepository) Read(ctx context.Context, id string, weekday int, from, to time.Time) (Snapshot, error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return Snapshot{}, err
	}
	defer tx.Rollback()
	var result Snapshot
	err = tx.QueryRowContext(ctx, `SELECT c.id::text,c.is_active,c.slot_duration_minutes FROM courts c JOIN sport_types s ON s.id=c.sport_type_id WHERE c.id=$1 AND c.is_active AND s.is_active`, id).Scan(&result.CourtID, &result.Active, &result.DurationMinutes)
	if errors.Is(err, sql.ErrNoRows) {
		return Snapshot{}, ErrCourtNotFound
	}
	if err != nil {
		return Snapshot{}, err
	}
	rows, err := tx.QueryContext(ctx, `SELECT weekday,opens_at::text,closes_at::text,is_active FROM court_operating_hours WHERE court_id=$1 AND weekday=$2 AND is_active ORDER BY opens_at,id`, id, weekday)
	if err != nil {
		return Snapshot{}, err
	}
	for rows.Next() {
		var h court.OperatingHours
		if err = rows.Scan(&h.Weekday, &h.OpensAt, &h.ClosesAt, &h.IsActive); err != nil {
			rows.Close()
			return Snapshot{}, err
		}
		result.Hours = append(result.Hours, h)
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return Snapshot{}, err
	}
	rows.Close()
	rows, err = tx.QueryContext(ctx, `SELECT id::text,weekday,starts_at::text,ends_at::text,is_active FROM time_slots WHERE court_id=$1 AND weekday=$2 AND is_active ORDER BY starts_at,ends_at,id`, id, weekday)
	if err != nil {
		return Snapshot{}, err
	}
	for rows.Next() {
		var slot timeslot.Template
		if err = rows.Scan(&slot.ID, &slot.Weekday, &slot.StartsAt, &slot.EndsAt, &slot.IsActive); err != nil {
			rows.Close()
			return Snapshot{}, err
		}
		result.Templates = append(result.Templates, slot)
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return Snapshot{}, err
	}
	rows.Close()
	// Compare real timestamp snapshots, including bookings made against old templates.
	rows, err = tx.QueryContext(ctx, `SELECT starts_at,ends_at FROM court_blackouts WHERE court_id=$1 AND is_active AND starts_at<$3 AND ends_at>$2
	    UNION ALL
	    SELECT bs.starts_at,bs.ends_at FROM booking_slots bs JOIN bookings b ON b.id=bs.booking_id
	    WHERE bs.court_id=$1 AND b.status='CONFIRMED' AND bs.released_at IS NULL AND bs.starts_at<$3 AND bs.ends_at>$2`, id, from, to)
	if err != nil {
		return Snapshot{}, err
	}
	for rows.Next() {
		var interval Interval
		if err = rows.Scan(&interval.Start, &interval.End); err != nil {
			rows.Close()
			return Snapshot{}, err
		}
		result.Blocked = append(result.Blocked, interval)
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return Snapshot{}, err
	}
	rows.Close()
	if err = tx.Commit(); err != nil {
		return Snapshot{}, err
	}
	return result, nil
}
