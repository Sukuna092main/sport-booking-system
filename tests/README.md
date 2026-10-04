# QA liên hệ thống

- Unit/service tests backend: cạnh source (`*_test.go`). Unit/component tests frontend: colocated với feature/component.
- Frontend integration/browser E2E: `frontend/tests/`.
- `api/`: functional/negative integration qua API thật.
- `concurrency/`: double-booking, atomic rollback và idempotency.
- `security/`: auth/role/ownership/privacy.
- `performance/`, `usability/`: NFR-07/08, ghi profile và giới hạn phép đo.
- `uat/`: thực thi scenarios UAT-01..10.
- `smoke/`: kiểm tra sau deploy/restore.
- `fixtures/`: dữ liệu tổng hợp, không production.

Hưng phụ trách QA; Huy review nghiệp vụ/backend và gate, Duy hỗ trợ UI. Chưa có test suite thực thi.
Mỗi test liên kết FR/BR/NFR/UAT + WBS/task; mỗi lần chạy ghi version, environment, inputs, expected/actual, pass/fail và evidence.
Raw results mặc định ở `artifacts/tests/`, `artifacts/uat/` hoặc `artifacts/release/` (tạo lúc chạy, không commit). Tài liệu/report đã review nằm trong docs; không ghi Pass trước chạy.
