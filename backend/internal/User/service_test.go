package user

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/testdb"
)

func TestConcurrentProfileFields(t *testing.T) {
	db := testdb.Open(t)
	repo := NewRepository(db)
	ctx := context.Background()
	u, err := repo.Create(ctx, "profile@example.test", "fixture-not-for-login", "Original", nil)
	if err != nil {
		t.Fatal(err)
	}
	s := NewService(repo)
	done := make(chan error, 2)
	for _, fields := range []map[string]json.RawMessage{{"fullName": json.RawMessage(`"New name"`)}, {"phone": json.RawMessage(`"0901234567"`)}} {
		go func(fields map[string]json.RawMessage) { _, err := s.Update(ctx, u.ID, fields); done <- err }(fields)
	}
	for i := 0; i < 2; i++ {
		if err := <-done; err != nil {
			t.Fatal(err)
		}
	}
	updated, err := s.Get(ctx, u.ID)
	if err != nil || updated.FullName != "New name" || updated.Phone == nil || *updated.Phone != "0901234567" || !updated.UpdatedAt.After(u.UpdatedAt) {
		t.Fatal("concurrent PATCH lost a field or updatedAt", updated, err)
	}
}
