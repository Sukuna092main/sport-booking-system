package court

import (
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/testdb"
	"testing"
)

func TestFoundationConstraints(t *testing.T) {
	db := testdb.Open(t)
	testdb.SeedCourts(t, db)
	for _, query := range []string{
		`INSERT INTO court_operating_hours(court_id,weekday,opens_at,closes_at) VALUES('20000000-0000-4000-8000-000000000001',5,'08:30','10:00')`,
		`INSERT INTO time_slots(court_id,weekday,starts_at,ends_at) VALUES('20000000-0000-4000-8000-000000000001',5,'08:30','09:30')`,
		`INSERT INTO bookings(customer_id,court_id,booking_code,booking_date,idempotency_key,request_hash) SELECT customer_id,court_id,'NULL-HASH',booking_date,'null-hash',NULL FROM bookings LIMIT 1`,
	} {
		if _, err := db.Exec(query); err == nil {
			t.Fatalf("constraint should reject: %s", query)
		}
	}
	// Adjacent hours and inactive historical templates remain legal.
	if _, err := db.Exec(`INSERT INTO court_operating_hours(court_id,weekday,opens_at,closes_at) VALUES('20000000-0000-4000-8000-000000000001',5,'13:00','14:00')`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO bookings(id,customer_id,court_id,booking_code,booking_date,idempotency_key,request_hash) SELECT '30000000-0000-4000-8000-000000000004',customer_id,court_id,'REBOOK',booking_date,'rebook',request_hash FROM bookings WHERE booking_code='FIX-CANCELLED'`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO booking_slots(booking_id,time_slot_id,court_id,booking_date,weekday,starts_at,ends_at) SELECT '30000000-0000-4000-8000-000000000004',time_slot_id,court_id,booking_date,weekday,starts_at,ends_at FROM booking_slots WHERE booking_id='30000000-0000-4000-8000-000000000003'`); err != nil {
		t.Fatal("cancelled slot must be rebookable:", err)
	}
	// Even a different old template cannot overlap an active booking snapshot.
	if _, err := db.Exec(`INSERT INTO booking_slots(booking_id,time_slot_id,court_id,booking_date,weekday,starts_at,ends_at) SELECT '30000000-0000-4000-8000-000000000004',id,court_id,'2026-10-09',5,'2026-10-09 09:30:00+07','2026-10-09 10:30:00+07' FROM time_slots WHERE court_id='20000000-0000-4000-8000-000000000001' AND weekday=5 AND starts_at='08:00'`); err == nil {
		t.Fatal("overlapping snapshot accepted")
	}
}
