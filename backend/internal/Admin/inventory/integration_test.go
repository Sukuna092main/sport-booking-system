package inventory

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/identity"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/testdb"
	"github.com/gin-gonic/gin"
)

func inventoryDB(t *testing.T) (*sql.DB, *gin.Engine) {
	t.Helper()
	db := testdb.Open(t)
	var id string
	if err := db.QueryRow(`INSERT INTO users(email,password_hash,full_name,role) VALUES('inventory@example.test','unused','Admin','ADMIN') RETURNING id::text`).Scan(&id); err != nil {
		t.Fatal(err)
	}
	gin.SetMode(gin.TestMode)
	r := gin.New()
	g := r.Group("/admin", func(c *gin.Context) {
		identity.Set(c, identity.Actor{ID: id, Role: "ADMIN"})
		c.Set("request_id", "inventory-test")
	})
	Register(g, db)
	return db, r
}
func call(r *gin.Engine, method, path, body string) (int, map[string]any, string) {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	var v map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &v)
	return w.Code, v, w.Body.String()
}
func mustCall(t *testing.T, r *gin.Engine, method, path, body string, want int) map[string]any {
	t.Helper()
	status, v, raw := call(r, method, path, body)
	if status != want {
		t.Fatalf("%s %s = %d want %d: %s", method, path, status, want, raw)
	}
	return v
}
func exec(t *testing.T, db *sql.DB, q string, args ...any) {
	t.Helper()
	if _, err := db.Exec(q, args...); err != nil {
		t.Fatal(err)
	}
}
func count(t *testing.T, db *sql.DB, q string, args ...any) int {
	t.Helper()
	var n int
	if err := db.QueryRow(q, args...).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}
func createSport(t *testing.T, r *gin.Engine, name string) string {
	t.Helper()
	return mustCall(t, r, "POST", "/admin/sport-types", fmt.Sprintf(`{"name":%q}`, name), 201)["data"].(map[string]any)["id"].(string)
}
func createCourt(t *testing.T, r *gin.Engine, sport, code string) string {
	t.Helper()
	return mustCall(t, r, "POST", "/admin/courts", fmt.Sprintf(`{"sportTypeId":%q,"code":%q,"name":"Court","description":"original","referencePriceAmount":"120000.50","referencePriceCurrency":"VND"}`, sport, code), 201)["data"].(map[string]any)["id"].(string)
}

func TestInventoryLifecycleAndReferences(t *testing.T) {
	db, r := inventoryDB(t)
	sport := createSport(t, r, "Tennis")
	court := createCourt(t, r, sport, "C1")
	mustCall(t, r, "POST", "/admin/courts", fmt.Sprintf(`{"sportTypeId":%q,"code":"C1","name":"Duplicate"}`, sport), 409)
	mustCall(t, r, "PATCH", "/admin/courts/00000000-0000-0000-0000-000000000000", `{"name":"Missing"}`, 404)
	mustCall(t, r, "DELETE", "/admin/sport-types/00000000-0000-0000-0000-000000000000", "", 404)
	mustCall(t, r, "POST", "/admin/sport-types", `{"name":"Tennis"}`, 409)
	mustCall(t, r, "DELETE", "/admin/sport-types/"+sport, "", 409)
	mustCall(t, r, "PATCH", "/admin/sport-types/"+sport, `{"isActive":false}`, 409)
	mustCall(t, r, "PATCH", "/admin/courts/"+court, `{"minConsecutiveSlots":5}`, 400)
	mustCall(t, r, "PATCH", "/admin/courts/"+court, `{"referencePriceAmount":null}`, 400)
	v := mustCall(t, r, "PATCH", "/admin/courts/"+court, `{"description":null,"referencePriceAmount":null,"referencePriceCurrency":null}`, 200)["data"].(map[string]any)
	if v["description"] != nil || v["referencePriceAmount"] != nil || v["code"] != "C1" {
		t.Fatalf("patch lost fields or did not clear: %v", v)
	}
	if v["slotDurationMinutes"] != float64(60) || v["minConsecutiveSlots"] != float64(1) || v["maxConsecutiveSlots"] != float64(4) {
		t.Fatalf("defaults changed: %v", v)
	}
	mustCall(t, r, "GET", "/admin/courts?page=1&pageSize=1", "", 200)
	mustCall(t, r, "GET", "/admin/courts?pageSize=101", "", 400)
	mustCall(t, r, "DELETE", "/admin/courts/"+court, "", 204)
	before := count(t, db, `SELECT count(*) FROM audit_logs`)
	mustCall(t, r, "DELETE", "/admin/courts/"+court, "", 204)
	if count(t, db, `SELECT count(*) FROM audit_logs`) != before {
		t.Fatal("idempotent delete added a mutation")
	}
	mustCall(t, r, "DELETE", "/admin/sport-types/"+sport, "", 204)
	mustCall(t, r, "DELETE", "/admin/sport-types/"+sport, "", 204)
	mustCall(t, r, "PATCH", "/admin/courts/"+court, `{"isActive":true}`, 409)
	mustCall(t, r, "POST", "/admin/courts", fmt.Sprintf(`{"sportTypeId":%q,"name":"Court","code":"C2"}`, sport), 409)
	sports := mustCall(t, r, "GET", "/admin/sport-types", "", 200)["data"].([]any)
	if len(sports) != 1 || sports[0].(map[string]any)["isActive"] != false {
		t.Fatalf("inactive sport missing from admin list: %v", sports)
	}
	courts := mustCall(t, r, "GET", "/admin/courts", "", 200)
	if len(courts["data"].([]any)) != 1 || courts["data"].([]any)[0].(map[string]any)["isActive"] != false || courts["meta"].(map[string]any)["total"] != float64(1) {
		t.Fatalf("inactive court missing from admin pagination: %v", courts)
	}
	if count(t, db, `SELECT count(*) FROM courts WHERE id=$1`, court) != 1 {
		t.Fatal("court hard deleted")
	}
	if count(t, db, `SELECT count(*) FROM audit_logs WHERE request_id='inventory-test' AND actor_user_id IS NOT NULL`) != 5 {
		t.Fatal("missing mutation audit")
	}
}

func TestInventorySlotRegenerationAndAuditRollback(t *testing.T) {
	db, r := inventoryDB(t)
	sport := createSport(t, r, "Tennis")
	court := createCourt(t, r, sport, "C1")
	exec(t, db, `INSERT INTO court_operating_hours(court_id,weekday,opens_at,closes_at) VALUES($1,1,'08:00','10:00')`, court)
	exec(t, db, `INSERT INTO time_slots(court_id,weekday,starts_at,ends_at) VALUES($1,1,'08:00','09:00'),($1,1,'09:00','10:00')`, court)
	mustCall(t, r, "PATCH", "/admin/courts/"+court, `{"slotDurationMinutes":30}`, 200)
	if count(t, db, `SELECT count(*) FROM time_slots WHERE court_id=$1 AND is_active`, court) != 4 || count(t, db, `SELECT count(*) FROM time_slots WHERE court_id=$1 AND NOT is_active`, court) != 2 {
		t.Fatal("templates not regenerated or history removed")
	}
	exec(t, db, `CREATE FUNCTION reject_inventory_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit rejected'; END $$`)
	exec(t, db, `CREATE TRIGGER reject_inventory_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_inventory_audit()`)
	mustCall(t, r, "PATCH", "/admin/courts/"+court, `{"slotDurationMinutes":60}`, 500)
	if count(t, db, `SELECT count(*) FROM courts WHERE id=$1 AND slot_duration_minutes=30`, court) != 1 || count(t, db, `SELECT count(*) FROM time_slots WHERE court_id=$1 AND is_active`, court) != 4 {
		t.Fatal("audit failure did not roll back policy and templates")
	}
	mustCall(t, r, "DELETE", "/admin/courts/"+court, "", 500)
	if count(t, db, `SELECT count(*) FROM courts WHERE id=$1 AND is_active`, court) != 1 {
		t.Fatal("audit failure did not roll back delete")
	}
	mustCall(t, r, "POST", "/admin/sport-types", `{"name":"Badminton"}`, 500)
	if count(t, db, `SELECT count(*) FROM sport_types WHERE name='Badminton'`) != 0 {
		t.Fatal("audit failure did not roll back create")
	}
}

func TestConcurrentSportDeactivationAndCourtCreation(t *testing.T) {
	db, r := inventoryDB(t)
	for i := 0; i < 8; i++ {
		id := createSport(t, r, fmt.Sprintf("Sport%d", i))
		var wg sync.WaitGroup
		wg.Add(2)
		statuses := make(chan int, 2)
		go func() {
			defer wg.Done()
			status, _, _ := call(r, "DELETE", "/admin/sport-types/"+id, "")
			statuses <- status
		}()
		go func() {
			defer wg.Done()
			status, _, _ := call(r, "POST", "/admin/courts", fmt.Sprintf(`{"sportTypeId":%q,"code":"C%d","name":"Court"}`, id, i))
			statuses <- status
		}()
		wg.Wait()
		close(statuses)
		for status := range statuses {
			if status != 201 && status != 204 && status != 409 {
				t.Fatalf("concurrent mutation status %d", status)
			}
		}
		if count(t, db, `SELECT count(*) FROM courts c JOIN sport_types s ON s.id=c.sport_type_id WHERE c.is_active AND NOT s.is_active`) != 0 {
			t.Fatal("active court references inactive sport")
		}
	}
}
