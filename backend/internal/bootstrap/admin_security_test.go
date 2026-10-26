package bootstrap

import (
	"net/http/httptest"
	"strings"
	"testing"
)

// Exercise the actual router and current database role for every admin operation.
func TestAdminRoutesRejectUnprivilegedAndRevokedRoles(t *testing.T) {
	r, db := testServer(t)
	id, token := registerLogin(t, r, "admin-security@example.com")
	court := "10000000-0000-4000-8000-000000000001"
	routes := [][2]string{
		{"GET", "/sport-types"}, {"POST", "/sport-types"}, {"PATCH", "/sport-types/" + court}, {"DELETE", "/sport-types/" + court},
		{"GET", "/courts"}, {"POST", "/courts"}, {"PATCH", "/courts/" + court}, {"DELETE", "/courts/" + court},
		{"GET", "/courts/" + court + "/operating-hours"}, {"PUT", "/courts/" + court + "/operating-hours"},
		{"GET", "/courts/" + court + "/blackouts"}, {"POST", "/courts/" + court + "/blackouts"},
		{"PATCH", "/courts/" + court + "/blackouts/" + court}, {"DELETE", "/courts/" + court + "/blackouts/" + court},
		{"GET", "/bookings"}, {"GET", "/bookings/" + court}, {"POST", "/bookings/" + court + "/cancel"}, {"GET", "/statistics"},
	}
	call := func(method, path, tok string, want int) {
		t.Helper()
		req := httptest.NewRequest(method, "/api/v1/admin"+path, strings.NewReader(`{}`))
		req.Header.Set("Content-Type", "application/json")
		if tok != "" {
			req.Header.Set("Authorization", "Bearer "+tok)
		}
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		if rec.Code != want {
			t.Fatalf("%s %s: got %d want %d: %s", method, path, rec.Code, want, rec.Body.String())
		}
	}
	for _, route := range routes {
		call(route[0], route[1], "", 401)
		call(route[0], route[1], token, 403)
	}
	if _, err := db.Exec("UPDATE users SET role='ADMIN' WHERE id=$1", id); err != nil {
		t.Fatal(err)
	}
	// Existing USER JWT gains current DB permissions, then loses them on revocation.
	call("GET", "/sport-types", token, 200)
	if _, err := db.Exec("UPDATE users SET role='USER' WHERE id=$1", id); err != nil {
		t.Fatal(err)
	}
	for _, route := range routes {
		call(route[0], route[1], token, 403)
	}
}
