package schedule

import (
	"context"
	"database/sql"
	"encoding/json"
	availability "github.com/Sukuna092main/sport-booking-system/backend/internal/Availability"
	booking "github.com/Sukuna092main/sport-booking-system/backend/internal/Booking"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/identity"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/testdb"
	"github.com/gin-gonic/gin"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

const testCourt = "20000000-0000-4000-8000-000000000001"
const testActor = "10000000-0000-4000-8000-000000000001"

func testRouter(t *testing.T) (*gin.Engine, *sql.DB) {
	t.Helper()
	db := testdb.Open(t)
	testdb.SeedCourts(t, db)
	gin.SetMode(gin.TestMode)
	router := gin.New()
	routes := router.Group("/admin")
	routes.Use(func(c *gin.Context) {
		identity.Set(c, identity.Actor{ID: testActor, Role: "ADMIN"})
		c.Set("request_id", "schedule-test")
		c.Next()
	})
	RegisterWithTimezone(routes, db, "Asia/Bangkok")
	return router, db
}
func request(router *gin.Engine, method, path, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, "/admin/courts/"+testCourt+path, strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, r)
	return w
}
func scalar(t *testing.T, db *sql.DB, query string) string {
	t.Helper()
	var value string
	if err := db.QueryRow(query).Scan(&value); err != nil {
		t.Fatal(err)
	}
	return value
}

func TestHoursReplacementPreservesSnapshotsAndRollsBackOnAuditFailure(t *testing.T) {
	router, db := testRouter(t)
	before := scalar(t, db, `SELECT jsonb_agg(to_jsonb(b) ORDER BY booking_id,time_slot_id)::text FROM booking_slots b`)
	w := request(router, "PUT", "/operating-hours", `{"hours":[{"weekday":5,"opensAt":"08:00:00","closesAt":"10:30:00"}]}`)
	if w.Code != 200 {
		t.Fatalf("%d %s", w.Code, w.Body)
	}
	var payload struct {
		Data OperatingHours `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Data.TimeSlots) != 2 || payload.Data.TimeZone != "Asia/Bangkok" {
		t.Fatalf("hours=%+v", payload.Data)
	}
	if after := scalar(t, db, `SELECT jsonb_agg(to_jsonb(b) ORDER BY booking_id,time_slot_id)::text FROM booking_slots b`); before != after {
		t.Fatal("booking snapshots changed")
	}
	if count := scalar(t, db, `SELECT count(*)::text FROM booking_slots bs JOIN time_slots ts ON ts.id=bs.time_slot_id WHERE ts.is_active`); count != "0" {
		t.Fatalf("referenced templates still active: %s", count)
	}
	hoursBefore := w.Body.String()
	if _, err := db.Exec(`ALTER TABLE audit_logs ADD CONSTRAINT test_audit_reject CHECK(action <> 'OPERATING_HOURS_REPLACED') NOT VALID`); err != nil {
		t.Fatal(err)
	}
	w = request(router, "PUT", "/operating-hours", `{"hours":[]}`)
	if w.Code != 500 {
		t.Fatalf("audit failure status=%d body=%s", w.Code, w.Body)
	}
	w = request(router, "GET", "/operating-hours", "")
	if w.Code != 200 || w.Body.String() != hoursBefore {
		t.Fatalf("replacement failed to roll back: %s", w.Body)
	}
	if count := scalar(t, db, `SELECT count(*)::text FROM audit_logs`); count != "1" {
		t.Fatalf("audit count=%s", count)
	}
}

func TestBlackoutHTTPOverlapPartialUpdateAndSoftDelete(t *testing.T) {
	router, db := testRouter(t)
	w := request(router, "POST", "/blackouts", `{"startsAt":"2026-10-09T08:00:00+07:00","endsAt":"2026-10-09T09:30:00+07:00","reason":"maintenance"}`)
	if w.Code != 201 {
		t.Fatalf("%d %s", w.Code, w.Body)
	}
	var payload struct {
		Data Blackout `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &payload)
	id := payload.Data.ID
	w = request(router, "POST", "/blackouts", `{"startsAt":"2026-10-09T08:30:00+07:00","endsAt":"2026-10-09T09:30:00+07:00"}`)
	if w.Code != 201 {
		t.Fatalf("overlap allowed=%d %s", w.Code, w.Body)
	}
	w = request(router, "PATCH", "/blackouts/"+id, `{"reason":null}`)
	if w.Code != 200 {
		t.Fatalf("patch=%d %s", w.Code, w.Body)
	}
	_ = json.Unmarshal(w.Body.Bytes(), &payload)
	if payload.Data.Reason != nil {
		t.Fatal("reason not cleared")
	}
	w = request(router, "PATCH", "/blackouts/"+id, `{"endsAt":"2026-10-09T07:00:00+07:00"}`)
	if w.Code != 400 {
		t.Fatalf("merged invalid range=%d %s", w.Code, w.Body)
	}
	for i := 0; i < 2; i++ {
		w = request(router, "DELETE", "/blackouts/"+id, "")
		if w.Code != 204 || w.Body.Len() != 0 {
			t.Fatalf("delete=%d %s", w.Code, w.Body)
		}
	}
	if count := scalar(t, db, `SELECT count(*)::text FROM audit_logs WHERE action='COURT_BLACKOUT_DEACTIVATED'`); count != "1" {
		t.Fatalf("delete audits=%s", count)
	}
	w = request(router, "GET", "/blackouts", "")
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"isActive":false`) {
		t.Fatalf("list=%d %s", w.Code, w.Body)
	}
	if count := scalar(t, db, `SELECT count(*)::text FROM bookings WHERE status='CONFIRMED'`); count != "2" {
		t.Fatal("blackouts cancelled booking")
	}
}

func TestCourtLockBlocksScheduleWriter(t *testing.T) {
	_, db := testRouter(t)
	tx, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	if _, err = lockCourt(context.Background(), tx, testCourt); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	_, err = NewService(NewRepository(db), "UTC").Replace(ctx, testCourt, testActor, "lock-test", []OperatingHour{})
	if err == nil {
		t.Fatal("schedule writer ignored court lock")
	}
	if count := scalar(t, db, `SELECT count(*)::text FROM court_operating_hours WHERE is_active`); count != "7" {
		t.Fatalf("blocked writer mutated hours: %s", count)
	}
}

func TestBlackoutAvailabilityBoundariesAndAuditRollback(t *testing.T) {
	_, db := testRouter(t)
	ctx := context.Background()
	repo := NewRepository(db)
	start := time.Date(2026, 10, 16, 8, 0, 0, 0, time.FixedZone("venue", 7*3600))
	location, _ := time.LoadLocation("Asia/Bangkok")
	read := func() availability.Result {
		v, err := availability.NewService(availability.NewRepository(db), location, func() time.Time { return start.Add(-time.Hour) }).Read(ctx, testCourt, "2026-10-16")
		if err != nil {
			t.Fatal(err)
		}
		return v
	}
	assertSlot := func(result availability.Result, hour int, want bool) {
		t.Helper()
		for _, s := range result.Slots {
			if s.StartsAt.In(location).Hour() == hour {
				if s.Available != want {
					t.Fatalf("hour %d available=%v want %v", hour, s.Available, want)
				}
				return
			}
		}
		t.Fatalf("missing hour %d", hour)
	}
	value, err := repo.Create(ctx, testActor, "availability-test", Blackout{CourtID: testCourt, StartsAt: start, EndsAt: start.Add(time.Hour), IsActive: true})
	if err != nil {
		t.Fatal(err)
	}
	newBookings := booking.NewService(booking.NewRepository(db, location, func() time.Time { return start.Add(-2 * time.Hour) }))
	slotID := scalar(t, db, `SELECT id::text FROM time_slots WHERE court_id='`+testCourt+`' AND weekday=5 AND starts_at='08:00' AND is_active`)
	if _, _, err = newBookings.Create(ctx, testActor, "blackout-blocked", "booking-test", booking.CreateRequest{CourtID: testCourt, BookingDate: "2026-10-16", TimeSlotIDs: []string{slotID}}); err == nil {
		t.Fatal("new booking ignored blackout")
	}
	slots := read()
	assertSlot(slots, 7, false)
	assertSlot(slots, 8, false)
	assertSlot(slots, 9, true)
	// 07:00 already started; move the clock earlier to prove the adjacent bound.
	slots, err = availability.NewService(availability.NewRepository(db), location, func() time.Time { return start.Add(-2 * time.Hour) }).Read(ctx, testCourt, "2026-10-16")
	if err != nil {
		t.Fatal(err)
	}
	assertSlot(slots, 7, true)
	if _, err = db.Exec(`ALTER TABLE audit_logs ADD CONSTRAINT test_blackout_audit_reject CHECK(action <> 'COURT_BLACKOUT_DEACTIVATED') NOT VALID`); err != nil {
		t.Fatal(err)
	}
	if err = repo.Delete(ctx, testCourt, value.ID, testActor, "rollback-test"); err == nil {
		t.Fatal("audit failure succeeded")
	}
	assertSlot(read(), 8, false)
	if _, err = db.Exec(`ALTER TABLE audit_logs DROP CONSTRAINT test_blackout_audit_reject`); err != nil {
		t.Fatal(err)
	}
	if err = repo.Delete(ctx, testCourt, value.ID, testActor, "delete-test"); err != nil {
		t.Fatal(err)
	}
	assertSlot(read(), 8, true)
}

func TestStrictJSONBeforeDatabase(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	routes := router.Group("/admin")
	routes.Use(func(c *gin.Context) { identity.Set(c, identity.Actor{ID: testActor, Role: "ADMIN"}); c.Next() })
	Register(routes, nil)
	for _, tt := range []struct{ method, path, body string }{
		{"PUT", "/operating-hours", `{}`}, {"PUT", "/operating-hours", `{"hours":null}`}, {"PUT", "/operating-hours", `{"hours":[{"weekday":1,"opensAt":"08:00:00","closesAt":"09:00:00","extra":true}]}`},
		{"POST", "/blackouts", `{"startsAt":null,"endsAt":"2027-01-01T09:00:00Z"}`}, {"PATCH", "/blackouts/" + testCourt, `{}`}, {"PATCH", "/blackouts/" + testCourt, `{"isActive":null}`}, {"PATCH", "/blackouts/" + testCourt, `{"other":true}`},
	} {
		w := request(router, tt.method, tt.path, tt.body)
		if w.Code != 400 {
			t.Fatalf("%s: %d %s", tt.body, w.Code, w.Body)
		}
	}
}
