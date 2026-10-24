package booking

import (
	"context"
	"crypto/subtle"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	availability "github.com/Sukuna092main/sport-booking-system/backend/internal/Availability"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
)

type SQLRepository struct {
	db       *sql.DB
	location *time.Location
	now      func() time.Time
}

func NewRepository(db *sql.DB, location *time.Location, now func() time.Time) *SQLRepository {
	return &SQLRepository{db: db, location: location, now: now}
}

// Every booking writer acquires customer -> court -> booking locks, in that
// order. ReadCommitted sees commits made by a request we waited for. The
// customer lock serializes idempotency and the cross-court active-booking cap.
func lockCustomer(ctx context.Context, tx *sql.Tx, id string) error {
	var status, role string
	err := tx.QueryRowContext(ctx, `SELECT status,role FROM users WHERE id=$1 FOR UPDATE`, id).Scan(&status, &role)
	if errors.Is(err, sql.ErrNoRows) {
		return apperror.New(401, "unauthorized", "Cần đăng nhập.")
	}
	if err != nil {
		return err
	}
	if status != "ACTIVE" {
		return apperror.New(403, "account_inactive", "Tài khoản không hoạt động.")
	}
	if role != "USER" && role != "ADMIN" {
		return apperror.New(403, "forbidden", "Không đủ quyền truy cập.")
	}
	return nil
}

func (r *SQLRepository) Create(ctx context.Context, cmd CreateCommand) (value Booking, replay bool, err error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return Booking{}, false, err
	}
	defer tx.Rollback()
	// Map only known database conflicts; internal SQL never reaches the client.
	defer func() { err = writeError(err) }()
	if err = lockCustomer(ctx, tx, cmd.CustomerID); err != nil {
		return Booking{}, false, err
	}
	var id string
	var storedHash []byte
	err = tx.QueryRowContext(ctx, `SELECT id::text,request_hash FROM bookings WHERE customer_id=$1 AND idempotency_key=$2`, cmd.CustomerID, cmd.Key).Scan(&id, &storedHash)
	if err == nil {
		if subtle.ConstantTimeCompare(storedHash, cmd.Hash[:]) != 1 {
			return Booking{}, false, apperror.New(409, "idempotency_conflict", "Khóa đã được dùng cho một yêu cầu khác.")
		}
		value, err = loadOwned(ctx, tx, cmd.CustomerID, id)
		if err != nil {
			return Booking{}, false, err
		}
		// Replay precedes horizon, active-cap, court and selection revalidation.
		// The original result remains replayable after cancellation/config changes.
		return value, true, tx.Commit()
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return Booking{}, false, err
	}
	var sportID string
	var active bool
	var minSlots, maxSlots int
	err = tx.QueryRowContext(ctx, `SELECT sport_type_id::text,is_active,min_consecutive_slots,max_consecutive_slots FROM courts WHERE id=$1 FOR UPDATE`, cmd.Request.CourtID).Scan(&sportID, &active, &minSlots, &maxSlots)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && !active) {
		return Booking{}, false, ruleViolation("Sân không tồn tại hoặc đã ngừng hoạt động.")
	}
	if err != nil {
		return Booking{}, false, err
	}
	if err = tx.QueryRowContext(ctx, `SELECT is_active FROM sport_types WHERE id=$1 FOR SHARE`, sportID).Scan(&active); err != nil {
		return Booking{}, false, err
	}
	if !active {
		return Booking{}, false, ruleViolation("Loại thể thao đã ngừng hoạt động.")
	}
	// Evaluate the clock after lock waits, so a queued request cannot book a
	// slot that started while it was waiting for another transaction.
	// PostgreSQL timestamptz stores microseconds. Return the persisted precision
	// on the first response too, so a retry is byte-stable for timestamps.
	now := r.now().UTC().Truncate(time.Microsecond)
	day, err := parseDay(cmd.Request.BookingDate)
	if err != nil {
		return Booking{}, false, err
	}
	if err = validateHorizon(day, now, r.location); err != nil {
		return Booking{}, false, err
	}
	var count int
	err = tx.QueryRowContext(ctx, `SELECT count(*) FROM bookings b WHERE customer_id=$1 AND status='CONFIRMED'
		AND EXISTS (SELECT 1 FROM booking_slots bs WHERE bs.booking_id=b.id AND bs.released_at IS NULL AND bs.ends_at>$2)`, cmd.CustomerID, now).Scan(&count)
	if err != nil {
		return Booking{}, false, err
	}
	if count >= 3 {
		return Booking{}, false, ruleViolation("Mỗi người dùng chỉ được có tối đa 3 booking đang hiệu lực.")
	}
	weekday := int(day.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	snapshot, err := availability.ReadSnapshot(ctx, tx, cmd.Request.CourtID, weekday, day.Add(-24*time.Hour), day.Add(48*time.Hour))
	if err != nil {
		return Booking{}, false, err
	}
	slots, err := validateSelection(cmd.Request.TimeSlotIDs, availability.DatedSlots(snapshot, day, r.location, now), minSlots, maxSlots, now)
	if err != nil {
		return Booking{}, false, err
	}
	if err = tx.QueryRowContext(ctx, `SELECT gen_random_uuid()::text`).Scan(&id); err != nil {
		return Booking{}, false, err
	}
	value = Booking{ID: id, BookingCode: "SB-" + strings.ToUpper(strings.ReplaceAll(id, "-", "")), CustomerID: cmd.CustomerID, CourtID: cmd.Request.CourtID, BookingDate: cmd.Request.BookingDate, Status: "CONFIRMED", Slots: slots, CreatedAt: now}
	_, err = tx.ExecContext(ctx, `INSERT INTO bookings (id,customer_id,court_id,booking_code,booking_date,idempotency_key,request_hash,created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, id, value.CustomerID, value.CourtID, value.BookingCode, value.BookingDate, cmd.Key, cmd.Hash[:], now)
	if err != nil {
		return Booking{}, false, err
	}
	for _, slot := range slots {
		_, err = tx.ExecContext(ctx, `INSERT INTO booking_slots (booking_id,time_slot_id,court_id,booking_date,weekday,starts_at,ends_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7)`, id, slot.TimeSlotID, value.CourtID, value.BookingDate, weekday, slot.StartsAt, slot.EndsAt)
		if err != nil {
			return Booking{}, false, err
		}
	}
	if err = audit(ctx, tx, value.CustomerID, id, "BOOKING_CREATED", cmd.RequestID, `{"status":"CONFIRMED"}`, now); err != nil {
		return Booking{}, false, err
	}
	return value, false, tx.Commit()
}

const bookingColumns = `b.id::text,b.booking_code,b.customer_id::text,b.court_id::text,b.booking_date::text,b.status,b.created_at,b.cancelled_at`

// Query booking parents before joining slots: LIMIT must paginate bookings,
// not individual slots. Read all snapshots, including released/inactive ones.
func readBookings(ctx context.Context, tx *sql.Tx, parents string, args ...any) ([]Booking, error) {
	rows, err := tx.QueryContext(ctx, `SELECT `+bookingColumns+`,bs.time_slot_id::text,bs.starts_at,bs.ends_at
		FROM (`+parents+`) b LEFT JOIN booking_slots bs ON bs.booking_id=b.id
		ORDER BY b.created_at DESC,b.id DESC,bs.starts_at,bs.time_slot_id`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]Booking, 0)
	positions := make(map[string]int)
	for rows.Next() {
		var b Booking
		var slotID *string
		var start, end *time.Time
		if err = rows.Scan(&b.ID, &b.BookingCode, &b.CustomerID, &b.CourtID, &b.BookingDate, &b.Status, &b.CreatedAt, &b.CancelledAt, &slotID, &start, &end); err != nil {
			return nil, err
		}
		if slotID == nil || start == nil || end == nil {
			return nil, fmt.Errorf("booking has no slot snapshots")
		}
		index, ok := positions[b.ID]
		if !ok {
			index = len(result)
			positions[b.ID] = index
			b.CreatedAt = b.CreatedAt.UTC()
			if b.CancelledAt != nil {
				utc := b.CancelledAt.UTC()
				b.CancelledAt = &utc
			}
			b.Slots = make([]Slot, 0)
			result = append(result, b)
		}
		result[index].Slots = append(result[index].Slots, Slot{TimeSlotID: *slotID, StartsAt: start.UTC(), EndsAt: end.UTC()})
	}
	return result, rows.Err()
}

func loadOwned(ctx context.Context, tx *sql.Tx, customerID, id string) (Booking, error) {
	values, err := readBookings(ctx, tx, `SELECT * FROM bookings WHERE customer_id=$1 AND id=$2`, customerID, id)
	if err != nil {
		return Booking{}, err
	}
	if len(values) == 0 {
		return Booking{}, notFound()
	}
	return values[0], nil
}

func (r *SQLRepository) ByID(ctx context.Context, customerID, id string) (Booking, error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return Booking{}, err
	}
	defer tx.Rollback()
	value, err := loadOwned(ctx, tx, customerID, id)
	if err != nil {
		return Booking{}, err
	}
	return value, tx.Commit()
}

func (r *SQLRepository) List(ctx context.Context, customerID string, f Filter) ([]Booking, int64, error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return nil, 0, err
	}
	defer tx.Rollback()
	const predicate = ` FROM bookings WHERE customer_id=$1 AND ($2='' OR status=$2)`
	var total int64
	if err = tx.QueryRowContext(ctx, `SELECT count(*)`+predicate, customerID, f.Status).Scan(&total); err != nil {
		return nil, 0, err
	}
	values, err := readBookings(ctx, tx, `SELECT *`+predicate+` ORDER BY created_at DESC,id DESC LIMIT $3 OFFSET $4`, customerID, f.Status, f.PageSize, int64(f.Page-1)*int64(f.PageSize))
	if err != nil {
		return nil, 0, err
	}
	return values, total, tx.Commit()
}

func (r *SQLRepository) Cancel(ctx context.Context, customerID, id, requestID string) (value Booking, err error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return Booking{}, err
	}
	defer tx.Rollback()
	defer func() { err = writeError(err) }()
	if err = lockCustomer(ctx, tx, customerID); err != nil {
		return Booking{}, err
	}
	var courtID, status string
	err = tx.QueryRowContext(ctx, `SELECT court_id::text FROM bookings WHERE customer_id=$1 AND id=$2`, customerID, id).Scan(&courtID)
	if errors.Is(err, sql.ErrNoRows) {
		return Booking{}, notFound()
	}
	if err != nil {
		return Booking{}, err
	}
	// Cancellation still works if the court/sport/template is inactive.
	if err = tx.QueryRowContext(ctx, `SELECT id::text FROM courts WHERE id=$1 FOR UPDATE`, courtID).Scan(&courtID); err != nil {
		return Booking{}, err
	}
	err = tx.QueryRowContext(ctx, `SELECT status FROM bookings WHERE customer_id=$1 AND id=$2 FOR UPDATE`, customerID, id).Scan(&status)
	if err != nil {
		return Booking{}, err
	}
	if status == "CANCELLED" {
		return Booking{}, apperror.New(409, "already_cancelled", "Booking đã được hủy.")
	}
	value, err = loadOwned(ctx, tx, customerID, id)
	if err != nil {
		return Booking{}, err
	}
	value, err = r.cancelLocked(ctx, tx, value, customerID, requestID, nil)
	if err != nil {
		return Booking{}, err
	}
	return value, tx.Commit()
}

func audit(ctx context.Context, tx *sql.Tx, actorID, bookingID, action, requestID, details string, now time.Time) error {
	_, err := tx.ExecContext(ctx, `INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_id,details,request_id,occurred_at)
		VALUES ($1,$2,'booking',$3,$4::jsonb,$5,$6)`, actorID, action, bookingID, details, requestID, now)
	return err
}

func writeError(err error) error {
	var pg *pgconn.PgError
	if errors.As(err, &pg) {
		if (pg.Code == "23505" && pg.ConstraintName == "bslots_active_slot_date_uk") || (pg.Code == "23P01" && pg.ConstraintName == "bslots_no_active_overlap") {
			return apperror.New(409, "slot_unavailable", "Slot đã có người đặt. Vui lòng tải lại lịch.")
		}
		if pg.Code == "40P01" || pg.Code == "40001" {
			return apperror.New(503, "retryable_transaction", "Giao dịch bị tranh chấp. Vui lòng gửi lại với cùng Idempotency-Key nếu đang tạo booking.")
		}
	}
	return err
}
