-- Synthetic test fixtures only. Never run on the shared Neon database.
-- Customer hash is deliberately unusable; register real test accounts through Auth.
INSERT INTO users (id,email,password_hash,full_name,role,status) VALUES
('10000000-0000-4000-8000-000000000001','fixture@example.test','fixture-not-for-login','Fixture customer','USER','ACTIVE');

INSERT INTO sport_types (id,name,is_active) VALUES
('11000000-0000-4000-8000-000000000001','Badminton',true),
('11000000-0000-4000-8000-000000000002','Tennis',true),
('11000000-0000-4000-8000-000000000003','Inactive sport',false);

INSERT INTO courts (id,sport_type_id,code,name,is_active,reference_price_amount,reference_price_currency) VALUES
('20000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','BD-01','Badminton A',true,100000,'VND'),
('20000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000002','TN-01','Tennis B',true,NULL,NULL),
('20000000-0000-4000-8000-000000000003','11000000-0000-4000-8000-000000000001','BD-OFF','Inactive court',false,NULL,NULL),
('20000000-0000-4000-8000-000000000004','11000000-0000-4000-8000-000000000003','SP-OFF','Inactive sport court',true,NULL,NULL);

INSERT INTO court_operating_hours (court_id,weekday,opens_at,closes_at)
SELECT '20000000-0000-4000-8000-000000000001',weekday,'07:00'::time,'13:00'::time FROM generate_series(1,7) AS weekday;

INSERT INTO time_slots (court_id,weekday,starts_at,ends_at)
SELECT '20000000-0000-4000-8000-000000000001',weekday,
       make_time(hour,0,0),make_time(hour+1,0,0)
FROM generate_series(1,7) AS weekday CROSS JOIN generate_series(7,12) AS hour;

-- Deliberately invalid/outside-hours and inactive templates to exercise read exclusions.
INSERT INTO time_slots (court_id,weekday,starts_at,ends_at,is_active) VALUES
('20000000-0000-4000-8000-000000000001',5,'14:00','15:00',true),
('20000000-0000-4000-8000-000000000001',5,'15:00','15:30',true),
('20000000-0000-4000-8000-000000000001',5,'10:30','11:30',false);

INSERT INTO court_blackouts (court_id,starts_at,ends_at,reason,is_active) VALUES
('20000000-0000-4000-8000-000000000001','2026-10-09 08:30:00+07','2026-10-09 08:45:00+07','Partial blackout',true),
('20000000-0000-4000-8000-000000000001','2026-10-09 07:00:00+07','2026-10-09 08:00:00+07','Inactive blackout',false);

INSERT INTO bookings (id,customer_id,court_id,booking_code,booking_date,status,idempotency_key,request_hash,cancelled_at) VALUES
('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','FIX-CONFIRMED','2026-10-09','CONFIRMED','fix-confirmed',decode(repeat('00',32),'hex'),NULL),
('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','FIX-OLD-TEMPLATE','2026-10-09','CONFIRMED','fix-old-template',decode(repeat('01',32),'hex'),NULL),
('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','FIX-CANCELLED','2026-10-09','CANCELLED','fix-cancelled',decode(repeat('02',32),'hex'),'2026-10-08 12:00:00+07');

INSERT INTO booking_slots (booking_id,time_slot_id,court_id,booking_date,weekday,starts_at,ends_at,released_at)
SELECT '30000000-0000-4000-8000-000000000001',id,court_id,'2026-10-09',5,'2026-10-09 09:00:00+07','2026-10-09 10:00:00+07',NULL
FROM time_slots WHERE court_id='20000000-0000-4000-8000-000000000001' AND weekday=5 AND starts_at='09:00' AND is_active;

INSERT INTO booking_slots (booking_id,time_slot_id,court_id,booking_date,weekday,starts_at,ends_at,released_at)
SELECT '30000000-0000-4000-8000-000000000002',id,court_id,'2026-10-09',5,'2026-10-09 10:30:00+07','2026-10-09 11:30:00+07',NULL
FROM time_slots WHERE court_id='20000000-0000-4000-8000-000000000001' AND weekday=5 AND starts_at='10:30' AND NOT is_active;

INSERT INTO booking_slots (booking_id,time_slot_id,court_id,booking_date,weekday,starts_at,ends_at,released_at)
SELECT '30000000-0000-4000-8000-000000000003',id,court_id,'2026-10-09',5,'2026-10-09 12:00:00+07','2026-10-09 13:00:00+07','2026-10-08 12:00:00+07'
FROM time_slots WHERE court_id='20000000-0000-4000-8000-000000000001' AND weekday=5 AND starts_at='12:00' AND is_active;
