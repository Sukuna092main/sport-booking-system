// Package testdb creates an isolated schema in a deliberately selected local/CI database.
// It never uses DATABASE_URL or the shared Neon database.
package testdb

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
)

func Open(t *testing.T) *sql.DB {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set TEST_DATABASE_URL for isolated PostgreSQL integration tests")
	}
	cfg, err := pgx.ParseConfig(url)
	if err != nil {
		t.Fatal("invalid TEST_DATABASE_URL")
	}
	if !strings.HasSuffix(cfg.Database, "_test") || (cfg.Host != "localhost" && cfg.Host != "127.0.0.1" && cfg.Host != "::1" && cfg.Host != "postgres") {
		t.Fatal("integration tests require a local/CI host and a database ending in _test")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	admin := stdlib.OpenDB(*cfg)
	tx, err := admin.BeginTx(ctx, nil)
	if err != nil {
		admin.Close()
		t.Fatal(err)
	}
	for _, query := range []string{"SELECT pg_advisory_xact_lock(672601)", "CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public", "CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public"} {
		if _, err = tx.ExecContext(ctx, query); err != nil {
			tx.Rollback()
			admin.Close()
			t.Fatal(err)
		}
	}
	if err = tx.Commit(); err != nil {
		admin.Close()
		t.Fatal(err)
	}
	var bytes [8]byte
	if _, err = rand.Read(bytes[:]); err != nil {
		t.Fatal(err)
	}
	schema := "test_" + hex.EncodeToString(bytes[:])
	if _, err = admin.ExecContext(ctx, "CREATE SCHEMA "+schema); err != nil {
		admin.Close()
		t.Fatal(err)
	}
	cfg.RuntimeParams["search_path"] = schema + ",public"
	db := stdlib.OpenDB(*cfg)
	db.SetMaxOpenConns(5)
	t.Cleanup(func() {
		db.Close()
		cleanup, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if _, err := admin.ExecContext(cleanup, "DROP SCHEMA "+schema+" CASCADE"); err != nil {
			t.Errorf("test schema cleanup: %v", err)
		}
		admin.Close()
	})
	_, source, _, _ := runtime.Caller(0)
	paths, err := filepath.Glob(filepath.Join(filepath.Dir(source), "../../..", "migrations", "*.sql"))
	if err != nil || len(paths) == 0 {
		t.Fatal("migrations not found")
	}
	for _, path := range paths {
		contents, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		up := strings.Split(strings.Split(string(contents), "-- +goose Up")[1], "-- +goose Down")[0]
		if _, err = db.ExecContext(ctx, up); err != nil {
			t.Fatalf("migration %s: %v", filepath.Base(path), err)
		}
	}
	return db
}

func SeedCourts(t *testing.T, db *sql.DB) {
	t.Helper()
	_, source, _, _ := runtime.Caller(0)
	contents, err := os.ReadFile(filepath.Join(filepath.Dir(source), "../../..", "testdata", "court_foundation.sql"))
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if _, err = db.ExecContext(ctx, string(contents)); err != nil {
		t.Fatal("court fixtures:", err)
	}
}
