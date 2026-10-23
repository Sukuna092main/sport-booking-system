package booking

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/testdb"
)

func TestAdminBookingTransactions(t *testing.T) {
	db := testdb.Open(t)
	testdb.SeedCourts(t, db)
	ctx := context.Background()
	now := time.Date(2026, 10, 8, 0, 0, 0, 0, time.UTC)
	loc, err := time.LoadLocation("Asia/Ho_Chi_Minh")
	if err != nil {
		t.Fatal(err)
	}
	repo := NewRepository(db, loc, func() time.Time { return now })
	const owner = "10000000-0000-4000-8000-000000000001"
	const admin = "10000000-0000-4000-8000-000000000002"
	const court = "20000000-0000-4000-8000-000000000001"
	if _, err = db.Exec(`INSERT INTO users(id,email,password_hash,full_name,role) VALUES($1,'admin@example.test','hash','Admin','ADMIN')`, admin); err != nil {
		t.Fatal(err)
	}
	var slot string
	if err = db.QueryRow(`SELECT id::text FROM time_slots WHERE court_id=$1 AND weekday=6 AND starts_at='08:00' AND is_active`, court).Scan(&slot); err != nil {
		t.Fatal(err)
	}
	b, _, err := NewService(repo).Create(ctx, owner, "admin-cancel-test", "create-request", CreateRequest{CourtID: court, BookingDate: "2026-10-10", TimeSlotIDs: []string{slot}})
	if err != nil {
		t.Fatal(err)
	}
	// The admin can read every owner's booking; filters count parents, not slots.
	got, err := repo.AdminByID(ctx, b.ID)
	if err != nil || got.CustomerID != owner {
		t.Fatal(got, err)
	}
	values, total, err := repo.AdminList(ctx, AdminFilter{CourtID: court, Date: b.BookingDate, Status: "CONFIRMED", Page: 1, PageSize: 1})
	if err != nil || total != 1 || len(values) != 1 || values[0].ID != b.ID {
		t.Fatal(values, total, err)
	}
	stats, err := repo.AdminStatistics(ctx, b.BookingDate, b.BookingDate)
	if err != nil || stats.TotalBookings != 1 || stats.ConfirmedBookings != 1 {
		t.Fatal(stats, err)
	}
	// Audit failure must roll back status and slot release together.
	if _, err = db.Exec(`ALTER TABLE audit_logs ADD CONSTRAINT reject_admin_cancel CHECK (action <> 'BOOKING_CANCELLED')`); err != nil {
		t.Fatal(err)
	}
	if _, err = repo.AdminCancel(ctx, admin, b.ID, "cancel-request", "Maintenance"); err == nil {
		t.Fatal("expected audit failure")
	}
	var status string
	var released *time.Time
	if err = db.QueryRow(`SELECT b.status,bs.released_at FROM bookings b JOIN booking_slots bs ON bs.booking_id=b.id WHERE b.id=$1`, b.ID).Scan(&status, &released); err != nil || status != "CONFIRMED" || released != nil {
		t.Fatal(status, released, err)
	}
	if _, err = db.Exec(`ALTER TABLE audit_logs DROP CONSTRAINT reject_admin_cancel; UPDATE users SET status='INACTIVE' WHERE id='10000000-0000-4000-8000-000000000001'`); err != nil {
		t.Fatal(err)
	}
	got, err = repo.AdminCancel(ctx, admin, b.ID, "cancel-request", "Maintenance \"court\"")
	if err != nil || got.Status != "CANCELLED" || len(got.Slots) != 1 {
		t.Fatal(got, err)
	}
	var actor, reason, request string
	if err = db.QueryRow(`SELECT actor_user_id::text,details->>'reason',request_id FROM audit_logs WHERE entity_id=$1 AND action='BOOKING_CANCELLED'`, b.ID).Scan(&actor, &reason, &request); err != nil || actor != admin || reason != "Maintenance \"court\"" || request != "cancel-request" {
		t.Fatal(actor, reason, request, err)
	}
	stats, err = repo.AdminStatistics(ctx, b.BookingDate, b.BookingDate)
	if err != nil || stats.TotalBookings != 1 || stats.CancelledBookings != 1 || stats.ConfirmedBookings != 0 {
		t.Fatal(stats, err)
	}
	_, err = repo.AdminCancel(ctx, admin, b.ID, "again", "Reason")
	var safe *apperror.Error
	if !errors.As(err, &safe) || safe.Code != "already_cancelled" {
		t.Fatal(err)
	}
}

func TestAdminCancelAtFirstSlot(t *testing.T) {
	db := testdb.Open(t)
	testdb.SeedCourts(t, db)
	ctx := context.Background()
	var id string
	var start time.Time
	if err := db.QueryRow(`SELECT b.id::text,min(bs.starts_at) FROM bookings b JOIN booking_slots bs ON bs.booking_id=b.id WHERE b.status='CONFIRMED' GROUP BY b.id LIMIT 1`).Scan(&id, &start); err != nil {
		t.Fatal(err)
	}
	repo := NewRepository(db, time.UTC, func() time.Time { return start })
	_, err := repo.AdminCancel(ctx, "10000000-0000-4000-8000-000000000001", id, "request", "Reason")
	var safe *apperror.Error
	if !errors.As(err, &safe) || safe.Code != "cancellation_closed" {
		t.Fatal(err)
	}
}
