package inventory

import (
	"encoding/json"
	"testing"
)

func TestRejectNULText(t *testing.T) {
	for _, field := range []string{"name", "description", "code"} {
		raw, _ := json.Marshal("bad\x00text")
		if err := checkFields(Fields{field: raw}, true, false); err == nil {
			t.Fatalf("accepted NUL in %s", field)
		}
	}
}
