package schedule

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/jackc/pgx/v5/pgconn"
)

type Repository struct{ db *sql.DB }

func NewRepository(db *sql.DB) *Repository { return &Repository{db} }
func missing() error                       { return apperror.New(404, "not_found", "Không tìm thấy tài nguyên.") }
func writeError(err error) error {
	var pg *pgconn.PgError
	if errors.As(err, &pg) && (pg.Code == "23P01" || pg.Code == "23505") {
		return apperror.New(409, "schedule_overlap", "Lịch bị trùng với dữ liệu hiện hành.")
	}
	return err
}
func lockCourt(ctx context.Context, tx *sql.Tx, id string) (int, error) {
	var duration int
	err := tx.QueryRowContext(ctx, `SELECT slot_duration_minutes FROM courts WHERE id=$1 FOR UPDATE`, id).Scan(&duration)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, missing()
	}
	return duration, err
}
func audit(ctx context.Context, tx *sql.Tx, actor, action, entity, id, requestID string, details any) error {
	payload, err := json.Marshal(details)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,details,request_id) VALUES($1,$2,$3,$4,$5::jsonb,$6)`, actor, action, entity, id, string(payload), requestID)
	return err
}
func readHours(ctx context.Context, tx *sql.Tx, id string) (OperatingHours, error) {
	value := OperatingHours{CourtID: id, Hours: make([]OperatingHour, 0), TimeSlots: make([]TimeSlot, 0)}
	var exists bool
	if err := tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM courts WHERE id=$1)`, id).Scan(&exists); err != nil {
		return value, err
	}
	if !exists {
		return value, missing()
	}
	rows, err := tx.QueryContext(ctx, `SELECT weekday,to_char(opens_at,'HH24:MI:SS'),to_char(closes_at,'HH24:MI:SS') FROM court_operating_hours WHERE court_id=$1 AND is_active ORDER BY weekday,opens_at`, id)
	if err != nil {
		return value, err
	}
	for rows.Next() {
		var h OperatingHour
		if err = rows.Scan(&h.Weekday, &h.OpensAt, &h.ClosesAt); err != nil {
			rows.Close()
			return value, err
		}
		value.Hours = append(value.Hours, h)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return value, err
	}
	rows, err = tx.QueryContext(ctx, `SELECT id::text,weekday,to_char(starts_at,'HH24:MI:SS'),to_char(ends_at,'HH24:MI:SS') FROM time_slots WHERE court_id=$1 AND is_active ORDER BY weekday,starts_at`, id)
	if err != nil {
		return value, err
	}
	defer rows.Close()
	for rows.Next() {
		var s TimeSlot
		if err = rows.Scan(&s.ID, &s.Weekday, &s.StartsAt, &s.EndsAt); err != nil {
			return value, err
		}
		value.TimeSlots = append(value.TimeSlots, s)
	}
	return value, rows.Err()
}
func (r *Repository) Hours(ctx context.Context, id string) (OperatingHours, error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return OperatingHours{}, err
	}
	defer tx.Rollback()
	value, err := readHours(ctx, tx, id)
	if err != nil {
		return value, err
	}
	return value, tx.Commit()
}

// RegenerateSlots requires the caller to hold the court row FOR UPDATE. Old
// templates remain available to booking_slots foreign keys and historical reads.
// Only complete duration intervals are generated; a shorter closing tail is closed.
func RegenerateSlots(ctx context.Context, tx *sql.Tx, courtID string, duration int) error {
	value, err := readHours(ctx, tx, courtID)
	if err != nil {
		return err
	}
	slots, err := buildSlots(value.Hours, duration)
	if err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE time_slots SET is_active=false WHERE court_id=$1 AND is_active`, courtID); err != nil {
		return err
	}
	for _, s := range slots {
		if _, err = tx.ExecContext(ctx, `INSERT INTO time_slots(court_id,weekday,starts_at,ends_at) VALUES($1,$2,$3::time,$4::time)`, courtID, s.Weekday, s.StartsAt, s.EndsAt); err != nil {
			return writeError(err)
		}
	}
	return nil
}
func (r *Repository) Replace(ctx context.Context, id, actor, requestID string, hours []OperatingHour) (value OperatingHours, err error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return value, err
	}
	defer tx.Rollback()
	defer func() { err = writeError(err) }()
	duration, err := lockCourt(ctx, tx, id)
	if err != nil {
		return value, err
	}
	before, err := readHours(ctx, tx, id)
	if err != nil {
		return value, err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE court_operating_hours SET is_active=false WHERE court_id=$1 AND is_active`, id); err != nil {
		return value, err
	}
	for _, h := range hours {
		if _, err = tx.ExecContext(ctx, `INSERT INTO court_operating_hours(court_id,weekday,opens_at,closes_at) VALUES($1,$2,$3::time,$4::time)`, id, h.Weekday, h.OpensAt, h.ClosesAt); err != nil {
			return value, err
		}
	}
	if err = RegenerateSlots(ctx, tx, id, duration); err != nil {
		return value, err
	}
	value, err = readHours(ctx, tx, id)
	if err != nil {
		return value, err
	}
	if err = audit(ctx, tx, actor, "OPERATING_HOURS_REPLACED", "COURT", id, requestID, map[string]any{"before": before, "after": value}); err != nil {
		return value, err
	}
	return value, tx.Commit()
}

const blackoutColumns = `id::text,court_id::text,starts_at,ends_at,reason,is_active,created_at,updated_at`

type scanner interface{ Scan(...any) error }

func scanBlackout(row scanner) (Blackout, error) {
	var v Blackout
	err := row.Scan(&v.ID, &v.CourtID, &v.StartsAt, &v.EndsAt, &v.Reason, &v.IsActive, &v.CreatedAt, &v.UpdatedAt)
	v.StartsAt = v.StartsAt.UTC()
	v.EndsAt = v.EndsAt.UTC()
	v.CreatedAt = v.CreatedAt.UTC()
	v.UpdatedAt = v.UpdatedAt.UTC()
	if errors.Is(err, sql.ErrNoRows) {
		err = missing()
	}
	return v, err
}
func (r *Repository) Blackouts(ctx context.Context, id string) ([]Blackout, error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var exists bool
	if err = tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM courts WHERE id=$1)`, id).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, missing()
	}
	rows, err := tx.QueryContext(ctx, `SELECT `+blackoutColumns+` FROM court_blackouts WHERE court_id=$1 ORDER BY starts_at,id`, id)
	if err != nil {
		return nil, err
	}
	values := make([]Blackout, 0)
	for rows.Next() {
		v, e := scanBlackout(rows)
		if e != nil {
			rows.Close()
			return nil, e
		}
		values = append(values, v)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	return values, tx.Commit()
}
func (r *Repository) Create(ctx context.Context, actor, requestID string, v Blackout) (Blackout, error) {
	v.StartsAt = v.StartsAt.UTC().Truncate(time.Microsecond)
	v.EndsAt = v.EndsAt.UTC().Truncate(time.Microsecond)
	if err := validateBlackout(v); err != nil {
		return Blackout{}, err
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return Blackout{}, err
	}
	defer tx.Rollback()
	if _, err = lockCourt(ctx, tx, v.CourtID); err != nil {
		return Blackout{}, err
	}
	v, err = scanBlackout(tx.QueryRowContext(ctx, `INSERT INTO court_blackouts(court_id,created_by,starts_at,ends_at,reason) VALUES($1,$2,$3,$4,$5) RETURNING `+blackoutColumns, v.CourtID, actor, v.StartsAt, v.EndsAt, v.Reason))
	if err != nil {
		return Blackout{}, writeError(err)
	}
	if err = audit(ctx, tx, actor, "COURT_BLACKOUT_CREATED", "COURT_BLACKOUT", v.ID, requestID, map[string]any{"after": v}); err != nil {
		return Blackout{}, err
	}
	return v, tx.Commit()
}
func (r *Repository) Patch(ctx context.Context, courtID, id, actor, requestID string, patch BlackoutPatch) (Blackout, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return Blackout{}, err
	}
	defer tx.Rollback()
	if _, err = lockCourt(ctx, tx, courtID); err != nil {
		return Blackout{}, err
	}
	before, err := scanBlackout(tx.QueryRowContext(ctx, `SELECT `+blackoutColumns+` FROM court_blackouts WHERE id=$1 AND court_id=$2 FOR UPDATE`, id, courtID))
	if err != nil {
		return Blackout{}, err
	}
	v := before
	if patch.StartsAt != nil {
		v.StartsAt = *patch.StartsAt
	}
	if patch.EndsAt != nil {
		v.EndsAt = *patch.EndsAt
	}
	if patch.ReasonSet {
		v.Reason = patch.Reason
	}
	if patch.IsActive != nil {
		v.IsActive = *patch.IsActive
	}
	v.StartsAt = v.StartsAt.UTC().Truncate(time.Microsecond)
	v.EndsAt = v.EndsAt.UTC().Truncate(time.Microsecond)
	if err = validateBlackout(v); err != nil {
		return Blackout{}, err
	}
	v, err = scanBlackout(tx.QueryRowContext(ctx, `UPDATE court_blackouts SET starts_at=$3,ends_at=$4,reason=$5,is_active=$6,updated_at=clock_timestamp() WHERE id=$1 AND court_id=$2 RETURNING `+blackoutColumns, id, courtID, v.StartsAt, v.EndsAt, v.Reason, v.IsActive))
	if err != nil {
		return Blackout{}, writeError(err)
	}
	if err = audit(ctx, tx, actor, "COURT_BLACKOUT_UPDATED", "COURT_BLACKOUT", id, requestID, map[string]any{"before": before, "after": v}); err != nil {
		return Blackout{}, err
	}
	return v, tx.Commit()
}
func (r *Repository) Delete(ctx context.Context, courtID, id, actor, requestID string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = lockCourt(ctx, tx, courtID); err != nil {
		return err
	}
	before, err := scanBlackout(tx.QueryRowContext(ctx, `SELECT `+blackoutColumns+` FROM court_blackouts WHERE id=$1 AND court_id=$2 FOR UPDATE`, id, courtID))
	if err != nil {
		return err
	}
	if before.IsActive {
		if _, err = tx.ExecContext(ctx, `UPDATE court_blackouts SET is_active=false,updated_at=clock_timestamp() WHERE id=$1`, id); err != nil {
			return err
		}
		if err = audit(ctx, tx, actor, "COURT_BLACKOUT_DEACTIVATED", "COURT_BLACKOUT", id, requestID, map[string]any{"before": before, "isActive": false}); err != nil {
			return err
		}
	}
	return tx.Commit()
}
