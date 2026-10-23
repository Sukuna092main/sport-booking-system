package court

import (
	"context"
	"database/sql"
	"errors"
)

var ErrNotFound = errors.New("court not found")

type Filter struct {
	Search      string
	SportTypeID *string
	Page        int
	PageSize    int
}
type Repository interface {
	List(context.Context, Filter) ([]Court, int64, error)
	ActiveByID(context.Context, string) (Court, error)
}
type SQLRepository struct{ db *sql.DB }

func NewRepository(db *sql.DB) *SQLRepository { return &SQLRepository{db: db} }

const selectColumns = `c.id::text,c.sport_type_id::text,c.code,c.name,c.description,c.is_active,c.slot_duration_minutes,c.min_consecutive_slots,c.max_consecutive_slots,c.reference_price_amount::text,c.reference_price_currency`
const activeFrom = ` FROM courts c JOIN sport_types s ON s.id=c.sport_type_id WHERE c.is_active AND s.is_active`
const filters = ` AND ($1='' OR position(lower($1) in lower(c.name))>0 OR position(lower($1) in lower(c.code))>0) AND ($2::uuid IS NULL OR c.sport_type_id=$2::uuid)`

type scanner interface{ Scan(...any) error }

func scanCourt(row scanner) (Court, error) {
	var c Court
	err := row.Scan(&c.ID, &c.SportTypeID, &c.Code, &c.Name, &c.Description, &c.IsActive, &c.SlotDurationMinutes, &c.MinConsecutiveSlots, &c.MaxConsecutiveSlots, &c.ReferencePriceAmount, &c.ReferencePriceCurrency)
	if errors.Is(err, sql.ErrNoRows) {
		return Court{}, ErrNotFound
	}
	return c, err
}

func (r *SQLRepository) ActiveByID(ctx context.Context, id string) (Court, error) {
	return scanCourt(r.db.QueryRowContext(ctx, "SELECT "+selectColumns+activeFrom+" AND c.id=$1", id))
}

func (r *SQLRepository) List(ctx context.Context, f Filter) ([]Court, int64, error) {
	// Count and rows describe the same database snapshot.
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return nil, 0, err
	}
	defer tx.Rollback()
	var total int64
	if err = tx.QueryRowContext(ctx, "SELECT count(*)"+activeFrom+filters, f.Search, f.SportTypeID).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := tx.QueryContext(ctx, "SELECT "+selectColumns+activeFrom+filters+" ORDER BY c.code,c.id LIMIT $3 OFFSET $4", f.Search, f.SportTypeID, f.PageSize, int64(f.Page-1)*int64(f.PageSize))
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	courts := make([]Court, 0)
	for rows.Next() {
		c, err := scanCourt(rows)
		if err != nil {
			return nil, 0, err
		}
		courts = append(courts, c)
	}
	if err = rows.Err(); err != nil {
		return nil, 0, err
	}
	rows.Close()
	if err = tx.Commit(); err != nil {
		return nil, 0, err
	}
	return courts, total, nil
}
