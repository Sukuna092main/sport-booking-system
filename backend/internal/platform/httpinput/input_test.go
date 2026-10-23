package httpinput

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, body := range []string{`null`, `[]`, `{}`, `{"name":"Huy"}`, `{"unknown":1}`, `{"name":1}`, `{"name":"Huy"} {}`, strings.Repeat(" ", 17000)} {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest("POST", "/", strings.NewReader(body))
		c.Request.Header.Set("Content-Type", "application/json")
		var value struct {
			Name string `json:"name"`
		}
		err := JSON(c, &value)
		want := body == `{}` || body == `{"name":"Huy"}`
		if (err == nil) != want {
			t.Errorf("body %.40s: %v", body, err)
		}
	}
}
