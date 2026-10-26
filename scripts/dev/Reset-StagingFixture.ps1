# Reset va seed lai fixture cho moi truong staging.
#
# AN TOAN MAC DINH:
#   - Khong truyen -Execute thi chi in ra viec se lam (dry run), khong xoa gi.
#   - Neu -DbUrl tro toi endpoint staging that thi bat buoc phai co -ConfirmStaging.
#   - Khong tu doc backend/.env.staging: phai truyen -DbUrl tuong minh, de khong
#     ai vo tinh reset nham DB.
#
# VI SAO RESET BANG SQL NHUNG SEED BANG API:
#   Mau time_slots (98 mau tuan cho 1 san) duoc sinh trong
#   backend/internal/Admin/schedule/service.go, KHONG co trigger o DB
#   (00006_time_slots.sql co 0 trigger). Neu INSERT court bang SQL thi court co
#   nhung time_slots rong -> availability tra slots: [] va de bi hieu nham la bug.
#   Nguoc lai, khong co API xoa hang loat nen buoc reset buoc phai dung SQL.
#
# VI DU:
#   # xem truoc, khong thay doi gi
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/Reset-StagingFixture.ps1 `
#     -DbUrl "<STAGING_DATABASE_URL_DIRECT>"
#
#   # chay that tren branch dien tap
#   ... -DbUrl "<REHEARSAL_BRANCH_URL>" -Execute
#
#   # chay that tren staging (can co y xac nhan)
#   ... -DbUrl "<STAGING_DATABASE_URL_DIRECT>" -Execute -ConfirmStaging

param(
    [Parameter(Mandatory = $true)]
    [string]$DbUrl,

    [string]$ApiBaseUrl = 'https://sport-booking-api-staging.onrender.com/api/v1',

    # Chi khi co co nay moi thuc su xoa va ghi du lieu.
    [switch]$Execute,

    # Bat buoc khi -DbUrl tro toi endpoint staging that.
    [switch]$ConfirmStaging,

    [string]$Container = 'sportbookingsystem-db-1',

    # Mat khau dung chung cho 3 tai khoan fixture. Chi danh cho moi truong staging.
    [string]$FixturePassword = 'password123'
)

$ErrorActionPreference = 'Stop'

$StagingHostMarker = 'ep-nameless-glade-b3rz6u6q'
$FixtureVersion = 'v1'

# ---------------------------------------------------------------- guards

try { $DbUri = [Uri]$DbUrl }
catch { throw '-DbUrl khong hop le; khong gui credential len chat.' }

if (-not $DbUri.Host.EndsWith('.neon.tech')) {
    throw '-DbUrl phai tro toi Neon (host *.neon.tech).'
}
if ($DbUri.Host -like '*-pooler*') {
    throw '-DbUrl phai la endpoint DIRECT (khong co -pooler).'
}
if ($DbUri.Query -notmatch '(?:^|[?&])sslmode=(require|verify-ca|verify-full)(?:&|$)') {
    throw '-DbUrl can sslmode=require, verify-ca hoac verify-full.'
}

$isStaging = $DbUri.Host -like "*$StagingHostMarker*"
if ($isStaging -and -not $ConfirmStaging -and $Execute) {
    throw "DbUrl tro toi STAGING that. Them -ConfirmStaging neu chac chan muon reset staging."
}

Write-Host "Fixture version : $FixtureVersion"
Write-Host "DB target       : $($DbUri.Host)$($DbUri.AbsolutePath)"
Write-Host "API base        : $ApiBaseUrl"
Write-Host "Che do          : $(if ($Execute) { 'EXECUTE (se xoa va ghi that)' } else { 'DRY RUN (chi in ra)' })"
if ($isStaging) { Write-Host "!!! Day la STAGING that !!!" -ForegroundColor Yellow }
Write-Host ''

# ---------------------------------------------------------------- helpers

function Invoke-Sql {
    param([string]$Query)
    # Dung psql trong container local, ket noi toi $DbUrl. Secret va query di qua
    # bien moi truong + stdin nen khong lo ra danh sach tien trinh.
    $names = @('PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSSLMODE')
    $saved = @{}
    foreach ($n in $names) { $saved[$n] = [Environment]::GetEnvironmentVariable($n, 'Process') }
    try {
        $env:PGHOST = $DbUri.Host
        $env:PGPORT = if ($DbUri.Port -gt 0) { $DbUri.Port } else { 5432 }
        $sep = $DbUri.UserInfo.IndexOf(':')
        $env:PGUSER = [Uri]::UnescapeDataString($DbUri.UserInfo.Substring(0, $sep))
        $env:PGPASSWORD = [Uri]::UnescapeDataString($DbUri.UserInfo.Substring($sep + 1))
        $env:PGDATABASE = [Uri]::UnescapeDataString($DbUri.AbsolutePath.TrimStart('/'))
        $env:PGSSLMODE = 'require'
        $out = $Query | docker exec -i -e PGHOST -e PGPORT -e PGUSER -e PGPASSWORD -e PGDATABASE -e PGSSLMODE $Container psql -tA -f -
    }
    finally {
        foreach ($n in $names) { [Environment]::SetEnvironmentVariable($n, $saved[$n], 'Process') }
    }
    return ($out | Out-String).Trim()
}

function Invoke-Api {
    param([string]$Method, [string]$Path, $Body, [string]$Token)
    $headers = @{}
    if ($Token) { $headers['Authorization'] = "Bearer $Token" }
    $params = @{ Uri = "$ApiBaseUrl$Path"; Method = $Method; Headers = $headers; UseBasicParsing = $true }
    if ($null -ne $Body) {
        # Gui bang BYTE UTF-8. Neu truyen string, PowerShell 5.1 ma hoa theo ANSI
        # va thay ky tu tieng Viet bang '?' -> ten luu vao DB bi hong (da gap that:
        # "C?u l�ng"). ContentType cung phai ghi charset=utf-8.
        $json = $Body | ConvertTo-Json -Depth 8 -Compress
        $params['ContentType'] = 'application/json; charset=utf-8'
        $params['Body'] = [System.Text.Encoding]::UTF8.GetBytes($json)
    }
    try {
        $r = Invoke-WebRequest @params
        return [pscustomobject]@{ status = [int]$r.StatusCode; json = ($r.Content | ConvertFrom-Json) }
    }
    catch {
        $resp = $_.Exception.Response
        if (-not $resp) { throw }
        $text = $_.ErrorDetails.Message
        if (-not $text) {
            $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
            $text = $sr.ReadToEnd()
        }
        $parsed = $null
        try { $parsed = $text | ConvertFrom-Json } catch {}
        return [pscustomobject]@{ status = [int]$resp.StatusCode; json = $parsed }
    }
}

# Bang nghiep vu se bi xoa. CO Y KHONG xoa goose_db_version.
$truncateTargets = @(
    'booking_slots', 'bookings', 'audit_logs',
    'court_blackouts', 'court_operating_hours', 'time_slots',
    'courts', 'sport_types', 'users'
)

$sportTypes = @(
    @{ name = 'Cầu lông'; description = 'Sân cầu lông trong nhà' },
    @{ name = 'Tennis'; description = 'Sân tennis ngoài trời' },
    @{ name = 'Bóng đá'; description = 'Sân bóng đá mini' }
)

$courts = @(
    @{ code = 'CL-01'; name = 'Sân cầu lông 1'; sport = 'Cầu lông' },
    @{ code = 'CL-02'; name = 'Sân cầu lông 2'; sport = 'Cầu lông' },
    @{ code = 'TN-01'; name = 'Sân tennis 1'; sport = 'Tennis' },
    @{ code = 'TN-02'; name = 'Sân tennis 2'; sport = 'Tennis' },
    @{ code = 'BD-01'; name = 'Sân bóng đá 1'; sport = 'Bóng đá' },
    @{ code = 'BD-02'; name = 'Sân bóng đá 2'; sport = 'Bóng đá' }
)

$accounts = @(
    @{ email = 'fixture-admin@example.test'; fullName = 'Fixture Admin'; role = 'ADMIN' },
    @{ email = 'fixture-user1@example.test'; fullName = 'Fixture User 1'; role = 'USER' },
    @{ email = 'fixture-user2@example.test'; fullName = 'Fixture User 2'; role = 'USER' }
)

# ---------------------------------------------------------------- 1. hien trang

Write-Host '== 1. Hien trang du lieu =='
$before = @{}
foreach ($t in ($truncateTargets + 'goose_db_version')) {
    $before[$t] = Invoke-Sql "select count(*) from $t;"
}
foreach ($t in $truncateTargets) {
    Write-Host ("  {0,-22} {1,6} dong  -> se xoa" -f $t, $before[$t])
}
Write-Host ("  {0,-22} {1,6} dong  -> GIU NGUYEN" -f 'goose_db_version', $before['goose_db_version'])
Write-Host ''

if (-not $Execute) {
    Write-Host 'DRY RUN: chua thay doi gi.' -ForegroundColor Cyan
    Write-Host 'Them -Execute de chay that.'
    return
}

# ---------------------------------------------------------------- 2. reset

Write-Host '== 2. Xoa du lieu nghiep vu (giu goose_db_version) =='

# PRE-FLIGHT: API phai dang tro toi dung DB trong -DbUrl. So sanh so court
# active giua DB va API TRUOC khi xoa bat cu thu gi. Neu lech nghia la
# -ApiBaseUrl dang noi mot DB khac -> seed se ghi nham cho.
$dbActive = Invoke-Sql "select count(*) from courts c join sport_types s on s.id=c.sport_type_id where c.is_active and s.is_active;"
$probe = Invoke-Api 'GET' '/courts' $null $null
if ($probe.status -ne 200) {
    throw "GET /courts tra $($probe.status); khong xac minh duoc API dang tro toi dau."
}
$apiActive = [int]$probe.json.meta.total
if ($apiActive -ne [int]$dbActive) {
    throw "Pre-flight that bai: DB co $dbActive court active nhung API tra $apiActive. -ApiBaseUrl khong tro toi DB trong -DbUrl -> dung lai, chua xoa gi."
}
Write-Host "  Pre-flight OK: DB va API cung thay $dbActive court active."

$list = ($truncateTargets -join ', ')
Invoke-Sql "TRUNCATE TABLE $list RESTART IDENTITY CASCADE;" | Out-Null
foreach ($t in $truncateTargets) {
    $c = Invoke-Sql "select count(*) from $t;"
    if ($c -ne '0') { throw "Xoa that bai: bang $t con $c dong." }
}
Write-Host '  Da xoa sach 9 bang nghiep vu.'

$schemaVersion = Invoke-Sql 'select max(version_id) from goose_db_version;'
Write-Host "  goose_db_version van la: $schemaVersion"

# GUARD QUAN TRONG: API phai dang tro toi dung DB vua reset.
# Neu -DbUrl la mot branch tam ma -ApiBaseUrl van la staging thi viec seed se
# ghi vao DB cua backend chu khong ghi vao -DbUrl -> vua lam ban staging vua
# khong seed duoc branch. Kiem tra bang cach goi API ngay sau khi truncate:
# DB vua reset phai tra 0 court.
$probe = Invoke-Api 'GET' '/courts' $null $null
if ($probe.status -ne 200) {
    throw "GET /courts tra $($probe.status); khong xac minh duoc API dang tro toi dau."
}
$apiCourts = @($probe.json.data).Count
if ($apiCourts -ne 0) {
    throw "API tra $apiCourts court trong khi DB vua reset ve 0. -ApiBaseUrl dang tro toi mot DB khac -DbUrl. Dung lai de khong seed nham DB."
}
Write-Host '  API khop voi DB vua reset (GET /courts = 0).'
Write-Host ''

# ---------------------------------------------------------------- 3. tai khoan

Write-Host '== 3. Tao tai khoan fixture =='
foreach ($a in $accounts) {
    $r = Invoke-Api 'POST' '/auth/register' @{ email = $a.email; password = $FixturePassword; fullName = $a.fullName } $null
    if ($r.status -ne 201) { throw "register $($a.email) that bai: $($r.status)" }
    Write-Host "  register $($a.email) -> 201"
}

# Admin dau tien phai promote bang SQL: khong co API nao cap quyen ADMIN.
Invoke-Sql "UPDATE users SET role='ADMIN' WHERE email='fixture-admin@example.test';" | Out-Null
Write-Host '  promote fixture-admin -> ADMIN (qua SQL)'

$login = Invoke-Api 'POST' '/auth/login' @{ email = 'fixture-admin@example.test'; password = $FixturePassword } $null
if ($login.status -ne 200) { throw "login admin that bai: $($login.status)" }
$adminToken = $login.json.data.accessToken
if (-not $adminToken) { throw 'Khong lay duoc admin token.' }
Write-Host '  login admin -> 200'
Write-Host ''

# ---------------------------------------------------------------- 4. seed

Write-Host '== 4. Seed sport type / court / operating hours (qua API) =='
$sportIdByName = @{}
foreach ($s in $sportTypes) {
    $r = Invoke-Api 'POST' '/admin/sport-types' @{ name = $s.name; description = $s.description; isActive = $true } $adminToken
    if ($r.status -ne 201) { throw "tao sport type '$($s.name)' that bai: $($r.status)" }
    $sportIdByName[$s.name] = $r.json.data.id
    Write-Host "  sport type '$($s.name)' -> 201"
}

# So slot tinh tu cau hinh gio, khong hardcode - de sua gio thi ky vong tu doi theo.
$openHour = 6
$closeHour = 22
$slotMinutes = 60
$slotsPerDay = [int](($closeHour - $openHour) * 60 / $slotMinutes)
$expectedSlotsPerCourt = $slotsPerDay * 7
$expectedSlotsTotal = $expectedSlotsPerCourt * $courts.Count

$hours = @()
foreach ($w in 1..7) {
    $hours += @{ weekday = $w; opensAt = ('{0:D2}:00:00' -f $openHour); closesAt = ('{0:D2}:00:00' -f $closeHour) }
}

foreach ($c in $courts) {
    $body = @{
        sportTypeId = $sportIdByName[$c.sport]
        code = $c.code
        name = $c.name
        isActive = $true
        slotDurationMinutes = 60
        minConsecutiveSlots = 1
        maxConsecutiveSlots = 4
        referencePriceAmount = '100000'
        referencePriceCurrency = 'VND'
    }
    $r = Invoke-Api 'POST' '/admin/courts' $body $adminToken
    if ($r.status -ne 201) { throw "tao court $($c.code) that bai: $($r.status)" }
    $courtId = $r.json.data.id

    $h = Invoke-Api 'PUT' "/admin/courts/$courtId/operating-hours" @{ hours = $hours } $adminToken
    if ($h.status -ne 200) { throw "dat operating hours cho $($c.code) that bai: $($h.status)" }
    $slotCount = @($h.json.data.timeSlots).Count
    Write-Host ("  court {0} -> 201, {1} mau time_slots" -f $c.code, $slotCount)
}
Write-Host ''

# ---------------------------------------------------------------- 5. verify

Write-Host '== 5. Kiem tra lai =='
$checks = @(
    @{ label = 'sport_types'; expect = 3 },
    @{ label = 'courts'; expect = 6 },
    @{ label = 'users'; expect = 3 }
)
$failed = 0
foreach ($ck in $checks) {
    $actual = Invoke-Sql "select count(*) from $($ck.label);"
    $ok = ($actual -eq [string]$ck.expect)
    if (-not $ok) { $failed++ }
    Write-Host ("  {0,-14} {1,3} / {2} {3}" -f $ck.label, $actual, $ck.expect, $(if ($ok) { 'OK' } else { 'SAI' }))
}

$slotTotal = Invoke-Sql 'select count(*) from time_slots;'
Write-Host ("  time_slots     {0,3} (ky vong {1} = {2} san x {3} mau tuan)" -f $slotTotal, $expectedSlotsTotal, $courts.Count, $expectedSlotsPerCourt)
if ($slotTotal -ne [string]$expectedSlotsTotal) { $failed++ }

# Kiem tra encoding: ten tieng Viet phai luu dung, khong bi thay bang '?'.
$mangled = Invoke-Sql "select count(*) from sport_types where name like '%?%';"
Write-Host ("  ten bi loi enc {0,3} (ky vong 0)" -f $mangled)
if ($mangled -ne '0') { $failed++ }

$adminCount = Invoke-Sql "select count(*) from users where role='ADMIN';"
Write-Host ("  admin accounts {0,3} (ky vong 1)" -f $adminCount)
if ($adminCount -ne '1') { $failed++ }

$version = Invoke-Sql 'select max(version_id) from goose_db_version;'
Write-Host ("  goose version  {0,3}" -f $version)

if ($failed -gt 0) {
    throw "Fixture khong dat: $failed kiem tra sai. Xem log phia tren."
}

Write-Host ''
Write-Host "Fixture $FixtureVersion da seed xong." -ForegroundColor Green
Write-Host "Tai khoan: fixture-admin@example.test (ADMIN), fixture-user1/user2@example.test (USER)"
Write-Host "Mat khau : (tham so -FixturePassword, mac dinh password123)"
Write-Host 'Nho cap nhat version fixture trong docs/operations/STAGING_RUNBOOK.md neu thay doi noi dung seed.'
