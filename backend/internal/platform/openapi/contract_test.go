package openapi

import (
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/goccy/go-yaml"
)

func TestEmbeddedOpenAPIContract(t *testing.T) {
	var spec map[string]any
	if err := yaml.Unmarshal(Spec, &spec); err != nil {
		t.Fatal(err)
	}
	if spec["openapi"] != "3.0.3" {
		t.Fatal("unexpected OpenAPI version")
	}
	var walk func(any)
	walk = func(value any) {
		switch v := value.(type) {
		case map[string]any:
			if ref, ok := v["$ref"].(string); ok {
				if !strings.HasPrefix(ref, "#/") {
					t.Fatal("unexpected external ref", ref)
				}
				var node any = spec
				for _, part := range strings.Split(ref[2:], "/") {
					part = strings.ReplaceAll(strings.ReplaceAll(part, "~1", "/"), "~0", "~")
					object, ok := node.(map[string]any)
					if !ok {
						t.Fatal("invalid ref", ref)
					}
					node, ok = object[part]
					if !ok {
						t.Fatal("missing ref", ref)
					}
				}
			}
			for _, child := range v {
				walk(child)
			}
		case []any:
			for _, child := range v {
				walk(child)
			}
		}
	}
	walk(spec)
	expected := map[string]bool{"ping": true, "register": true, "login": true, "getMyProfile": true, "updateMyProfile": true, "listSportTypes": true, "listCourts": true, "getCourt": true, "getCourtAvailability": true}
	seen := map[string]bool{}
	for _, raw := range spec["paths"].(map[string]any) {
		for method, value := range raw.(map[string]any) {
			if !strings.Contains(" get post patch put delete ", " "+method+" ") {
				continue
			}
			op := value.(map[string]any)
			id := op["operationId"].(string)
			if seen[id] {
				t.Fatal("duplicate operation ID", id)
			}
			seen[id] = true
			status := op["x-implementation-status"]
			if expected[id] != (status == "implemented") {
				t.Fatal("implementation status mismatch", id, status)
			}
			for code := range op["responses"].(map[string]any) {
				if _, err := strconv.Atoi(code); err != nil {
					t.Fatal("invalid HTTP status", id, code)
				}
			}
		}
	}
	for id := range expected {
		if !seen[id] {
			t.Fatal("missing operation", id)
		}
	}
}

func TestSwaggerEndpoints(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	Register(r.Group("/api/v1"))
	for _, path := range []string{"/api/v1/docs", "/api/v1/openapi.yaml"} {
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, httptest.NewRequest("GET", path, nil))
		if rec.Code != 200 || rec.Header().Get("Cache-Control") != "no-store" {
			t.Fatal(path, rec.Code)
		}
	}
}
