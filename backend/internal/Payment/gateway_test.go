package payment

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestStripeSignatureAndAmount(t *testing.T) {
	now := time.Now()
	gateway := NewStripeGateway("sk_test_fixture", "whsec_fixture", "http://localhost:5173")
	gateway.now = func() time.Time { return now }
	body := []byte(`{"id":"evt_1","type":"checkout.session.completed","data":{"object":{"id":"cs_1","object":"checkout.session","client_reference_id":"order_1","amount_total":15000,"currency":"vnd","payment_status":"paid"}}}`)
	stamp := fmt.Sprint(now.Unix())
	mac := hmac.New(sha256.New, []byte("whsec_fixture"))
	mac.Write([]byte(stamp + "."))
	mac.Write(body)
	signature := "t=" + stamp + ",v1=" + hex.EncodeToString(mac.Sum(nil))
	event, err := gateway.Verify(body, signature)
	if err != nil || event.AmountMinor != 15000 || event.OrderRef != "order_1" {
		t.Fatalf("%+v %v", event, err)
	}
	if _, err = gateway.Verify(append(body, ' '), signature); err == nil {
		t.Fatal("tampered payload accepted")
	}
	gateway.now = func() time.Time { return now.Add(6 * time.Minute) }
	if _, err = gateway.Verify(body, signature); err == nil {
		t.Fatal("stale signature accepted")
	}
}

type checkoutTransport func(*http.Request) (*http.Response, error)

func (fn checkoutTransport) RoundTrip(req *http.Request) (*http.Response, error) { return fn(req) }
func TestStripeCheckoutRequest(t *testing.T) {
	now := time.Now()
	gateway := NewStripeGateway("sk_test_fixture", "whsec_fixture", "http://localhost:5173")
	gateway.now = func() time.Time { return now }
	var requestKey string
	gateway.client = &http.Client{Transport: checkoutTransport(func(req *http.Request) (*http.Response, error) {
		t.Helper()
		if req.URL.String() != "https://api.stripe.com/v1/checkout/sessions" || req.Method != "POST" {
			t.Fatal("unexpected Stripe endpoint")
		}
		user, _, ok := req.BasicAuth()
		if !ok || user != "sk_test_fixture" {
			t.Fatal("Stripe API authorization missing")
		}
		raw, err := io.ReadAll(req.Body)
		if err != nil {
			t.Fatal(err)
		}
		values, err := url.ParseQuery(string(raw))
		if err != nil {
			t.Fatal(err)
		}
		if values.Get("line_items[0][price_data][currency]") != "vnd" || values.Get("line_items[0][price_data][unit_amount]") != "15000" {
			t.Fatal("incorrect VND encoding")
		}
		if values.Get("client_reference_id") != "order_1" || req.Header.Get("Idempotency-Key") != "order_1" {
			t.Fatal("unstable payment reference")
		}
		requestKey = req.Header.Get("Idempotency-Key")
		redirect, err := url.Parse(values.Get("success_url"))
		if err != nil {
			t.Fatal(err)
		}
		if redirect.Query().Get("bookingId") != "booking_1" || redirect.Query().Get("ref") != "order_1" {
			t.Fatal("FE return correlation missing")
		}
		if values.Get("allowed_payment_method_types[0]") != "card" {
			t.Fatal("expected card Checkout")
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"id":"cs_test_1","url":"https://checkout.stripe.com/c/pay/cs_test_1"}`)), Header: make(http.Header)}, nil
	})}
	input := PaymentRequest{BookingID: "booking_1", OrderRef: "order_1", BookingCode: "SB1", AmountVND: 15000, ExpiresAt: now.Add(35 * time.Minute)}
	checkout, err := gateway.CreatePayment(context.Background(), input)
	if err != nil || checkout == "" {
		t.Fatalf("checkout %q %v", checkout, err)
	}
	if _, err = gateway.CreatePayment(context.Background(), input); err != nil || requestKey != "order_1" {
		t.Fatal("retry", err)
	}
	input.ExpiresAt = now.Add(20 * time.Minute)
	if _, err = gateway.CreatePayment(context.Background(), input); err == nil {
		t.Fatal("accepted checkout with insufficient time")
	}
}
