package inventory

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	schedule "github.com/Sukuna092main/sport-booking-system/backend/internal/Admin/schedule"
	court "github.com/Sukuna092main/sport-booking-system/backend/internal/Court"
	sport "github.com/Sukuna092main/sport-booking-system/backend/internal/SportType"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/jackc/pgx/v5/pgconn"
)

type SQLRepository struct{ db *sql.DB }

const courtColumns = `id::text,sport_type_id::text,code,name,description,is_active,slot_duration_minutes,min_consecutive_slots,max_consecutive_slots,reference_price_amount::text,reference_price_currency`

type scanner interface{ Scan(...any) error }

func scanCourt(row scanner) (v court.Court, err error) {
	err = row.Scan(&v.ID, &v.SportTypeID, &v.Code, &v.Name, &v.Description, &v.IsActive, &v.SlotDurationMinutes, &v.MinConsecutiveSlots, &v.MaxConsecutiveSlots, &v.ReferencePriceAmount, &v.ReferencePriceCurrency)
	return
}
func scanSport(row scanner) (v sport.SportType, err error) {
	err = row.Scan(&v.ID, &v.Name, &v.Description, &v.IsActive)
	return
}
func missing(err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return apperror.New(404, "not_found", "Không tìm thấy bản ghi.")
	}
	return err
}
func conflict() error {
	return apperror.New(409, "conflict", "Bản ghi trùng hoặc còn tham chiếu đang hoạt động.")
}
func writeError(err error) error {
	var p *pgconn.PgError
	if errors.As(err, &p) {
		switch p.Code {
		case "23505", "23503":
			return conflict()
		case "23514", "22003":
			return invalid("body")
		}
	}
	return err
}
func audit(ctx context.Context, tx *sql.Tx, actor, request, action, entity, id string, before, after any) error {
	details, err := json.Marshal(map[string]any{"before": before, "after": after})
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,details,request_id) VALUES($1,$2,$3,$4,$5,$6)`, actor, action, entity, id, string(details), request)
	return err
}
func (r *SQLRepository) ListSports(ctx context.Context) ([]sport.SportType, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id::text,name,description,is_active FROM sport_types ORDER BY name,id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]sport.SportType, 0)
	for rows.Next() {
		v, err := scanSport(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
func (r *SQLRepository) ListCourts(ctx context.Context, page, size int) ([]court.Court, int64, error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true, Isolation: sql.LevelRepeatableRead})
	if err != nil {
		return nil, 0, err
	}
	defer tx.Rollback()
	var total int64
	if err = tx.QueryRowContext(ctx, `SELECT count(*) FROM courts`).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := tx.QueryContext(ctx, `SELECT `+courtColumns+` FROM courts ORDER BY code,id LIMIT $1 OFFSET $2`, size, int64(page-1)*int64(size))
	if err != nil {
		return nil, 0, err
	}
	out := make([]court.Court, 0)
	for rows.Next() {
		v, e := scanCourt(rows)
		if e != nil {
			rows.Close()
			return nil, 0, e
		}
		out = append(out, v)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, 0, err
	}
	return out, total, tx.Commit()
}
func activeSport(ctx context.Context, tx *sql.Tx, id string) error {
	var active bool
	err := tx.QueryRowContext(ctx, `SELECT is_active FROM sport_types WHERE id=$1 FOR SHARE`, id).Scan(&active)
	if errors.Is(err, sql.ErrNoRows) || err == nil && !active {
		return conflict()
	}
	return err
}
func checkNoActiveCourts(ctx context.Context, tx *sql.Tx, id string) error {
	var exists bool
	err := tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM courts WHERE sport_type_id=$1 AND is_active)`, id).Scan(&exists)
	if err == nil && exists {
		return conflict()
	}
	return err
}

func (r *SQLRepository) SaveSport(ctx context.Context, id, actor, request string, f Fields) (value sport.SportType, err error) {
	defer func() { err = writeError(err) }()
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return value, err
	}
	defer tx.Rollback()
	before := sport.SportType{IsActive: true}
	action := "CREATE"
	if id != "" {
		before, err = scanSport(tx.QueryRowContext(ctx, `SELECT id::text,name,description,is_active FROM sport_types WHERE id=$1 FOR UPDATE`, id))
		if err != nil {
			return value, missing(err)
		}
		action = "UPDATE"
	}
	value = before
	raw, _ := json.Marshal(f)
	if err = json.Unmarshal(raw, &value); err != nil {
		return value, err
	}
	if id != "" && !value.IsActive {
		if err = checkNoActiveCourts(ctx, tx, id); err != nil {
			return value, err
		}
	}
	if id == "" {
		value, err = scanSport(tx.QueryRowContext(ctx, `INSERT INTO sport_types(name,description,is_active) VALUES($1,$2,$3) RETURNING id::text,name,description,is_active`, value.Name, value.Description, value.IsActive))
	} else {
		value, err = scanSport(tx.QueryRowContext(ctx, `UPDATE sport_types SET name=$2,description=$3,is_active=$4 WHERE id=$1 RETURNING id::text,name,description,is_active`, id, value.Name, value.Description, value.IsActive))
	}
	if err != nil {
		return value, err
	}
	if err = audit(ctx, tx, actor, request, action, "SportType", value.ID, before, value); err != nil {
		return value, err
	}
	return value, tx.Commit()
}
func (r *SQLRepository) SaveCourt(ctx context.Context, id, actor, request string, f Fields) (value court.Court, err error) {
	defer func() { err = writeError(err) }()
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return value, err
	}
	defer tx.Rollback()
	before := court.Court{IsActive: true, SlotDurationMinutes: 60, MinConsecutiveSlots: 1, MaxConsecutiveSlots: 4}
	action := "CREATE"
	if id != "" {
		before, err = scanCourt(tx.QueryRowContext(ctx, `SELECT `+courtColumns+` FROM courts WHERE id=$1 FOR UPDATE`, id))
		if err != nil {
			return value, missing(err)
		}
		action = "UPDATE"
	}
	value, err = mergeCourt(before, f)
	if err != nil {
		return value, err
	}
	if id == "" || value.IsActive || value.SportTypeID != before.SportTypeID {
		if err = activeSport(ctx, tx, value.SportTypeID); err != nil {
			return value, err
		}
	}
	args := []any{value.SportTypeID, value.Code, value.Name, value.Description, value.IsActive, value.SlotDurationMinutes, value.MinConsecutiveSlots, value.MaxConsecutiveSlots, value.ReferencePriceAmount, value.ReferencePriceCurrency}
	if id == "" {
		value, err = scanCourt(tx.QueryRowContext(ctx, `INSERT INTO courts(sport_type_id,code,name,description,is_active,slot_duration_minutes,min_consecutive_slots,max_consecutive_slots,reference_price_amount,reference_price_currency) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING `+courtColumns, args...))
	} else {
		args = append(args, id)
		value, err = scanCourt(tx.QueryRowContext(ctx, `UPDATE courts SET sport_type_id=$1,code=$2,name=$3,description=$4,is_active=$5,slot_duration_minutes=$6,min_consecutive_slots=$7,max_consecutive_slots=$8,reference_price_amount=$9,reference_price_currency=$10 WHERE id=$11 RETURNING `+courtColumns, args...))
	}
	if err != nil {
		return value, err
	}
	if id != "" && (value.SlotDurationMinutes != before.SlotDurationMinutes || value.MinConsecutiveSlots != before.MinConsecutiveSlots || value.MaxConsecutiveSlots != before.MaxConsecutiveSlots) {
		if err = schedule.RegenerateSlots(ctx, tx, value.ID, value.SlotDurationMinutes); err != nil {
			return value, err
		}
	}
	if err = audit(ctx, tx, actor, request, action, "Court", value.ID, before, value); err != nil {
		return value, err
	}
	return value, tx.Commit()
}
func (r *SQLRepository) Delete(ctx context.Context, isCourt bool, id, actor, request string) (err error) {
	defer func() { err = writeError(err) }()
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	table, entity := "sport_types", "SportType"
	if isCourt {
		table, entity = "courts", "Court"
	}
	var active bool
	if err = tx.QueryRowContext(ctx, `SELECT is_active FROM `+table+` WHERE id=$1 FOR UPDATE`, id).Scan(&active); err != nil {
		return missing(err)
	}
	if !active {
		return tx.Commit()
	}
	if !isCourt {
		if err = checkNoActiveCourts(ctx, tx, id); err != nil {
			return err
		}
	}
	if _, err = tx.ExecContext(ctx, `UPDATE `+table+` SET is_active=false WHERE id=$1`, id); err != nil {
		return err
	}
	if err = audit(ctx, tx, actor, request, "DEACTIVATE", entity, id, map[string]bool{"isActive": true}, map[string]bool{"isActive": false}); err != nil {
		return err
	}
	return tx.Commit()
}
