package bootstrap

import (
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/testdb"
	"strings"
	"testing"
)

const fixtureCourt = "20000000-0000-4000-8000-000000000001"

func TestCourtBrowseHTTP(t *testing.T) {
	r, db := testServer(t)
	testdb.SeedCourts(t, db)
	status, result := request(t, r, "GET", "/api/v1/sport-types", "", "")
	if status != 200 || len(result["data"].([]any)) != 2 {
		t.Fatal(status, result)
	}
	for _, tc := range []struct {
		query  string
		length int
		total  float64
	}{
		{"", 2, 2}, {"?q=badminton", 1, 1}, {"?q=BD-01", 1, 1}, {"?q=%25", 0, 0}, {"?q=%27%20OR%201%3D1", 0, 0},
		{"?sportTypeId=11000000-0000-4000-8000-000000000002", 1, 1}, {"?page=1&pageSize=1", 1, 2}, {"?page=2&pageSize=1", 1, 2}, {"?page=3&pageSize=1", 0, 2},
	} {
		status, result = request(t, r, "GET", "/api/v1/courts"+tc.query, "", "")
		if status != 200 || len(result["data"].([]any)) != tc.length || result["meta"].(map[string]any)["total"] != tc.total {
			t.Fatal(tc.query, status, result)
		}
	}
	status, result = request(t, r, "GET", "/api/v1/courts?pageSize=1", "", "")
	if result["data"].([]any)[0].(map[string]any)["code"] != "BD-01" {
		t.Fatal("unstable ordering", status, result)
	}
	for _, query := range []string{"?sportTypeId=invalid", "?page=0", "?page=1.5", "?page=-1", "?page=999999999999999999999", "?page=", "?page=1&page=2", "?pageSize=101", "?q=" + strings.Repeat("a", 101)} {
		status, _ = request(t, r, "GET", "/api/v1/courts"+query, "", "")
		if status != 400 {
			t.Fatal(query, status)
		}
	}
	status, result = request(t, r, "GET", "/api/v1/courts/"+fixtureCourt, "", "")
	if status != 200 || result["data"].(map[string]any)["referencePriceAmount"] != "100000" {
		t.Fatal(status, result)
	}
	for _, id := range []string{"20000000-0000-4000-8000-000000000003", "20000000-0000-4000-8000-000000000004", "99999999-9999-4999-8999-999999999999"} {
		status, _ = request(t, r, "GET", "/api/v1/courts/"+id, "", "")
		if status != 404 {
			t.Fatal(id, status)
		}
	}
	status, _ = request(t, r, "GET", "/api/v1/courts/invalid", "", "")
	if status != 400 {
		t.Fatal(status)
	}
}
