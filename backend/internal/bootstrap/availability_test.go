package bootstrap

import (
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/testdb"
	"testing"
	"time"
)

func TestAvailabilityHTTP(t *testing.T) {
	r, db := testServer(t)
	testdb.SeedCourts(t, db)
	path := "/api/v1/courts/" + fixtureCourt + "/availability"
	status, result := request(t, r, "GET", path+"?date=2026-10-09", "", "")
	if status != 200 {
		t.Fatal(status, result)
	}
	data := result["data"].(map[string]any)
	if data["timeZone"] != "Asia/Ho_Chi_Minh" || data["date"] != "2026-10-09" || data["courtId"] != fixtureCourt {
		t.Fatal(data)
	}
	slots := data["slots"].([]any)
	if len(slots) != 6 {
		t.Fatal("exclude inactive/outside-hours templates", slots)
	}
	want := []bool{true, false, false, false, false, true}
	for i, raw := range slots {
		slot := raw.(map[string]any)
		if slot["available"] != want[i] {
			t.Fatalf("slot %d: %v", i, slot)
		}
		start, err := time.Parse(time.RFC3339, slot["startsAt"].(string))
		if err != nil || start.Hour() != i {
			t.Fatal("UTC ordering", slot, err)
		}
	}
	for _, date := range []string{"2026-10-08", "2026-11-07"} {
		status, _ = request(t, r, "GET", path+"?date="+date, "", "")
		if status != 200 {
			t.Fatal(date, status)
		}
	}
	for _, query := range []string{"", "?date=", "?date=2026-10-07", "?date=2026-11-08", "?date=2026-02-30", "?date=2026-10-9", "?date=2026-10-09&date=2026-10-10"} {
		status, _ = request(t, r, "GET", path+query, "", "")
		if status != 400 {
			t.Fatal(query, status)
		}
	}
	for _, id := range []string{"20000000-0000-4000-8000-000000000003", "20000000-0000-4000-8000-000000000004", "99999999-9999-4999-8999-999999999999"} {
		status, _ = request(t, r, "GET", "/api/v1/courts/"+id+"/availability?date=2026-10-09", "", "")
		if status != 404 {
			t.Fatal(id, status)
		}
	}
	status, _ = request(t, r, "GET", "/api/v1/courts/bad/availability?date=2026-10-09", "", "")
	if status != 400 {
		t.Fatal(status)
	}
	if _, err := db.Exec("UPDATE court_operating_hours SET is_active=false WHERE court_id=$1 AND weekday=6", fixtureCourt); err != nil {
		t.Fatal(err)
	}
	status, result = request(t, r, "GET", path+"?date=2026-10-10", "", "")
	if status != 200 || len(result["data"].(map[string]any)["slots"].([]any)) != 0 {
		t.Fatal("closed day", result)
	}
	if _, err := db.Exec(`UPDATE booking_slots SET released_at=now() WHERE booking_id='30000000-0000-4000-8000-000000000001'`); err != nil {
		t.Fatal(err)
	}
	status, result = request(t, r, "GET", path+"?date=2026-10-09", "", "")
	if status != 200 || result["data"].(map[string]any)["slots"].([]any)[2].(map[string]any)["available"] != true {
		t.Fatal("released booking blocks", result)
	}
	if _, err := db.Exec(`UPDATE bookings SET status='CANCELLED',cancelled_at=now() WHERE booking_code='FIX-OLD-TEMPLATE'`); err != nil {
		t.Fatal(err)
	}
	status, result = request(t, r, "GET", path+"?date=2026-10-09", "", "")
	if status != 200 {
		t.Fatal(status, result)
	}
	for _, i := range []int{3, 4} {
		if result["data"].(map[string]any)["slots"].([]any)[i].(map[string]any)["available"] != true {
			t.Fatal("cancelled old template blocks", i, result)
		}
	}
}
