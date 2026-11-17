package notification

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"html/template"
	"strings"
	"time"
)

type BookingEmailData struct {
	BookingID          string `json:"bookingId"`
	BookingCode        string `json:"bookingCode"`
	CustomerName       string `json:"customerName"`
	CourtName          string `json:"courtName"`
	BookingDate        string `json:"bookingDate"`
	StartTime          string `json:"startTime"`
	EndTime            string `json:"endTime"`
	TotalAmountVND     int64  `json:"totalAmountVnd"`
	DepositAmountVND   int64  `json:"depositAmountVnd"`
	RemainingAmountVND int64  `json:"remainingAmountVnd"`
}

func QueueBookingMail(ctx context.Context, tx *sql.Tx, bookingID, eventType string, scheduledAt time.Time, location *time.Location) error {
	var data BookingEmailData
	var recipient string
	var start, end time.Time
	err := tx.QueryRowContext(ctx, `SELECT b.id::text,b.booking_code,u.email,u.full_name,c.name,b.booking_date::text,
		min(bs.starts_at),max(bs.ends_at),COALESCE(b.total_amount_vnd,0),COALESCE(b.deposit_amount_vnd,0),COALESCE(b.remaining_amount_vnd,0)
		FROM bookings b JOIN users u ON u.id=b.customer_id JOIN courts c ON c.id=b.court_id JOIN booking_slots bs ON bs.booking_id=b.id
		WHERE b.id=$1 GROUP BY b.id,u.email,u.full_name,c.name`, bookingID).Scan(&data.BookingID, &data.BookingCode, &recipient, &data.CustomerName, &data.CourtName, &data.BookingDate, &start, &end, &data.TotalAmountVND, &data.DepositAmountVND, &data.RemainingAmountVND)
	if err != nil {
		return err
	}
	data.StartTime, data.EndTime = start.In(location).Format("15:04"), end.In(location).Format("15:04")
	encoded, err := json.Marshal(data)
	if err != nil {
		return err
	}
	dedupe := fmt.Sprintf("%s:%s", eventType, bookingID)
	_, err = tx.ExecContext(ctx, `INSERT INTO email_outbox(dedupe_key,event_type,recipient_email,payload,scheduled_at)
		VALUES ($1,$2,$3,$4::jsonb,$5) ON CONFLICT (dedupe_key) DO NOTHING`, dedupe, eventType, recipient, string(encoded), scheduledAt.UTC())
	return err
}

type outboxMessage struct {
	ID, EventType, Recipient string
	Payload                  []byte
	EncryptedPayload         []byte
	Attempts, MaxAttempts    int
}
type Worker struct {
	db        *sql.DB
	sender    EmailSender
	encryptor *Encryptor
	now       func() time.Time
}

func NewWorker(db *sql.DB, sender EmailSender, encryptor ...*Encryptor) *Worker {
	worker := &Worker{db: db, sender: sender, now: time.Now}
	if len(encryptor) > 0 {
		worker.encryptor = encryptor[0]
	}
	return worker
}

func (w *Worker) ProcessOne(ctx context.Context) (bool, error) {
	if w.sender == nil {
		return false, fmt.Errorf("email sender is not configured")
	}
	tx, err := w.db.BeginTx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer tx.Rollback()
	var item outboxMessage
	err = tx.QueryRowContext(ctx, `WITH candidate AS (
		SELECT id FROM email_outbox
		WHERE ((status IN ('PENDING','FAILED') AND scheduled_at<=clock_timestamp() AND attempts<max_attempts)
			OR (status='PROCESSING' AND lease_until<=clock_timestamp()))
		ORDER BY scheduled_at,created_at,id FOR UPDATE SKIP LOCKED LIMIT 1
	)
	UPDATE email_outbox e SET status='PROCESSING',attempts=e.attempts+1,lease_until=clock_timestamp()+interval '5 minutes'
	FROM candidate c WHERE e.id=c.id
		RETURNING e.id::text,e.event_type,e.recipient_email,e.payload,e.payload_encrypted,e.attempts,e.max_attempts`).Scan(&item.ID, &item.EventType, &item.Recipient, &item.Payload, &item.EncryptedPayload, &item.Attempts, &item.MaxAttempts)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if err = tx.Commit(); err != nil {
		return false, err
	}
	if item.EncryptedPayload != nil {
		if w.encryptor == nil {
			return true, w.fail(ctx, item, fmt.Errorf("email decryption key is not configured"))
		}
		item.Payload, err = w.encryptor.Decrypt(item.EncryptedPayload)
		if err != nil {
			return true, w.fail(ctx, item, err)
		}
	}
	if item.EventType == "PASSWORD_RESET" {
		var message EmailMessage
		if err = json.Unmarshal(item.Payload, &message); err != nil {
			return true, w.fail(ctx, item, err)
		}
		message.To = item.Recipient
		if err = w.sender.Send(ctx, message); err != nil {
			return true, w.fail(ctx, item, err)
		}
		_, err = w.db.ExecContext(ctx, `UPDATE email_outbox SET status='SENT',sent_at=clock_timestamp(),lease_until=NULL,last_error=NULL WHERE id=$1`, item.ID)
		return true, err
	}

	if item.EventType == "BOOKING_REMINDER_24H" {
		var payload BookingEmailData
		if err = json.Unmarshal(item.Payload, &payload); err != nil {
			return true, w.fail(ctx, item, err)
		}
		var confirmed bool
		if err = w.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM bookings WHERE id=$1 AND status='CONFIRMED')`, payload.BookingID).Scan(&confirmed); err != nil {
			return true, w.fail(ctx, item, err)
		}
		if !confirmed {
			_, err = w.db.ExecContext(ctx, `UPDATE email_outbox SET status='CANCELLED',lease_until=NULL WHERE id=$1`, item.ID)
			return true, err
		}
	}
	var data BookingEmailData
	if err = json.Unmarshal(item.Payload, &data); err != nil {
		return true, w.fail(ctx, item, err)
	}
	message, err := renderBookingMessage(item.EventType, data)
	if err != nil {
		return true, w.fail(ctx, item, err)
	}
	message.To = item.Recipient
	if err = w.sender.Send(ctx, message); err != nil {
		return true, w.fail(ctx, item, err)
	}
	_, err = w.db.ExecContext(ctx, `UPDATE email_outbox SET status='SENT',sent_at=clock_timestamp(),lease_until=NULL,last_error=NULL WHERE id=$1`, item.ID)
	return true, err
}

func (w *Worker) fail(ctx context.Context, item outboxMessage, cause error) error {
	message := strings.ReplaceAll(cause.Error(), "\n", " ")
	if len(message) > 500 {
		message = message[:500]
	}
	delay := time.Duration(30*(1<<min(item.Attempts-1, 6))) * time.Second
	status := "PENDING"
	if item.Attempts >= item.MaxAttempts {
		status = "FAILED"
	}
	_, err := w.db.ExecContext(ctx, `UPDATE email_outbox SET status=$2,lease_until=NULL,last_error=$3,scheduled_at=$4 WHERE id=$1`, item.ID, status, message, w.now().Add(delay))
	return err
}

func renderBookingMessage(event string, data BookingEmailData) (EmailMessage, error) {
	var subject, heading, paragraph string
	switch event {
	case "BOOKING_CONFIRMED":
		subject = "Đặt sân đã được xác nhận – " + data.BookingCode
		heading = "Đặt sân thành công"
		paragraph = "Thanh toán đặt cọc của bạn đã được xác nhận."
	case "BOOKING_CANCELLED":
		subject = "Thông báo hủy đặt sân – " + data.BookingCode
		heading = "Booking đã được hủy"
		paragraph = "Đơn đặt sân đã được hủy. Nếu đã thanh toán, giao dịch cần được bộ phận quản trị đối soát theo chính sách hoàn tiền của sân."
	case "BOOKING_REMINDER_24H":
		subject = "Nhắc lịch đặt sân – " + data.BookingCode
		heading = "Lịch chơi của bạn sắp bắt đầu"
		paragraph = "Đây là lời nhắc về lịch đặt sân đã được xác nhận."
	default:
		return EmailMessage{}, fmt.Errorf("unsupported notification event")
	}
	tmpl, err := template.New("booking").Parse(`<p>Xin chào {{.CustomerName}},</p><h2>{{.Heading}}</h2><p>{{.Paragraph}}</p><dl><dt>Mã booking</dt><dd>{{.BookingCode}}</dd><dt>Sân</dt><dd>{{.CourtName}}</dd><dt>Ngày</dt><dd>{{.BookingDate}}</dd><dt>Giờ</dt><dd>{{.StartTime}} – {{.EndTime}}</dd><dt>Tổng tiền</dt><dd>{{.TotalAmountVND}} VND</dd><dt>Đã cọc</dt><dd>{{.DepositAmountVND}} VND</dd><dt>Còn lại</dt><dd>{{.RemainingAmountVND}} VND</dd></dl><p>Sport Booking System</p>`)
	if err != nil {
		return EmailMessage{}, err
	}
	var html strings.Builder
	if err = tmpl.Execute(&html, map[string]any{"CustomerName": data.CustomerName, "Heading": heading, "Paragraph": paragraph, "BookingCode": data.BookingCode, "CourtName": data.CourtName, "BookingDate": data.BookingDate, "StartTime": data.StartTime, "EndTime": data.EndTime, "TotalAmountVND": data.TotalAmountVND, "DepositAmountVND": data.DepositAmountVND, "RemainingAmountVND": data.RemainingAmountVND}); err != nil {
		return EmailMessage{}, err
	}
	plain := fmt.Sprintf("Xin chào %s,\n%s\n%s\nMã booking: %s\nSân: %s\nNgày: %s\nGiờ: %s–%s\nTổng tiền: %d VND; đã cọc: %d VND; còn lại: %d VND.\nSport Booking System", data.CustomerName, heading, paragraph, data.BookingCode, data.CourtName, data.BookingDate, data.StartTime, data.EndTime, data.TotalAmountVND, data.DepositAmountVND, data.RemainingAmountVND)
	return EmailMessage{Subject: subject, TextBody: plain, HTMLBody: html.String()}, nil
}

func (w *Worker) Run(ctx context.Context, poll time.Duration) error {
	if poll <= 0 {
		poll = 30 * time.Second
	}
	ticker := time.NewTicker(poll)
	defer ticker.Stop()
	for {
		processed, err := w.ProcessOne(ctx)
		if err != nil {
			return err
		}
		if processed {
			continue
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}
