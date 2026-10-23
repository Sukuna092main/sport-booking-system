# response

`response.go` cung cấp success envelope `{ "data": ... }` và error envelope thống nhất. Mã lỗi nghiệp vụ và DTO cụ thể nằm trong module tương ứng theo [REST contract](../../../../docs/design/api/README.md). Không lộ stack trace hoặc secret.
