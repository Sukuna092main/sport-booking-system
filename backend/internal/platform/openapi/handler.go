package openapi

import (
	_ "embed"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Spec is the single source of truth for the API contract.
//
//go:embed openapi.yaml
var Spec []byte

const swaggerPage = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sport Booking API · Swagger</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css">
  <style>body { margin: 0; background: #fafafa; } .notice { padding: 12px 24px; font: 14px sans-serif; background: #fff3cd; }</style>
</head>
<body>
  <div class="notice">Contract v0.2 đang chờ review. Chỉ GET /api/v1/ping đã được triển khai; các operation khác là thiết kế dự kiến.</div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: '/api/v1/openapi.yaml',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'StandaloneLayout'
      });
    };
  </script>
</body>
</html>`

func Register(v1 *gin.RouterGroup) {
	v1.GET("/openapi.yaml", func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		c.Data(http.StatusOK, "application/yaml; charset=utf-8", Spec)
	})
	v1.GET("/docs", func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(swaggerPage))
	})
}
