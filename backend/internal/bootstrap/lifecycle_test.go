package bootstrap

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	notification "github.com/Sukuna092main/sport-booking-system/backend/internal/Notification"
	payment "github.com/Sukuna092main/sport-booking-system/backend/internal/Payment"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/config"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/testdb"
)

type lifecycleMailbox struct {
	messages []notification.EmailMessage
	fail     bool
}

func (m *lifecycleMailbox) Send(_ context.Context, message notification.EmailMessage) error {
	if m.fail {
		return errors.New("SMTP unavailable")
	}
	m.messages = append(m.messages, message)
	return nil
}

func TestBackendIntegrationLifecycle(t *testing.T) {
	db := testdb.Open(t)
	testdb.SeedCourts(t, db)
	clock := time.Date(2026, 10, 8, 0, 0, 0, 0, time.UTC)
	now := func() time.Time { return clock }
	key := base64.StdEncoding.EncodeToString(make([]byte, 32))
	cfg := config.Config{
		AppName: "lifecycle-test", Environment: "test", AppTimezone: "Asia/Ho_Chi_Minh",
		JWTSecret: strings.Repeat("t", 32), JWTTTL: 15 * time.Minute,
		RefreshTokenTTL: time.Hour, PasswordResetTTL: 15 * time.Minute, FrontendPublicURL: "http://localhost:5173",
		PaymentEnabled: true, PaymentProvider: "stripe", PaymentDepositBPS: 3000, PaymentHoldTTL: 35 * time.Minute,
		StripeSecretKey: "sk_test_fixture", StripeWebhookSecret: "whsec_fixture", EmailEnabled: true, EmailEncryptionKey: key, CORSAllowedOrigins: []string{"http://localhost:5173"},
	}
	r := newRouter(cfg, slog.New(slog.NewTextHandler(io.Discard, nil)), db, now)
	call := func(method, path, body, bearer string, cookie *http.Cookie, want int) (*http.Cookie, map[string]any) {
		t.Helper()
		req := httptest.NewRequest(method, "/api/v1"+path, strings.NewReader(body))
		req.Header.Set("Origin", "http://localhost:5173")
		if body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		if bearer != "" {
			req.Header.Set("Authorization", "Bearer "+bearer)
		}
		if cookie != nil {
			req.AddCookie(cookie)
		}
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		if rec.Code != want {
			t.Fatalf("%s %s = %d, want %d: %s", method, path, rec.Code, want, rec.Body.String())
		}
		var result struct{ Data map[string]any }
		if rec.Body.Len() > 0 {
			if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
				t.Fatal(err)
			}
		}
		for _, c := range rec.Result().Cookies() {
			if c.Name == "sb_refresh_token" {
				return c, result.Data
			}
		}
		return nil, result.Data
	}
	const email = "lifecycle@example.test"
	_, _ = registerLogin(t, r, email)
	login := func(password string) (*http.Cookie, string) {
		c, data := call("POST", "/auth/login", `{"email":"`+email+`","password":"`+password+`"}`, "", nil, 200)
		if c == nil || !c.HttpOnly {
			t.Fatal("missing HttpOnly refresh cookie")
		}
		return c, data["accessToken"].(string)
	}
	initial, _ := login("password123")
	rotated, data := call("POST", "/auth/refresh", "", "", initial, 200)
	if rotated == nil || rotated.Value == initial.Value {
		t.Fatal("refresh did not rotate cookie")
	}
	call("POST", "/auth/refresh", "", "", initial, 401)
	call("GET", "/users/me", "", data["accessToken"].(string), nil, 401)
	call("POST", "/auth/refresh", "", "", rotated, 401)
	cookie, access := login("password123")
	call("POST", "/auth/logout", "", "", cookie, 200)
	call("GET", "/users/me", "", access, nil, 401)

	mailbox := &lifecycleMailbox{}
	cipher, err := notification.NewEncryptor(key)
	if err != nil {
		t.Fatal(err)
	}
	worker := notification.NewWorker(db, mailbox, cipher)
	process := func(want bool) {
		t.Helper()
		processed, err := worker.ProcessOne(context.Background())
		if err != nil || processed != want {
			t.Fatalf("outbox work=%t want=%t err=%v", processed, want, err)
		}
	}
	_, oldAccess := login("password123")
	_, known := call("POST", "/auth/forgot-password", `{"email":"`+email+`"}`, "", nil, 202)
	_, unknown := call("POST", "/auth/forgot-password", `{"email":"missing@example.test"}`, "", nil, 202)
	if known["message"] != unknown["message"] {
		t.Fatal("account recovery responses diverged")
	}
	process(true)
	if len(mailbox.messages) != 1 {
		t.Fatal("expected one recovery email")
	}
	_, token, found := strings.Cut(mailbox.messages[0].TextBody, "?token=")
	if !found || token == "" {
		t.Fatal("reset link missing")
	}
	reset := `{"token":"` + token + `","newPassword":"nextPassword123"}`
	call("POST", "/auth/reset-password", reset, "", nil, 200)
	call("POST", "/auth/reset-password", reset, "", nil, 400)
	call("GET", "/users/me", "", oldAccess, nil, 401)
	anotherCookie, access := login("nextPassword123")
	call("POST", "/auth/change-password", `{"currentPassword":"nextPassword123","newPassword":"changedPassword123"}`, access, nil, 200)
	call("POST", "/auth/refresh", "", "", anotherCookie, 401)
	firstDevice, _ := login("changedPassword123")
	secondDevice, access := login("changedPassword123")
	call("POST", "/auth/logout-all", "", access, secondDevice, 200)
	call("POST", "/auth/refresh", "", "", firstDevice, 401)
	_, access = login("changedPassword123")

	execBooking(t, db, `INSERT INTO court_pricing(court_id,price_per_slot_vnd) VALUES ($1,50000)`, fixtureCourt)
	slots := slotIDs(t, db, fixtureCourt, 6, 8, 9)
	book := mustBooking(t, r, "POST", "/api/v1/bookings", bookingBody(t, fixtureCourt, "2026-10-10", slots[:1]), access, "paid-lifecycle", 201)
	if book.Status != "PENDING_PAYMENT" || book.DepositAmountVND == nil || *book.DepositAmountVND != 15000 {
		t.Fatalf("unexpected booking: %+v", book)
	}
	path := "/bookings/" + book.ID
	_, otherToken := registerLogin(t, r, "other-payment@example.test")
	call("GET", path+"/payments", "", otherToken, nil, 404)
	_, beforePayment := call("GET", path+"/payments", "", access, nil, 200)
	if beforePayment["bookingId"] != book.ID || beforePayment["depositAmountVnd"] != float64(15000) || beforePayment["holdExpiresAt"] == nil {
		t.Fatal("payment status missing FE data")
	}

	repo := payment.NewRepository(db, nil, now, true)
	attempt, _, err := repo.StartAttempt(context.Background(), book.CustomerID, book.ID, "stripe", "test_order_paid")
	if err != nil {
		t.Fatal(err)
	}
	same, _, err := repo.StartAttempt(context.Background(), book.CustomerID, book.ID, "stripe", "unused_retry_ref")
	if err != nil || same.ID != attempt.ID {
		t.Fatal("attempt retry", err)
	}
	webhook := func(order string, amount int64, eventID, sessionID string) {
		t.Helper()
		body, _ := json.Marshal(map[string]any{"id": eventID, "type": "checkout.session.completed", "data": map[string]any{"object": map[string]any{"id": sessionID, "object": "checkout.session", "client_reference_id": order, "amount_total": amount, "currency": "vnd", "payment_status": "paid"}}})
		stamp := fmt.Sprint(time.Now().Unix())
		mac := hmac.New(sha256.New, []byte("whsec_fixture"))
		mac.Write([]byte(stamp + "."))
		mac.Write(body)
		req := httptest.NewRequest("POST", "/api/v1/payments/stripe/webhook", strings.NewReader(string(body)))
		req.Header.Set("Stripe-Signature", "t="+stamp+",v1="+hex.EncodeToString(mac.Sum(nil)))
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		if rec.Code != 200 {
			t.Fatalf("webhook %d: %s", rec.Code, rec.Body.String())
		}
	}
	webhook(attempt.ProviderOrderRef, attempt.AmountVND, "evt_paid", "cs_paid")
	webhook(attempt.ProviderOrderRef, attempt.AmountVND, "evt_paid", "cs_paid")

	final := mustBooking(t, r, "GET", "/api/v1"+path, "", access, "", 200)
	_, paidSummary := call("GET", path+"/payments", "", access, nil, 200)
	if paidSummary["bookingStatus"] != "CONFIRMED" || paidSummary["totalAmountVnd"] != float64(50000) || paidSummary["remainingAmountVnd"] != float64(35000) {
		t.Fatal("incorrect paid summary")
	}
	paymentData, ok := paidSummary["payment"].(map[string]any)
	if !ok || paymentData["provider"] != "stripe" || paymentData["status"] != "PAID" || paymentData["paidAt"] == nil {
		t.Fatal("payment status missing settlement data")
	}
	if final.Status != "CONFIRMED" {
		t.Fatal(final.Status)
	}
	var queued int
	if err := db.QueryRow(`SELECT count(*) FROM email_outbox WHERE event_type='BOOKING_REMINDER_24H'`).Scan(&queued); err != nil || queued != 1 {
		t.Fatalf("reminders %d: %v", queued, err)
	}
	execBooking(t, db, `UPDATE email_outbox SET scheduled_at=clock_timestamp()+interval '1 day' WHERE event_type='BOOKING_REMINDER_24H'`)
	mailbox.fail = true
	process(true)
	mailbox.fail = false
	execBooking(t, db, `UPDATE email_outbox SET scheduled_at=clock_timestamp() WHERE event_type='BOOKING_CONFIRMED'`)
	process(true)
	mustBooking(t, r, "POST", "/api/v1"+path+"/cancel", "", access, "", 200)
	process(true)
	execBooking(t, db, `UPDATE email_outbox SET scheduled_at=clock_timestamp() WHERE event_type='BOOKING_REMINDER_24H'`)
	process(true)
	process(false)
	if len(mailbox.messages) != 3 {
		t.Fatalf("expected recovery, confirmation and cancellation only, got %d", len(mailbox.messages))
	}

	pending := mustBooking(t, r, "POST", "/api/v1/bookings", bookingBody(t, fixtureCourt, "2026-10-10", slots[1:]), access, "unpaid-lifecycle", 201)
	late, _, err := repo.StartAttempt(context.Background(), pending.CustomerID, pending.ID, "stripe", "test_order_late")
	if err != nil {
		t.Fatal(err)
	}
	clock = clock.Add(36 * time.Minute)
	if count, err := repo.ExpireHolds(context.Background(), 100); err != nil || count != 1 {
		t.Fatalf("expiry count=%d err=%v", count, err)
	}
	webhook(late.ProviderOrderRef, late.AmountVND, "evt_late", "cs_late")

	_, access = login("changedPassword123")
	expired := mustBooking(t, r, "GET", "/api/v1/bookings/"+pending.ID, "", access, "", 200)
	if expired.Status != "EXPIRED" {
		t.Fatal(expired.Status)
	}
	var status string
	if err := db.QueryRow(`SELECT status FROM payments WHERE booking_id=$1`, pending.ID).Scan(&status); err != nil || status != "PAID_REVIEW" {
		t.Fatalf("late attempt status=%s err=%v", status, err)
	}
}
