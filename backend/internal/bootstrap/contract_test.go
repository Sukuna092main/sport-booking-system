package bootstrap

import (
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/openapi"
	"github.com/goccy/go-yaml"
	"regexp"
	"strings"
	"testing"
)

func TestImplementedContractMatchesRouter(t *testing.T) {
	r := testRouter(t)
	routes := map[string]bool{}
	for _, route := range r.Routes() {
		routes[route.Method+" "+route.Path] = true
	}
	var spec map[string]any
	if err := yaml.Unmarshal(openapi.Spec, &spec); err != nil {
		t.Fatal(err)
	}
	params := regexp.MustCompile(`\{([^}]+)\}`)
	for path, raw := range spec["paths"].(map[string]any) {
		for method, rawOp := range raw.(map[string]any) {
			op, ok := rawOp.(map[string]any)
			if !ok || op["x-implementation-status"] != "implemented" {
				continue
			}
			key := strings.ToUpper(method) + " /api/v1" + params.ReplaceAllString(path, ":$1")
			if !routes[key] {
				t.Error("contract marks an unregistered endpoint implemented:", key)
			}
			delete(routes, key)
		}
	}
	delete(routes, "GET /api/v1/docs")
	delete(routes, "GET /api/v1/openapi.yaml")
	if len(routes) != 0 {
		t.Fatal("undocumented business routes", routes)
	}
}
