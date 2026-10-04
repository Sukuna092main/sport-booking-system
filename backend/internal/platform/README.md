# Shared infrastructure

Config, database, middleware, response và logger dùng chung giữa module. Không trở thành nơi gom mọi business rules; Booking transaction và eligibility thuộc Booking service. Các module không import HTTP handler của nhau.
