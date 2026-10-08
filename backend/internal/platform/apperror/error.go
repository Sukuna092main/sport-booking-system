// Package apperror defines safe errors that can be returned to API clients.
package apperror

import (
	"errors"
	"net/http"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/response"
	"github.com/gin-gonic/gin"
)

type Error struct {
	Status  int
	Code    string
	Message string
	Details []response.Detail
}

func (e *Error) Error() string { return e.Code }

func New(status int, code, message string) error {
	return &Error{Status: status, Code: code, Message: message}
}

func Invalid(field, message string) error {
	return &Error{Status: http.StatusBadRequest, Code: "validation_error", Message: "Dữ liệu không hợp lệ.", Details: []response.Detail{{Field: field, Message: message}}}
}

// Write never includes SQL, connection strings or credentials in responses.
func Write(c *gin.Context, err error) {
	var safe *Error
	if errors.As(err, &safe) {
		response.Error(c, safe.Status, safe.Code, safe.Message, safe.Details...)
		return
	}
	response.Error(c, http.StatusInternalServerError, "internal_error", "Có lỗi hệ thống. Vui lòng thử lại.")
}
