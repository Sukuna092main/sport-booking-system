package response

import "github.com/gin-gonic/gin"

type Detail struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

type apiError struct {
	Code      string   `json:"code"`
	Message   string   `json:"message"`
	RequestID string   `json:"requestId"`
	Details   []Detail `json:"details,omitempty"`
}

// Error writes the common API error shape and preserves the request ID from middleware.
func Error(c *gin.Context, status int, code, message string, details ...Detail) {
	c.AbortWithStatusJSON(status, gin.H{"error": apiError{
		Code: code, Message: message, RequestID: c.GetString("request_id"), Details: details,
	}})
}

// Data writes the common success envelope for business endpoints.
func Data(c *gin.Context, status int, value any) {
	c.JSON(status, gin.H{"data": value})
}
