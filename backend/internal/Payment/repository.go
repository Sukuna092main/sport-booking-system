package payment

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	notification "github.com/Sukuna092main/sport-booking-system/backend/internal/Notification"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
)

type SQLRepository struct {
	db           *sql.DB
	location     *time.Location
	now          func() time.Time
	emailEnabled bool
}

func NewRepository(db *sql.DB, location *time.Location, now func() time.Time, emailEnabled ...bool) *SQLRepository {
	if now == nil {
		now = time.Now
	}
	if location == nil {
		location = time.FixedZone("ICT", 7*3600)
	}
	var sendEmail bool
	if len(emailEnabled) > 0 {
		sendEmail = emailEnabled[0]
	}
	return &SQLRepository{db: db, location: location, now: now, emailEnabled: sendEmail}
}

func (r *SQLRepository) StartAttempt(ctx context.Context, ownerID, bookingID, provider, orderRef string) (Payment, bool, error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return Payment{}, false, err
	}
	defer tx.Rollback()
	var status, bookingCode string
	var hold time.Time
	var amount int64
	err = tx.QueryRowContext(ctx, `SELECT status,booking_code,hold_expires_at,deposit_amount_vnd FROM bookings WHERE id=$1 AND customer_id=$2 FOR UPDATE`, bookingID, ownerID).Scan(&status, &bookingCode, &hold, &amount)
	if errors.Is(err, sql.ErrNoRows) {
		return Payment{}, false, apperror.New(404, "not_found", "Không tìm thấy booking.")
	}
	if err != nil {
		return Payment{}, false, err
	}
	if status != "PENDING_PAYMENT" || !hold.After(r.now()) {
		return Payment{}, false, apperror.New(409, "payment_window_closed", "Booking không còn trong thời gian chờ thanh toán.")
	}
	value, err := scanPayment(tx.QueryRowContext(ctx, `SELECT id::text,booking_id::text,provider,provider_order_ref,amount_vnd,currency,status,checkout_url,created_at,paid_at
		FROM payments WHERE booking_id=$1 AND status='PENDING' ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, bookingID))
	if err == nil {
		value.BookingCode = bookingCode
		value.HoldExpiresAt = hold
		return value, true, tx.Commit()
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return Payment{}, false, err
	}
	value, err = scanPayment(tx.QueryRowContext(ctx, `INSERT INTO payments(booking_id,provider,provider_order_ref,amount_vnd,status)
		VALUES ($1,$2,$3,$4,'PENDING') RETURNING id::text,booking_id::text,provider,provider_order_ref,amount_vnd,currency,status,checkout_url,created_at,paid_at`, bookingID, provider, orderRef, amount))
	if err != nil {
		return Payment{}, false, err
	}
	value.BookingCode = bookingCode
	value.HoldExpiresAt = hold
	return value, false, tx.Commit()
}

type scanner interface{ Scan(...any) error }

func scanPayment(row scanner) (Payment, error) {
	var value Payment
	var url sql.NullString
	var paid sql.NullTime
	err := row.Scan(&value.ID, &value.BookingID, &value.Provider, &value.ProviderOrderRef, &value.AmountVND, &value.Currency, &value.Status, &url, &value.CreatedAt, &paid)
	if errors.Is(err, sql.ErrNoRows) {
		return Payment{}, sql.ErrNoRows
	}
	if url.Valid {
		value.CheckoutURL = &url.String
	}
	if paid.Valid {
		t := paid.Time.UTC()
		value.PaidAt = &t
	}
	value.CreatedAt = value.CreatedAt.UTC()
	return value, err
}

func (r *SQLRepository) SetCheckoutURL(ctx context.Context, id, value string) error {
	result, err := r.db.ExecContext(ctx, `UPDATE payments SET checkout_url=$2,updated_at=clock_timestamp() WHERE id=$1 AND status='PENDING'`, id, value)
	if err != nil {
		return err
	}
	count, _ := result.RowsAffected()
	if count != 1 {
		return fmt.Errorf("payment attempt was no longer pending")
	}
	return nil
}

func (r *SQLRepository) MockEvent(ctx context.Context, ownerID, orderRef string, success bool) (GatewayEvent, error) {
	var amount int64
	err := r.db.QueryRowContext(ctx, `SELECT p.amount_vnd FROM payments p JOIN bookings b ON b.id=p.booking_id
		WHERE p.provider_order_ref=$1 AND p.provider='mock' AND b.customer_id=$2`, orderRef, ownerID).Scan(&amount)
	if errors.Is(err, sql.ErrNoRows) {
		return GatewayEvent{}, apperror.New(404, "not_found", "Không tìm thấy giao dịch.")
	}
	if err != nil {
		return GatewayEvent{}, err
	}
	if amount > int64(^uint64(0)>>1)/100 {
		return GatewayEvent{}, fmt.Errorf("mock amount overflow")
	}
	event := GatewayEvent{OrderRef: orderRef, AmountMinor: amount * 100, TransactionID: "MOCK-" + orderRef, ResponseCode: "24", TransactionStatus: "02", EventKey: mockEventKey(orderRef, success)}
	if success {
		event.ResponseCode = "00"
		event.TransactionStatus = "00"
	}
	return event, nil
}

func (r *SQLRepository) OwnedStatus(ctx context.Context, ownerID, bookingID string) (PaymentStatus, error) {
	var value PaymentStatus
	var hold sql.NullTime
	err := r.db.QueryRowContext(ctx, `SELECT id::text,status,hold_expires_at,COALESCE(total_amount_vnd,0),COALESCE(deposit_amount_vnd,0),COALESCE(remaining_amount_vnd,0)
		FROM bookings WHERE id=$1 AND customer_id=$2`, bookingID, ownerID).Scan(&value.BookingID, &value.BookingStatus, &hold, &value.TotalAmountVND, &value.DepositAmountVND, &value.RemainingAmountVND)
	if errors.Is(err, sql.ErrNoRows) {
		return value, apperror.New(404, "not_found", "Không tìm thấy booking.")
	}
	if err != nil {
		return value, err
	}
	if hold.Valid {
		t := hold.Time.UTC()
		value.HoldExpiresAt = &t
	}
	paymentValue, err := scanPayment(r.db.QueryRowContext(ctx, `SELECT id::text,booking_id::text,provider,provider_order_ref,amount_vnd,currency,status,checkout_url,created_at,paid_at
		FROM payments WHERE booking_id=$1 ORDER BY created_at DESC LIMIT 1`, bookingID))
	if err == nil {
		value.Payment = &paymentValue
	} else if !errors.Is(err, sql.ErrNoRows) {
		return value, err
	}
	return value, nil
}

func (r *SQLRepository) SetPricing(ctx context.Context, courtID, actorID, requestID string, price int64, active bool) (Pricing, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return Pricing{}, err
	}
	defer tx.Rollback()
	var id string
	err = tx.QueryRowContext(ctx, `SELECT id::text FROM courts WHERE id=$1 FOR UPDATE`, courtID).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return Pricing{}, apperror.New(404, "not_found", "Không tìm thấy sân.")
	}
	if err != nil {
		return Pricing{}, err
	}
	var value Pricing
	err = tx.QueryRowContext(ctx, `INSERT INTO court_pricing(court_id,price_per_slot_vnd,is_active,updated_at) VALUES ($1,$2,$3,clock_timestamp())
		ON CONFLICT (court_id) DO UPDATE SET price_per_slot_vnd=EXCLUDED.price_per_slot_vnd,is_active=EXCLUDED.is_active,updated_at=clock_timestamp()
		RETURNING court_id::text,price_per_slot_vnd,is_active,updated_at`, courtID, price, active).Scan(&value.CourtID, &value.PricePerSlotVND, &value.IsActive, &value.UpdatedAt)
	if err != nil {
		return Pricing{}, err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,details,request_id)
		VALUES ($1,'COURT_PRICING_UPDATED','court',$2,jsonb_build_object('pricePerSlotVnd',$3,'isActive',$4),$5)`, actorID, courtID, price, active, requestID); err != nil {
		return Pricing{}, err
	}
	return value, tx.Commit()
}

func (r *SQLRepository) GetPricing(ctx context.Context, courtID string) (Pricing, error) {
	var value Pricing
	err := r.db.QueryRowContext(ctx, `SELECT court_id::text,price_per_slot_vnd,is_active,updated_at FROM court_pricing WHERE court_id=$1 AND is_active`, courtID).Scan(&value.CourtID, &value.PricePerSlotVND, &value.IsActive, &value.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Pricing{}, apperror.New(404, "pricing_not_configured", "Sân chưa được cấu hình giá thanh toán.")
	}
	return value, err
}

func (r *SQLRepository) ProcessEvent(ctx context.Context, provider string, event GatewayEvent) (WebhookAck, error) {
	if event.EventKey == "" {
		return WebhookAck{RspCode: "99", Message: "System error"}, fmt.Errorf("missing event key")
	}
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return WebhookAck{RspCode: "99", Message: "System error"}, err
	}
	defer tx.Rollback()
	var paymentID, bookingID string
	var amount int64
	var storedProvider, paymentStatus string
	err = tx.QueryRowContext(ctx, `SELECT id::text,booking_id::text,amount_vnd,provider,status FROM payments WHERE provider_order_ref=$1`, event.OrderRef).Scan(&paymentID, &bookingID, &amount, &storedProvider, &paymentStatus)
	if errors.Is(err, sql.ErrNoRows) {
		result, insertErr := tx.ExecContext(ctx, `INSERT INTO payment_webhook_events(provider,event_key,received_at,processed_at,response_code) VALUES ($1,$2,clock_timestamp(),clock_timestamp(),'01') ON CONFLICT (provider,event_key) DO NOTHING`, provider, event.EventKey)
		if insertErr != nil {
			return WebhookAck{RspCode: "99", Message: "System error"}, insertErr
		}
		n, _ := result.RowsAffected()
		if n == 0 {
			return WebhookAck{RspCode: "02", Message: "Request already processed"}, tx.Commit()
		}
		return WebhookAck{RspCode: "01", Message: "Order not found"}, tx.Commit()
	}
	if err != nil {
		return WebhookAck{RspCode: "99", Message: "System error"}, err
	}
	var bookingState string
	var hold sql.NullTime
	err = tx.QueryRowContext(ctx, `SELECT status,hold_expires_at FROM bookings WHERE id=$1 FOR UPDATE`, bookingID).Scan(&bookingState, &hold)
	if err != nil {
		return WebhookAck{RspCode: "99", Message: "System error"}, err
	}
	var current Payment
	current, err = scanPayment(tx.QueryRowContext(ctx, `SELECT id::text,booking_id::text,provider,provider_order_ref,amount_vnd,currency,status,checkout_url,created_at,paid_at FROM payments WHERE id=$1 FOR UPDATE`, paymentID))
	if err != nil {
		return WebhookAck{RspCode: "99", Message: "System error"}, err
	}
	result, err := tx.ExecContext(ctx, `INSERT INTO payment_webhook_events(provider,event_key,payment_id,received_at) VALUES ($1,$2,$3,clock_timestamp()) ON CONFLICT (provider,event_key) DO NOTHING`, provider, event.EventKey, paymentID)
	if err != nil {
		return WebhookAck{RspCode: "99", Message: "System error"}, err
	}
	inserted, _ := result.RowsAffected()
	if inserted == 0 {
		return WebhookAck{RspCode: "02", Message: "Request already processed"}, tx.Commit()
	}
	if provider != storedProvider {
		return finishAck(ctx, tx, provider, event.EventKey, WebhookAck{RspCode: "01", Message: "Order not found"})
	}
	if event.AmountMinor%100 != 0 || event.AmountMinor/100 != amount {
		return finishAck(ctx, tx, provider, event.EventKey, WebhookAck{RspCode: "04", Message: "Invalid amount"})
	}
	if event.ResponseCode == "00" && event.TransactionStatus == "00" {
		if current.Status == "PAID" || current.Status == "PAID_REVIEW" {
			return finishAck(ctx, tx, provider, event.EventKey, WebhookAck{RspCode: "02", Message: "Request already processed"})
		}
		now := r.now().UTC().Truncate(time.Microsecond)
		var activeSlots int
		if err = tx.QueryRowContext(ctx, `SELECT count(*) FROM booking_slots WHERE booking_id=$1 AND released_at IS NULL AND ends_at>$2`, bookingID, now).Scan(&activeSlots); err != nil {
			return WebhookAck{RspCode: "99", Message: "System error"}, err
		}
		if current.Status == "PENDING" && bookingState == "PENDING_PAYMENT" && hold.Valid && hold.Time.After(now) && activeSlots > 0 {
			if _, err = tx.ExecContext(ctx, `UPDATE payments SET status='PAID',provider_transaction_id=NULLIF($2,''),provider_response_code=$3,paid_at=$4,updated_at=$4 WHERE id=$1`, paymentID, event.TransactionID, event.ResponseCode, now); err != nil {
				return WebhookAck{RspCode: "99", Message: "System error"}, err
			}
			if _, err = tx.ExecContext(ctx, `UPDATE bookings SET status='CONFIRMED',hold_expires_at=NULL WHERE id=$1 AND status='PENDING_PAYMENT'`, bookingID); err != nil {
				return WebhookAck{RspCode: "99", Message: "System error"}, err
			}
			if r.emailEnabled {
				if err = notification.QueueBookingMail(ctx, tx, bookingID, "BOOKING_CONFIRMED", now, r.location); err != nil {
					return WebhookAck{RspCode: "99", Message: "System error"}, err
				}
				firstStart := now
				if err = tx.QueryRowContext(ctx, `SELECT min(starts_at) FROM booking_slots WHERE booking_id=$1`, bookingID).Scan(&firstStart); err != nil {
					return WebhookAck{RspCode: "99", Message: "System error"}, err
				}
				remindAt := firstStart.Add(-24 * time.Hour)
				if remindAt.After(now.Add(time.Minute)) {
					if err = notification.QueueBookingMail(ctx, tx, bookingID, "BOOKING_REMINDER_24H", remindAt, r.location); err != nil {
						return WebhookAck{RspCode: "99", Message: "System error"}, err
					}
				}
			}
		} else {
			if _, err = tx.ExecContext(ctx, `UPDATE payments SET status='PAID_REVIEW',provider_transaction_id=NULLIF($2,''),provider_response_code=$3,paid_at=$4,updated_at=$4 WHERE id=$1`, paymentID, event.TransactionID, event.ResponseCode, now); err != nil {
				return WebhookAck{RspCode: "99", Message: "System error"}, err
			}
			if bookingState == "PENDING_PAYMENT" {
				if _, err = tx.ExecContext(ctx, `UPDATE bookings SET status='EXPIRED',expired_at=$2,hold_expires_at=NULL WHERE id=$1 AND status='PENDING_PAYMENT'`, bookingID, now); err != nil {
					return WebhookAck{RspCode: "99", Message: "System error"}, err
				}
				if _, err = tx.ExecContext(ctx, `UPDATE booking_slots SET released_at=$2 WHERE booking_id=$1 AND released_at IS NULL`, bookingID, now); err != nil {
					return WebhookAck{RspCode: "99", Message: "System error"}, err
				}
			}
		}
	} else if (event.ResponseCode == "07" || event.TransactionStatus == "07") && current.Status == "PENDING" {
		if _, err = tx.ExecContext(ctx, `UPDATE payments SET status='PAID_REVIEW',provider_transaction_id=NULLIF($2,''),provider_response_code=$3,paid_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=$1`, paymentID, event.TransactionID, event.ResponseCode); err != nil {
			return WebhookAck{RspCode: "99", Message: "System error"}, err
		}
	} else if current.Status == "PENDING" {
		if _, err = tx.ExecContext(ctx, `UPDATE payments SET status='FAILED',provider_transaction_id=NULLIF($2,''),provider_response_code=$3,updated_at=clock_timestamp() WHERE id=$1`, paymentID, event.TransactionID, event.ResponseCode); err != nil {
			return WebhookAck{RspCode: "99", Message: "System error"}, err
		}
	}
	return finishAck(ctx, tx, provider, event.EventKey, WebhookAck{RspCode: "00", Message: "Confirm Success"})
}

func finishAck(ctx context.Context, tx *sql.Tx, provider, eventKey string, ack WebhookAck) (WebhookAck, error) {
	_, err := tx.ExecContext(ctx, `UPDATE payment_webhook_events SET processed_at=clock_timestamp(),response_code=$3 WHERE provider=$1 AND event_key=$2`, provider, eventKey, ack.RspCode)
	if err != nil {
		return WebhookAck{RspCode: "99", Message: "System error"}, err
	}
	return ack, tx.Commit()
}

func (r *SQLRepository) ExpireHolds(ctx context.Context, limit int) (int, error) {
	if limit < 1 || limit > 1000 {
		limit = 100
	}
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	rows, err := tx.QueryContext(ctx, `SELECT id::text FROM bookings WHERE status='PENDING_PAYMENT' AND hold_expires_at<=clock_timestamp()
		ORDER BY hold_expires_at,id FOR UPDATE SKIP LOCKED LIMIT $1`, limit)
	if err != nil {
		return 0, err
	}
	ids := make([]string, 0)
	for rows.Next() {
		var id string
		if err = rows.Scan(&id); err != nil {
			rows.Close()
			return 0, err
		}
		ids = append(ids, id)
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return 0, err
	}
	rows.Close()
	for _, id := range ids {
		now := r.now().UTC().Truncate(time.Microsecond)
		if _, err = tx.ExecContext(ctx, `UPDATE bookings SET status='EXPIRED',expired_at=$2,hold_expires_at=NULL WHERE id=$1 AND status='PENDING_PAYMENT'`, id, now); err != nil {
			return 0, err
		}
		if _, err = tx.ExecContext(ctx, `UPDATE booking_slots SET released_at=$2 WHERE booking_id=$1 AND released_at IS NULL`, id, now); err != nil {
			return 0, err
		}
		if _, err = tx.ExecContext(ctx, `UPDATE payments SET status='EXPIRED',updated_at=$2 WHERE booking_id=$1 AND status='PENDING'`, id, now); err != nil {
			return 0, err
		}
		if _, err = tx.ExecContext(ctx, `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,details,occurred_at)
			VALUES (NULL,'BOOKING_EXPIRED','booking',$1,jsonb_build_object('status','EXPIRED'),$2)`, id, now); err != nil {
			return 0, err
		}
	}
	return len(ids), tx.Commit()
}
