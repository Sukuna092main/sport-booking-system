package httpinput

import (
	"bytes"
	"encoding/json"
	"io"
	"mime"
	"net/http"
	"regexp"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/gin-gonic/gin"
)

var uuidPattern = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

func UUID(value string) bool { return uuidPattern.MatchString(value) }

// JSON accepts one small JSON object and rejects unknown fields and trailing data.
func JSON(c *gin.Context, target any) error {
	mediaType, _, err := mime.ParseMediaType(c.GetHeader("Content-Type"))
	if err != nil || mediaType != "application/json" {
		return apperror.Invalid("body", "Content-Type phải là application/json.")
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 16*1024)
	raw, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return apperror.Invalid("body", "JSON tối đa 16 KiB.")
	}
	// Reject null, arrays and scalar values, including for PATCH.
	var object map[string]json.RawMessage
	if err := json.Unmarshal(raw, &object); err != nil || object == nil {
		return apperror.Invalid("body", "Phải gửi một JSON object hợp lệ.")
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return apperror.Invalid("body", "JSON sai cấu trúc hoặc có trường không được hỗ trợ.")
	}
	return nil
}
