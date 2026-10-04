# PostgreSQL migrations — Goose

Dành cho SQL migrations version-control sau review ERD/schema. Quy ước đề xuất: `<timestamp>_<change>.sql` với Goose Up/Down; migration mới không sửa âm thầm migration đã áp dụng. Kiểm tra up/down trên DB kiểm chứng, FK/index/unique constraints, upgrade/recovery và Booking atomicity.

Chưa có migration SQL; không suy diễn schema hoặc ghi DB readiness đã đạt. Seed/fixtures QA ở `tests/fixtures/`, không đưa tài khoản/dữ liệu production vào source.
