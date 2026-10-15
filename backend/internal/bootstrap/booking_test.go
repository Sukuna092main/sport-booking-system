package bootstrap

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http/httptest"
	"reflect"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	booking "github.com/Sukuna092main/sport-booking-system/backend/internal/Booking"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/testdb"
	"github.com/gin-gonic/gin"
)

type bookingResponse struct {
	HTTPStatus int             `json:"-"`
	Data       booking.Booking `json:"data"`
	Error      struct {
		Code      string `json:"code"`
		RequestID string `json:"requestId"`
	} `json:"error"`
}

func bookingCall(r *gin.Engine, method, path, body, token, key string) (int, bookingResponse, error) {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if key != "" {
		req.Header.Set("Idempotency-Key", key)
	}
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	var result bookingResponse
	err := json.Unmarshal(rec.Body.Bytes(), &result)
	result.HTTPStatus = rec.Code
	if rec.Header().Get("X-Request-ID") == "" || (rec.Code >= 400 && result.Error.RequestID != rec.Header().Get("X-Request-ID")) {
		err = fmt.Errorf("request ID mismatch")
	}
	for _, forbidden := range []string{"requestHash", "request_hash", "idempotency_key", "passwordHash", "password_hash", "INSERT INTO", "SQLSTATE"} {
		if strings.Contains(rec.Body.String(), forbidden) {
			err = fmt.Errorf("internal data leaked: %s", forbidden)
		}
	}
	return rec.Code, result, err
}

func mustBooking(t *testing.T, r *gin.Engine, method, path, body, token, key string, want int) booking.Booking {
	t.Helper()
	status, result, err := bookingCall(r, method, path, body, token, key)
	if err != nil || status != want {
		t.Fatalf("%s %s: status=%d want=%d error=%s decode=%v", method, path, status, want, result.Error.Code, err)
	}
	return result.Data
}

func slotIDs(t *testing.T, db *sql.DB, courtID string, weekday int, hours ...int) []string {
	t.Helper()
	ids := make([]string, 0, len(hours))
	for _, hour := range hours {
		var id string
		if err := db.QueryRow(`SELECT id::text FROM time_slots WHERE court_id=$1 AND weekday=$2 AND starts_at=make_time($3,0,0) AND is_active`, courtID, weekday, hour).Scan(&id); err != nil {
			t.Fatal(err)
		}
		ids = append(ids, id)
	}
	return ids
}

func bookingBody(t *testing.T, courtID, date string, ids []string) string {
	t.Helper()
	encoded, err := json.Marshal(booking.CreateRequest{CourtID: courtID, BookingDate: date, TimeSlotIDs: ids})
	if err != nil {
		t.Fatal(err)
	}
	return string(encoded)
}

func execBooking(t *testing.T, db *sql.DB, query string, args ...any) {
	t.Helper()
	if _, err := db.Exec(query, args...); err != nil {
		t.Fatal(err)
	}
}

func assertBookingCounts(t *testing.T, db *sql.DB, owner string, bookings, slots, audits int) {
	t.Helper()
	var b, s, a int
	if err := db.QueryRow(`SELECT (SELECT count(*) FROM bookings WHERE customer_id=$1),
		(SELECT count(*) FROM booking_slots bs JOIN bookings b ON b.id=bs.booking_id WHERE b.customer_id=$1),
		(SELECT count(*) FROM audit_logs WHERE actor_user_id=$1)`, owner).Scan(&b, &s, &a); err != nil {
		t.Fatal(err)
	}
	if b != bookings || s != slots || a != audits {
		t.Fatalf("persisted bookings/slots/audits=%d/%d/%d want %d/%d/%d", b, s, a, bookings, slots, audits)
	}
}

func TestBookingLifecycleHTTP(t *testing.T) {
	r, db := testServer(t)
	testdb.SeedCourts(t, db)
	owner, token := registerLogin(t, r, "booking-owner@example.test")
	other, otherToken := registerLogin(t, r, "booking-other@example.test")
	ids := slotIDs(t, db, fixtureCourt, 6, 8, 9)
	body := bookingBody(t, fixtureCourt, "2026-10-10", ids)
	value := mustBooking(t, r, "POST", "/api/v1/bookings", body, token, "create-one", 201)
	if value.CustomerID != owner || value.Status != "CONFIRMED" || value.BookingCode == "" || len(value.Slots) != 2 || value.BookingDate != "2026-10-10" || value.Slots[0].StartsAt.Format(time.RFC3339) != "2026-10-10T01:00:00Z" {
		t.Fatal(value)
	}
	assertBookingCounts(t, db, owner, 1, 2, 1)
	replay := mustBooking(t, r, "POST", "/api/v1/bookings", body, token, "create-one", 200)
	if !reflect.DeepEqual(value, replay) {
		t.Fatal("replay changed result", value, replay)
	}
	// Canonical selection: casing/order changes must not create a second booking.
	reordered := bookingBody(t, strings.ToUpper(fixtureCourt), "2026-10-10", []string{strings.ToUpper(ids[1]), strings.ToUpper(ids[0])})
	if got := mustBooking(t, r, "POST", "/api/v1/bookings", reordered, token, "create-one", 200); got.ID != value.ID {
		t.Fatal(got)
	}
	changed := bookingBody(t, fixtureCourt, "2026-10-11", slotIDs(t, db, fixtureCourt, 7, 8, 9))
	status, result, err := bookingCall(r, "POST", "/api/v1/bookings", changed, token, "create-one")
	if err != nil || status != 409 || result.Error.Code != "idempotency_conflict" {
		t.Fatal(status, result, err)
	}
	path := "/api/v1/bookings/" + value.ID
	if got := mustBooking(t, r, "GET", path, "", token, "", 200); !reflect.DeepEqual(got, value) {
		t.Fatal(got)
	}
	for _, methodPath := range []struct{ method, path string }{{"GET", path}, {"POST", path + "/cancel"}} {
		mustBooking(t, r, methodPath.method, methodPath.path, "", otherToken, "", 404)
		mustBooking(t, r, methodPath.method, methodPath.path, "", "", "", 401)
	}
	status, list := request(t, r, "GET", "/api/v1/bookings?customerId="+other+"&pageSize=1", "", token)
	if status != 200 || list["meta"].(map[string]any)["total"] != float64(1) || len(list["data"].([]any)) != 1 {
		t.Fatal(status, list)
	}
	status, list = request(t, r, "GET", "/api/v1/bookings", "", otherToken)
	if status != 200 || len(list["data"].([]any)) != 0 {
		t.Fatal(status, list)
	}
	cancelled := mustBooking(t, r, "POST", path+"/cancel", "", token, "", 200)
	if cancelled.Status != "CANCELLED" || cancelled.CancelledAt == nil || !reflect.DeepEqual(cancelled.Slots, value.Slots) {
		t.Fatal(cancelled)
	}
	assertBookingCounts(t, db, owner, 1, 2, 2)
	var unreleased int
	if err = db.QueryRow(`SELECT count(*) FROM booking_slots WHERE booking_id=$1 AND released_at IS NULL`, value.ID).Scan(&unreleased); err != nil || unreleased != 0 {
		t.Fatal(unreleased, err)
	}
	status, result, err = bookingCall(r, "POST", path+"/cancel", "", token, "")
	if err != nil || status != 409 || result.Error.Code != "already_cancelled" {
		t.Fatal(status, result, err)
	}
	if got := mustBooking(t, r, "POST", "/api/v1/bookings", body, token, "create-one", 200); !reflect.DeepEqual(got, cancelled) {
		t.Fatal("cancelled replay", got)
	}
	status, list = request(t, r, "GET", "/api/v1/courts/"+fixtureCourt+"/availability?date=2026-10-10", "", "")
	if status != 200 {
		t.Fatal(status, list)
	}
	for _, raw := range list["data"].(map[string]any)["slots"].([]any) {
		slot := raw.(map[string]any)
		if (slot["id"] == ids[0] || slot["id"] == ids[1]) && slot["available"] != true {
			t.Fatal("cancel did not restore availability", slot)
		}
	}
	rebook := mustBooking(t, r, "POST", "/api/v1/bookings", body, otherToken, "create-one", 201)
	if rebook.ID == value.ID || rebook.CustomerID != other {
		t.Fatal(rebook)
	}
	// History must survive disabled court/template/sport and retain UTC snapshots.
	execBooking(t, db, `UPDATE courts SET is_active=false WHERE id=$1`, fixtureCourt)
	execBooking(t, db, `UPDATE time_slots SET is_active=false WHERE court_id=$1`, fixtureCourt)
	execBooking(t, db, `UPDATE sport_types SET is_active=false WHERE id='11000000-0000-4000-8000-000000000001'`)
	if got := mustBooking(t, r, "GET", path, "", token, "", 200); !reflect.DeepEqual(got, cancelled) {
		t.Fatal(got)
	}
	mustBooking(t, r, "POST", "/api/v1/bookings/"+rebook.ID+"/cancel", "", otherToken, "", 200)
	mustBooking(t, r, "POST", "/api/v1/bookings", body, token, "create-one", 200)
}

func TestBookingInputAndEligibilityHTTP(t *testing.T) {
	r, db := testServer(t)
	testdb.SeedCourts(t, db)
	owner, token := registerLogin(t, r, "validation@example.test")
	ids := slotIDs(t, db, fixtureCourt, 6, 7, 8, 9, 10, 11)
	valid := bookingBody(t, fixtureCourt, "2026-10-10", ids[:1])
	for _, body := range []string{`{}`, `null`, `[]`, valid + ` {}`, strings.Replace(valid, `"courtId"`, `"customerId":"10000000-0000-4000-8000-000000000001","courtId"`, 1), bookingBody(t, fixtureCourt, "2026-10-10", []string{ids[0], ids[0]}), bookingBody(t, fixtureCourt, "2026-02-30", ids[:1])} {
		mustBooking(t, r, "POST", "/api/v1/bookings", body, token, "bad", 400)
	}
	mustBooking(t, r, "POST", "/api/v1/bookings", valid, token, "", 400)
	mustBooking(t, r, "POST", "/api/v1/bookings", valid, "", "key", 401)
	for _, tc := range []struct {
		name, body string
		status     int
		code       string
	}{
		{"yesterday", bookingBody(t, fixtureCourt, "2026-10-07", ids[:1]), 422, "booking_rule_violation"},
		{"beyond_30", bookingBody(t, fixtureCourt, "2026-11-08", ids[:1]), 422, "booking_rule_violation"},
		{"past_start", bookingBody(t, fixtureCourt, "2026-10-08", slotIDs(t, db, fixtureCourt, 4, 7)), 422, "booking_rule_violation"},
		{"gap", bookingBody(t, fixtureCourt, "2026-10-10", []string{ids[0], ids[2]}), 422, "booking_rule_violation"},
		{"reverse", bookingBody(t, fixtureCourt, "2026-10-10", []string{ids[1], ids[0]}), 422, "booking_rule_violation"},
		{"five", bookingBody(t, fixtureCourt, "2026-10-10", ids), 422, "booking_rule_violation"},
		{"wrong_weekday", bookingBody(t, fixtureCourt, "2026-10-11", ids[:1]), 422, "booking_rule_violation"},
		{"inactive_court", bookingBody(t, "20000000-0000-4000-8000-000000000003", "2026-10-10", ids[:1]), 422, "booking_rule_violation"},
		{"inactive_sport", bookingBody(t, "20000000-0000-4000-8000-000000000004", "2026-10-10", ids[:1]), 422, "booking_rule_violation"},
		{"blackout", bookingBody(t, fixtureCourt, "2026-10-09", slotIDs(t, db, fixtureCourt, 5, 8)), 409, "slot_unavailable"},
		{"old_template_overlap", bookingBody(t, fixtureCourt, "2026-10-09", slotIDs(t, db, fixtureCourt, 5, 10)), 409, "slot_unavailable"},
		{"wrong_court", bookingBody(t, "20000000-0000-4000-8000-000000000002", "2026-10-10", ids[:1]), 422, "booking_rule_violation"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			status, result, err := bookingCall(r, "POST", "/api/v1/bookings", tc.body, token, "reusable-after-failure")
			if err != nil || status != tc.status || result.Error.Code != tc.code {
				t.Fatal(status, result, err)
			}
		})
	}
	assertBookingCounts(t, db, owner, 0, 0, 0)
	// A rolled-back/rejected attempt does not poison its key.
	mustBooking(t, r, "POST", "/api/v1/bookings", valid, token, "reusable-after-failure", 201)
	for _, query := range []string{"?page=0", "?pageSize=101", "?status=", "?status=confirmed", "?page=1&page=2", "?status=CONFIRMED&status=CANCELLED", "?page=%ZZ"} {
		status, _ := request(t, r, "GET", "/api/v1/bookings"+query, "", token)
		if status != 400 {
			t.Fatal(query, status)
		}
	}
	for _, path := range []string{"/api/v1/bookings/bad", "/api/v1/bookings/bad/cancel"} {
		method := "GET"
		if strings.HasSuffix(path, "cancel") {
			method = "POST"
		}
		mustBooking(t, r, method, path, "", token, "", 400)
	}
	mustBooking(t, r, "GET", "/api/v1/bookings/99999999-9999-4999-8999-999999999999", "", token, "", 404)
	execBooking(t, db, `UPDATE users SET status='INACTIVE' WHERE id=$1`, owner)
	mustBooking(t, r, "POST", "/api/v1/bookings", valid, token, "another", 403)
}

// Start all HTTP calls together, collect errors on the parent goroutine, and
// assert both response outcomes and persisted transaction state.
func concurrentBookings(t *testing.T, r *gin.Engine, bodies, tokens, keys []string) []bookingResponse {
	t.Helper()
	start := make(chan struct{})
	type outcome struct {
		status int
		result bookingResponse
		err    error
	}
	results := make(chan outcome, len(bodies))
	var wg sync.WaitGroup
	for i := range bodies {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			status, result, err := bookingCall(r, "POST", "/api/v1/bookings", bodies[i], tokens[i], keys[i])
			results <- outcome{status, result, err}
		}(i)
	}
	close(start)
	wg.Wait()
	close(results)
	statuses := make([]int, 0, len(bodies))
	values := make([]bookingResponse, 0, len(bodies))
	for result := range results {
		if result.err != nil {
			t.Fatal(result.err)
		}
		statuses = append(statuses, result.status)
		values = append(values, result.result)
	}
	sort.Ints(statuses)
	if statuses[len(statuses)-1] >= 500 {
		t.Fatal("concurrent transaction failed", statuses, values)
	}
	t.Log("concurrent HTTP statuses", statuses)
	return values
}

func TestBookingConcurrentRetryAndConflict(t *testing.T) {
	for _, sameKey := range []bool{true, false} {
		t.Run(fmt.Sprint("same_key_", sameKey), func(t *testing.T) {
			r, db := testServer(t)
			testdb.SeedCourts(t, db)
			owner, token := registerLogin(t, r, "parallel@example.test")
			body := bookingBody(t, fixtureCourt, "2026-10-10", slotIDs(t, db, fixtureCourt, 6, 8, 9))
			bodies, tokens, keys := []string{}, []string{}, []string{}
			for i := 0; i < 8; i++ {
				bodies = append(bodies, body)
				tokens = append(tokens, token)
				key := "same"
				if !sameKey {
					key = fmt.Sprint("different-", i)
				}
				keys = append(keys, key)
			}
			values := concurrentBookings(t, r, bodies, tokens, keys)
			var id string
			success, conflict, created := 0, 0, 0
			for _, value := range values {
				if value.HTTPStatus == 201 {
					created++
				}
				if value.Error.Code != "" {
					if value.Error.Code != "slot_unavailable" {
						t.Fatal(value)
					}
					conflict++
					continue
				}
				if id != "" && id != value.Data.ID {
					t.Fatal("duplicate result", values)
				}
				id = value.Data.ID
				success++
			}
			if (sameKey && (success != 8 || conflict != 0)) || (!sameKey && (success != 1 || conflict != 7)) {
				t.Fatal(success, conflict)
			}
			if created != 1 {
				t.Fatal("expected exactly one 201", created)
			}
			assertBookingCounts(t, db, owner, 1, 2, 1)
		})
	}
}

func TestBookingDifferentUsersRaceForSameSlot(t *testing.T) {
	r, db := testServer(t)
	testdb.SeedCourts(t, db)
	_, one := registerLogin(t, r, "race-one@example.test")
	_, two := registerLogin(t, r, "race-two@example.test")
	body := bookingBody(t, fixtureCourt, "2026-10-10", slotIDs(t, db, fixtureCourt, 6, 8))
	values := concurrentBookings(t, r, []string{body, body}, []string{one, two}, []string{"same", "same"})
	success, conflicts := 0, 0
	for _, value := range values {
		if value.Data.ID != "" {
			success++
		} else if value.Error.Code == "slot_unavailable" {
			conflicts++
		} else {
			t.Fatal(value)
		}
	}
	if success != 1 || conflicts != 1 {
		t.Fatal(values)
	}
}

func TestBookingConcurrentActiveLimitAcrossCourts(t *testing.T) {
	r, db := testServer(t)
	testdb.SeedCourts(t, db)
	owner, token := registerLogin(t, r, "limit@example.test")
	bodies, tokens, keys := []string{}, []string{}, []string{}
	for i := 0; i < 4; i++ {
		var courtID string
		if err := db.QueryRow(`INSERT INTO courts (sport_type_id,code,name) VALUES ('11000000-0000-4000-8000-000000000001',$1,'Parallel court') RETURNING id::text`, fmt.Sprint("LIMIT-", i)).Scan(&courtID); err != nil {
			t.Fatal(err)
		}
		execBooking(t, db, `INSERT INTO court_operating_hours(court_id,weekday,opens_at,closes_at) VALUES ($1,6,'08:00','09:00')`, courtID)
		execBooking(t, db, `INSERT INTO time_slots(court_id,weekday,starts_at,ends_at) VALUES ($1,6,'08:00','09:00')`, courtID)
		bodies = append(bodies, bookingBody(t, courtID, "2026-10-10", slotIDs(t, db, courtID, 6, 8)))
		tokens = append(tokens, token)
		keys = append(keys, fmt.Sprint("limit-", i))
	}
	values := concurrentBookings(t, r, bodies, tokens, keys)
	success, limit := 0, 0
	for _, value := range values {
		if value.Data.ID != "" {
			success++
		} else if value.Error.Code == "booking_rule_violation" {
			limit++
		} else {
			t.Fatal(value)
		}
	}
	if success != 3 || limit != 1 {
		t.Fatal(values)
	}
	assertBookingCounts(t, db, owner, 3, 3, 3)
	// Replay at the cap succeeds; cancelled booking stops counting.
	for i, body := range bodies {
		if valuesHaveCourt(values, body) {
			mustBooking(t, r, "POST", "/api/v1/bookings", body, token, keys[i], 200)
		}
	}
	var first booking.Booking
	for _, value := range values {
		if value.Data.ID != "" {
			first = value.Data
			break
		}
	}
	mustBooking(t, r, "POST", "/api/v1/bookings/"+first.ID+"/cancel", "", token, "", 200)
	for i, body := range bodies {
		want := 201
		if valuesHaveCourt(values, body) {
			want = 200
		}
		mustBooking(t, r, "POST", "/api/v1/bookings", body, token, keys[i], want)
	}
}

func valuesHaveCourt(values []bookingResponse, body string) bool {
	for _, value := range values {
		if value.Data.ID != "" && strings.Contains(body, value.Data.CourtID) {
			return true
		}
	}
	return false
}

func TestBookingAtomicRollback(t *testing.T) {
	r, db := testServer(t)
	testdb.SeedCourts(t, db)
	owner, token := registerLogin(t, r, "rollback@example.test")
	body := bookingBody(t, fixtureCourt, "2026-10-10", slotIDs(t, db, fixtureCourt, 6, 8, 9))
	// Force the second slot write to fail, after the booking and first slot exist.
	execBooking(t, db, `CREATE FUNCTION reject_second_slot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS (SELECT 1 FROM booking_slots WHERE booking_id=NEW.booking_id) THEN RAISE EXCEPTION 'synthetic slot failure'; END IF; RETURN NEW; END $$;
		CREATE TRIGGER reject_second BEFORE INSERT ON booking_slots FOR EACH ROW EXECUTE FUNCTION reject_second_slot()`)
	mustBooking(t, r, "POST", "/api/v1/bookings", body, token, "rollback-key", 500)
	assertBookingCounts(t, db, owner, 0, 0, 0)
	execBooking(t, db, `DROP TRIGGER reject_second ON booking_slots`)
	// Audit failure must roll back every write, including occupancy release.
	execBooking(t, db, `CREATE FUNCTION reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$;
		CREATE TRIGGER reject_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_audit()`)
	mustBooking(t, r, "POST", "/api/v1/bookings", body, token, "rollback-key", 500)
	assertBookingCounts(t, db, owner, 0, 0, 0)
	execBooking(t, db, `DROP TRIGGER reject_audit ON audit_logs`)
	value := mustBooking(t, r, "POST", "/api/v1/bookings", body, token, "rollback-key", 201)
	execBooking(t, db, `CREATE TRIGGER reject_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_audit()`)
	mustBooking(t, r, "POST", "/api/v1/bookings/"+value.ID+"/cancel", "", token, "", 500)
	if got := mustBooking(t, r, "GET", "/api/v1/bookings/"+value.ID, "", token, "", 200); got.Status != "CONFIRMED" || got.CancelledAt != nil {
		t.Fatal(got)
	}
	var unreleased int
	if err := db.QueryRow(`SELECT count(*) FROM booking_slots WHERE booking_id=$1 AND released_at IS NULL`, value.ID).Scan(&unreleased); err != nil || unreleased != 2 {
		t.Fatal(unreleased, err)
	}
	assertBookingCounts(t, db, owner, 1, 2, 1)
	execBooking(t, db, `DROP TRIGGER reject_audit ON audit_logs`)
	mustBooking(t, r, "POST", "/api/v1/bookings/"+value.ID+"/cancel", "", token, "", 200)
}

func TestBookingCancellationBoundary(t *testing.T) {
	for _, offset := range []time.Duration{-time.Microsecond, 0, time.Microsecond} {
		t.Run(offset.String(), func(t *testing.T) {
			r, db := testServer(t)
			testdb.SeedCourts(t, db)
			owner, token := registerLogin(t, r, "boundary@example.test")
			body := bookingBody(t, fixtureCourt, "2026-10-10", slotIDs(t, db, fixtureCourt, 6, 8, 9))
			value := mustBooking(t, r, "POST", "/api/v1/bookings", body, token, "boundary", 201)
			clock := value.Slots[0].StartsAt.Add(offset)
			service := booking.NewService(booking.NewRepository(db, time.UTC, func() time.Time { return clock }))
			got, err := service.Cancel(context.Background(), owner, value.ID, "cancel-boundary")
			if offset < 0 {
				if err != nil || got.Status != "CANCELLED" {
					t.Fatal(got, err)
				}
				return
			}
			var safe *apperror.Error
			if !errors.As(err, &safe) || safe.Code != "cancellation_closed" {
				t.Fatal(err)
			}
			assertBookingCounts(t, db, owner, 1, 2, 1)
		})
	}
}

func TestBookingHistoryPaginationAndStatus(t *testing.T) {
	r, db := testServer(t)
	testdb.SeedCourts(t, db)
	_, token := registerLogin(t, r, "history@example.test")
	other, adminToken := registerLogin(t, r, "history-admin@example.test")
	execBooking(t, db, `UPDATE users SET role='ADMIN' WHERE id=$1`, other)
	values := make([]booking.Booking, 0, 3)
	for i, day := range []int{10, 11, 12} {
		weekday := []int{6, 7, 1}[i]
		body := bookingBody(t, fixtureCourt, fmt.Sprintf("2026-10-%02d", day), slotIDs(t, db, fixtureCourt, weekday, 8, 9))
		values = append(values, mustBooking(t, r, "POST", "/api/v1/bookings", body, token, fmt.Sprint("history-", i), 201))
	}
	sort.Slice(values, func(i, j int) bool { return values[i].ID > values[j].ID }) // all createdAt equal in this fixture.
	for page := 1; page <= 4; page++ {
		status, result := request(t, r, "GET", fmt.Sprintf("/api/v1/bookings?page=%d&pageSize=1", page), "", token)
		if status != 200 || result["meta"].(map[string]any)["total"] != float64(3) {
			t.Fatal(status, result)
		}
		rows := result["data"].([]any)
		if page == 4 {
			if len(rows) != 0 {
				t.Fatal(rows)
			}
			continue
		}
		if len(rows) != 1 || rows[0].(map[string]any)["id"] != values[page-1].ID || len(rows[0].(map[string]any)["slots"].([]any)) != 2 {
			t.Fatal("must paginate bookings, not slots", rows)
		}
	}
	path := "/api/v1/bookings/" + values[0].ID
	mustBooking(t, r, "GET", path, "", adminToken, "", 404)
	mustBooking(t, r, "POST", path+"/cancel", "", adminToken, "", 404)
	mustBooking(t, r, "POST", path+"/cancel", "", token, "", 200)
	for _, tc := range []struct {
		status string
		count  float64
	}{{"CONFIRMED", 2}, {"CANCELLED", 1}} {
		status, result := request(t, r, "GET", "/api/v1/bookings?status="+tc.status, "", token)
		if status != 200 || result["meta"].(map[string]any)["total"] != tc.count || len(result["data"].([]any)) != int(tc.count) {
			t.Fatal(status, result)
		}
	}
}

func TestBookingPerCourtPolicyAndCalendarBoundary(t *testing.T) {
	r, db := testServer(t)
	testdb.SeedCourts(t, db)
	_, token := registerLogin(t, r, "policy@example.test")
	execBooking(t, db, `UPDATE courts SET min_consecutive_slots=2,max_consecutive_slots=2 WHERE id=$1`, fixtureCourt)
	ids := slotIDs(t, db, fixtureCourt, 6, 8, 9, 10)
	mustBooking(t, r, "POST", "/api/v1/bookings", bookingBody(t, fixtureCourt, "2026-10-10", ids[:1]), token, "min", 422)
	mustBooking(t, r, "POST", "/api/v1/bookings", bookingBody(t, fixtureCourt, "2026-10-10", ids), token, "max", 422)
	// Oct 8 -> Nov 7 is exactly +30 local calendar days, and remains valid.
	mustBooking(t, r, "POST", "/api/v1/bookings", bookingBody(t, fixtureCourt, "2026-11-07", ids[:2]), token, "edge30", 201)
	mustBooking(t, r, "POST", "/api/v1/bookings", bookingBody(t, fixtureCourt, "2026-10-08", slotIDs(t, db, fixtureCourt, 4, 8, 9)), token, "today", 201)
	execBooking(t, db, `UPDATE courts SET min_consecutive_slots=1,max_consecutive_slots=4 WHERE id=$1`, fixtureCourt)
	for _, hour := range []int{14, 15} {
		// Active Friday templates outside opening hours / with wrong duration.
		body := bookingBody(t, fixtureCourt, "2026-10-09", slotIDs(t, db, fixtureCourt, 5, hour))
		mustBooking(t, r, "POST", "/api/v1/bookings", body, token, fmt.Sprint("invalid-template-", hour), 422)
	}
	execBooking(t, db, `UPDATE court_operating_hours SET is_active=false WHERE court_id=$1 AND weekday=6`, fixtureCourt)
	mustBooking(t, r, "POST", "/api/v1/bookings", bookingBody(t, fixtureCourt, "2026-10-10", ids[:1]), token, "closed", 422)
	// The original request still replays after its templates/hours changed.
	mustBooking(t, r, "POST", "/api/v1/bookings", bookingBody(t, fixtureCourt, "2026-11-07", ids[:2]), token, "edge30", 200)
}

func TestBookingActiveLimitCountsInProgressButNotCompleted(t *testing.T) {
	r, db := testServer(t)
	testdb.SeedCourts(t, db)
	owner, token := registerLogin(t, r, "active-count@example.test")
	var first booking.Booking
	for i, weekday := range []int{6, 7, 1} {
		body := bookingBody(t, fixtureCourt, fmt.Sprintf("2026-10-%02d", 10+i), slotIDs(t, db, fixtureCourt, weekday, 8, 9))
		value := mustBooking(t, r, "POST", "/api/v1/bookings", body, token, fmt.Sprint("active-", i), 201)
		if i == 0 {
			first = value
		}
	}
	loc, err := time.LoadLocation("Asia/Ho_Chi_Minh")
	if err != nil {
		t.Fatal(err)
	}
	clock := first.Slots[0].StartsAt.Add(30 * time.Minute)
	service := booking.NewService(booking.NewRepository(db, loc, func() time.Time { return clock }))
	input := booking.CreateRequest{CourtID: fixtureCourt, BookingDate: "2026-10-13", TimeSlotIDs: slotIDs(t, db, fixtureCourt, 2, 8)}
	_, _, err = service.Create(context.Background(), owner, "fourth", "cap", input)
	var safe *apperror.Error
	if !errors.As(err, &safe) || safe.Code != "booking_rule_violation" {
		t.Fatal("in-progress booking must count", err)
	}
	clock = first.Slots[1].EndsAt // At the last end, the old booking stops counting.
	if _, replay, err := service.Create(context.Background(), owner, "fourth", "cap", input); err != nil || replay {
		t.Fatal(replay, err)
	}
	clock = time.Date(2026, 12, 10, 0, 0, 0, 0, time.UTC)
	original := booking.CreateRequest{CourtID: fixtureCourt, BookingDate: "2026-10-10", TimeSlotIDs: slotIDs(t, db, fixtureCourt, 6, 8, 9)}
	if got, replay, err := service.Create(context.Background(), owner, "active-0", "late-retry", original); err != nil || !replay || got.ID != first.ID {
		t.Fatal("replay must precede expired horizon", got, replay, err)
	}
}

func TestBookingOverlapConstraintRollsBackAllSlots(t *testing.T) {
	r, db := testServer(t)
	testdb.SeedCourts(t, db)
	owner, token := registerLogin(t, r, "exclusion@example.test")
	// Simulate a competing/legacy writer changing the final inserted interval.
	// The real GiST exclusion constraint, not an application stub, must reject it.
	execBooking(t, db, `CREATE FUNCTION force_overlap() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN IF EXISTS (SELECT 1 FROM booking_slots WHERE booking_id=NEW.booking_id) THEN
			SELECT starts_at,ends_at INTO NEW.starts_at,NEW.ends_at FROM booking_slots WHERE booking_id=NEW.booking_id LIMIT 1;
		END IF; RETURN NEW; END $$;
		CREATE TRIGGER force_overlap BEFORE INSERT ON booking_slots FOR EACH ROW EXECUTE FUNCTION force_overlap()`)
	body := bookingBody(t, fixtureCourt, "2026-10-10", slotIDs(t, db, fixtureCourt, 6, 8, 9))
	status, result, err := bookingCall(r, "POST", "/api/v1/bookings", body, token, "constraint")
	if err != nil || status != 409 || result.Error.Code != "slot_unavailable" {
		t.Fatal(status, result, err)
	}
	assertBookingCounts(t, db, owner, 0, 0, 0)
}

func TestBookingRechecksClockAfterCourtLock(t *testing.T) {
	r, db := testServer(t)
	testdb.SeedCourts(t, db)
	owner, _ := registerLogin(t, r, "lock-clock@example.test")
	loc, err := time.LoadLocation("Asia/Ho_Chi_Minh")
	if err != nil {
		t.Fatal(err)
	}
	start := time.Date(2026, 10, 10, 1, 0, 0, 0, time.UTC) // 08:00 local.
	var clock atomic.Int64
	clock.Store(start.Add(-time.Minute).UnixNano())
	service := booking.NewService(booking.NewRepository(db, loc, func() time.Time { return time.Unix(0, clock.Load()) }))
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	lock, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer lock.Rollback()
	if _, err = lock.ExecContext(ctx, `SELECT id FROM courts WHERE id=$1 FOR UPDATE`, fixtureCourt); err != nil {
		t.Fatal(err)
	}
	input := booking.CreateRequest{CourtID: fixtureCourt, BookingDate: "2026-10-10", TimeSlotIDs: slotIDs(t, db, fixtureCourt, 6, 8)}
	done := make(chan error, 1)
	go func() { _, _, err := service.Create(ctx, owner, "lock-clock", "waiting", input); done <- err }()
	waiting := false
	for ctx.Err() == nil {
		if err = db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT sport_type_id%FOR UPDATE')`).Scan(&waiting); err != nil {
			t.Fatal(err)
		}
		if waiting {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	if !waiting {
		t.Fatal("booking did not wait on court lock")
	}
	clock.Store(start.UnixNano())
	if err = lock.Commit(); err != nil {
		t.Fatal(err)
	}
	err = <-done
	var safe *apperror.Error
	if !errors.As(err, &safe) || safe.Code != "booking_rule_violation" {
		t.Fatal("slot began during lock wait", err)
	}
	assertBookingCounts(t, db, owner, 0, 0, 0)
}

func TestBookingTimestampPrecisionSurvivesRetry(t *testing.T) {
	r, db := testServer(t)
	testdb.SeedCourts(t, db)
	owner, _ := registerLogin(t, r, "precision@example.test")
	loc, err := time.LoadLocation("Asia/Ho_Chi_Minh")
	if err != nil {
		t.Fatal(err)
	}
	clock := time.Date(2026, 10, 8, 0, 0, 0, 123456789, time.UTC)
	service := booking.NewService(booking.NewRepository(db, loc, func() time.Time { return clock }))
	input := booking.CreateRequest{CourtID: fixtureCourt, BookingDate: "2026-10-10", TimeSlotIDs: slotIDs(t, db, fixtureCourt, 6, 8)}
	first, replay, err := service.Create(context.Background(), owner, "precision", "first", input)
	if err != nil || replay {
		t.Fatal(first, replay, err)
	}
	second, replay, err := service.Create(context.Background(), owner, "precision", "retry", input)
	if err != nil || !replay || !reflect.DeepEqual(first, second) {
		t.Fatal("persisted timestamps changed", first, second, replay, err)
	}
	cancelled, err := service.Cancel(context.Background(), owner, first.ID, "cancel")
	if err != nil {
		t.Fatal(err)
	}
	second, replay, err = service.Create(context.Background(), owner, "precision", "retry-cancel", input)
	if err != nil || !replay || !reflect.DeepEqual(cancelled, second) {
		t.Fatal("cancelled timestamps changed", cancelled, second, replay, err)
	}
}
