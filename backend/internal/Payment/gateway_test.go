package payment

import (
	"net/url"
	"testing"
)

func TestVNPAYCallbackCanonicalEncoding(t *testing.T) {
	// Independent fixture generated from the form-encoded fields and a test-only key.
	const signed = "vnp_Amount=1500000&vnp_OrderInfo=Deposit+%3A+SB123&vnp_ResponseCode=00&vnp_TmnCode=TEST1234&vnp_TransactionNo=1234&vnp_TransactionStatus=00&vnp_TxnRef=SB123"
	values, err := url.ParseQuery(signed)
	if err != nil {
		t.Fatal(err)
	}
	values.Set("vnp_SecureHash", "a77a0fe15b618a3208b980e3071f75c762eea2e6264e61f96740a467518187724ad53c82065f3791598fd71d82820cc2e5254eb95fc22da8dc347a2a9c655fc1")
	gateway := NewVNPAYGateway(VNPAYConfig{TMNCode: "TEST1234", HashSecret: "unit-test-secret"}, nil)
	event, err := gateway.Verify(values)
	if err != nil || event.AmountMinor != 1500000 || event.OrderRef != "SB123" {
		t.Fatalf("valid callback = %+v, %v", event, err)
	}
	values.Set("vnp_Amount", "100")
	if _, err := gateway.Verify(values); err == nil {
		t.Fatal("changed amount accepted under original signature")
	}
}
