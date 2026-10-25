# QA S3 - Booking Core & Concurrency (TC-01..TC-13)
# Mac dinh chay tren stack docker local. Co the tro sang staging/Neon bang -BaseUrl + -DbUrl.
# Vi du:
#   powershell -NoProfile -ExecutionPolicy Bypass -File tests/api/booking-core-qa.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File tests/api/booking-core-qa.ps1 `
#     -BaseUrl https://sport-booking-api-staging.onrender.com/api/v1 `
#     -DbUrl   "<STAGING_DATABASE_URL_DIRECT>"

param(
    [string]$BaseUrl   = 'http://localhost:8080/api/v1',
    [string]$Container = 'sportbookingsystem-db-1',
    [string]$DbName    = 'sport_booking',
    # Neu co -DbUrl thi moi cau SQL chay qua psql tro toi URL nay (dung endpoint DIRECT
    # cua Neon), thay vi DB local trong $Container. Bat buoc khi test staging, neu khong
    # HTTP se di staging con SQL lai doc DB local -> ket qua vo nghia.
    [string]$DbUrl     = '',
    [string]$OutDir    = ''
)

$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $OutDir) {
    $OutDir = Join-Path $root "artifacts/tests/booking-qa-$($stamp.Substring(0,8))"
}
New-Item -ItemType Directory -Force $OutDir | Out-Null

$results = New-Object System.Collections.ArrayList
$script:pass = 0
$script:fail = 0

# Xac dinh dich cua cac cau SQL kiem chung va kiem tra som, de khong chay 13 test case
# roi moi phat hien SQL dang tro sai database.
if ($DbUrl) {
    try { $DbUri = [Uri]$DbUrl }
    catch { throw '-DbUrl khong hop le; khong gui credential len chat.' }
    if (-not $DbUri.Host.EndsWith('.neon.tech')) {
        throw '-DbUrl phai tro toi Neon khi test staging.'
    }
    if ($DbUri.Host -like '*-pooler*') {
        throw '-DbUrl phai la endpoint DIRECT (khong co -pooler).'
    }
    if ($DbUri.Query -notmatch '(?:^|[?&])sslmode=(require|verify-ca|verify-full)(?:&|$)') {
        throw '-DbUrl can sslmode=require, verify-ca hoac verify-full.'
    }
    $dbLabel = "$($DbUri.Host)$($DbUri.AbsolutePath)"
}
else {
    $dbLabel = "$Container/$DbName"
}
Write-Host "API : $BaseUrl"
Write-Host "DB  : $dbLabel"

function J($o) { $o | ConvertTo-Json -Depth 10 -Compress }

function Invoke-Api {
    param([string]$Method, [string]$Path, $Body, [string]$Token, [string]$Key)
    $headers = @{}
    if ($Token) { $headers['Authorization'] = "Bearer $Token" }
    if ($Key)   { $headers['Idempotency-Key'] = $Key }
    $params = @{ Uri = "$BaseUrl$Path"; Method = $Method; Headers = $headers; UseBasicParsing = $true }
    if ($null -ne $Body) {
        $params['ContentType'] = 'application/json'
        $params['Body'] = if ($Body -is [string]) { $Body } else { J $Body }
    }
    try {
        $r = Invoke-WebRequest @params
        $parsed = $null
        try { $parsed = $r.Content | ConvertFrom-Json } catch {}
        return [pscustomobject]@{ status = [int]$r.StatusCode; raw = $r.Content; json = $parsed }
    } catch {
        $resp = $_.Exception.Response
        if (-not $resp) { throw }
        $text = $_.ErrorDetails.Message
        if (-not $text) {
            $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
            $text = $sr.ReadToEnd()
        }
        $parsed = $null
        try { $parsed = $text | ConvertFrom-Json } catch {}
        return [pscustomobject]@{ status = [int]$resp.StatusCode; raw = $text; json = $parsed }
    }
}

function Add-Result {
    param([string]$TC, [string]$Name, [string]$Expected, $Actual, [bool]$Pass, $Evidence)
    $entry = [ordered]@{
        tc = $TC; name = $Name; expected = $Expected; actual = $Actual
        verdict = $(if ($Pass) { 'PASS' } else { 'FAIL' })
        evidence = $Evidence; at = (Get-Date).ToString('o')
    }
    [void]$results.Add($entry)
    if ($Pass) { $script:pass++; $mark = 'PASS' } else { $script:fail++; $mark = 'FAIL' }
    Write-Host ("  [{0}] {1} :: {2} | expected={3} actual={4}" -f $mark, $TC, $Name, $Expected, $Actual)
}

function Sql {
    param([string]$Query)
    if ($DbUrl) {
        # Chay psql trong container local nhung ket noi toi $DbUrl (Neon direct).
        # Khong truyen connection string hay query tren command line: ca hai di qua
        # bien moi truong va stdin, tranh bi PowerShell 5.1 lam hong dau nhay.
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
    }
    else {
        $out = docker exec $Container psql -U sport -d $DbName -tAc $Query
    }
    return ($out | Out-String).Trim()
}

function New-QaUser {
    param([string]$Label)
    $email = "qa-$Label-$stamp@example.test"
    $reg = Invoke-Api 'POST' '/auth/register' @{ email = $email; password = 'password123'; fullName = "QA $Label"; phone = '0900000000' } $null $null
    if ($reg.status -ne 201) { throw "register $Label failed: $($reg.status) $($reg.raw)" }
    $login = Invoke-Api 'POST' '/auth/login' @{ email = $email; password = 'password123' } $null $null
    if ($login.status -ne 200) { throw "login $Label failed: $($login.status) $($login.raw)" }
    return [pscustomobject]@{
        label = $Label; email = $email
        id = $reg.json.data.id; token = $login.json.data.accessToken
    }
}

function Get-Slots {
    param([string]$CourtId, [string]$Date)
    $r = Invoke-Api 'GET' "/courts/$CourtId/availability?date=$Date" $null $null $null
    if ($r.status -ne 200) { throw "availability $Date failed: $($r.status) $($r.raw)" }
    return @($r.json.data.slots)
}

function Get-Body {
    param([string]$CourtId, [string]$Date, [string[]]$SlotIds)
    return @{ courtId = $CourtId; bookingDate = $Date; timeSlotIds = $SlotIds }
}

function Invoke-Parallel {
    param([object[]]$Requests)
    Add-Type -AssemblyName System.Net.Http -ErrorAction SilentlyContinue
    $client = [System.Net.Http.HttpClient]::new()
    $tasks = New-Object System.Collections.ArrayList
    foreach ($r in $Requests) {
        $msg = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($r.method), "$BaseUrl$($r.path)")
        if ($r.token) { $msg.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $r.token) }
        if ($r.key)   { [void]$msg.Headers.Add('Idempotency-Key', $r.key) }
        if ($null -ne $r.body) {
            $msg.Content = [System.Net.Http.StringContent]::new((J $r.body), [System.Text.Encoding]::UTF8, 'application/json')
        }
        [void]$tasks.Add($client.SendAsync($msg))
    }
    [System.Threading.Tasks.Task]::WaitAll([System.Threading.Tasks.Task[]]$tasks.ToArray())
    $out = @()
    foreach ($t in $tasks) {
        $resp = $t.Result
        $body = $resp.Content.ReadAsStringAsync().Result
        $parsed = $null
        try { $parsed = $body | ConvertFrom-Json } catch {}
        $out += [pscustomobject]@{ status = [int]$resp.StatusCode; raw = $body; json = $parsed }
    }
    $client.Dispose()
    return $out
}

# ---------------------------------------------------------------- setup
Write-Host "== Setup (TC-01) =="

# Kiem tra som: SQL phai doc duoc dung database truoc khi chay 13 test case.
if (-not (Sql 'select 1')) {
    throw "Khong ket noi duoc database $dbLabel. Kiem tra -DbUrl hoac container $Container."
}

$today = (Get-Date).Date
function D([int]$offset) { return $today.AddDays($offset).ToString('yyyy-MM-dd') }

$admin = New-QaUser 'admin'
Sql "UPDATE users SET role='ADMIN' WHERE email='$($admin.email)';" | Out-Null
$login = Invoke-Api 'POST' '/auth/login' @{ email = $admin.email; password = 'password123' } $null $null
$adminToken = $login.json.data.accessToken
Write-Host "  admin login=$($login.status) tokenLen=$($adminToken.Length) id=$($admin.id)"
if ($login.status -ne 200 -or -not $adminToken) { throw "admin login failed: $($login.status) $($login.raw)" }

$sport = Invoke-Api 'POST' '/admin/sport-types' @{ name = "QA Sport $stamp"; description = 'QA'; isActive = $true } $adminToken $null
if ($sport.status -ne 201) { throw "create sport failed: $($sport.status) $($sport.raw)" }
$sportId = $sport.json.data.id

$courtBody = @{
    sportTypeId = $sportId; code = "QA-$stamp"; name = "QA Court $stamp"; isActive = $true
    slotDurationMinutes = 60; minConsecutiveSlots = 1; maxConsecutiveSlots = 4
    referencePriceAmount = '100000'; referencePriceCurrency = 'VND'
}
$court = Invoke-Api 'POST' '/admin/courts' $courtBody $adminToken $null
$courtId = $court.json.data.id

$courtBody2 = $courtBody.Clone()
$courtBody2['code'] = "QA2-$stamp"; $courtBody2['name'] = "QA Court 2 $stamp"
$court2 = Invoke-Api 'POST' '/admin/courts' $courtBody2 $adminToken $null
$court2Id = $court2.json.data.id

$courtBody3 = $courtBody.Clone()
$courtBody3['code'] = "QA3-$stamp"; $courtBody3['name'] = "QA Court 3 $stamp"; $courtBody3['isActive'] = $false
$court3 = Invoke-Api 'POST' '/admin/courts' $courtBody3 $adminToken $null
$court3Id = $court3.json.data.id

$hours = @()
foreach ($d in 1..7) { $hours += @{ weekday = $d; opensAt = '07:00:00'; closesAt = '13:00:00' } }
foreach ($c in @($courtId, $court2Id, $court3Id)) {
    $h = Invoke-Api 'PUT' "/admin/courts/$c/operating-hours" @{ hours = $hours } $adminToken $null
    if ($h.status -ne 200) { throw "operating-hours $c failed: $($h.status) $($h.raw)" }
}

# blackout T+2 09:00-10:00 local (UTC+7) => 02:00Z-03:00Z
$boDate = $today.AddDays(2)
$boStart = $boDate.AddHours(9).ToString("yyyy-MM-ddTHH:mm:ss") + '+07:00'
$boEnd   = $boDate.AddHours(10).ToString("yyyy-MM-ddTHH:mm:ss") + '+07:00'
$bo = Invoke-Api 'POST' "/admin/courts/$courtId/blackouts" @{ startsAt = $boStart; endsAt = $boEnd; reason = 'QA blackout' } $adminToken $null
$boId = $bo.json.data.id

$slotsD1 = Get-Slots $courtId (D 1)
Add-Result 'TC-01' 'Tao du lieu test: sport/court/hours/blackout' '6 slot/ngay, blackout tao duoc' `
    ("slots=" + $slotsD1.Count + ", blackout=" + $bo.status) `
    ($slotsD1.Count -eq 6 -and $bo.status -eq 201) `
    @{ courtId = $courtId; court2Id = $court2Id; court3Id = $court3Id; blackoutId = $boId }

$slotsD2 = Get-Slots $courtId (D 2)
$slotsD3 = Get-Slots $courtId (D 3)
$slotsD4 = Get-Slots $courtId (D 4)
$slotsD5 = Get-Slots $courtId (D 5)
$slotsD6 = Get-Slots $courtId (D 6)
$slotsD7 = Get-Slots $courtId (D 7)
$slotsD8 = Get-Slots $courtId (D 8)
$slotsD9 = Get-Slots $courtId (D 9)
$slotsD10 = Get-Slots $courtId (D 10)
$slotsD11 = Get-Slots $courtId (D 11)
$slotsD12 = Get-Slots $courtId (D 12)
$slotsD13 = Get-Slots $courtId (D 13)
$slotsD14 = Get-Slots $courtId (D 14)
$slotsD15 = Get-Slots $courtId (D 15)
$slotsD30 = Get-Slots $courtId (D 30)
$oh = Invoke-Api 'GET' "/admin/courts/$courtId/operating-hours" $null $adminToken $null
function Get-SlotId {
    param([datetime]$Date, [int]$Hour)
    return Get-SlotIdFromOh $oh.json.data $Date $Hour
}
function Get-SlotIdFromOh {
    param($OhData, [datetime]$Date, [int]$Hour)
    $wd = [int]$Date.DayOfWeek
    if ($wd -eq 0) { $wd = 7 }
    $t = $Hour.ToString('00') + ':00:00'
    $slot = @($OhData.timeSlots | Where-Object { $_.weekday -eq $wd -and $_.startsAt -eq $t })[0]
    if (-not $slot) { throw "no slot for $($Date.ToString('yyyy-MM-dd')) $t" }
    return $slot.id
}

# ---------------------------------------------------------------- TC-02
Write-Host "== TC-02 booking 1 slot =="
$u1 = New-QaUser 'one'
$r = Invoke-Api 'POST' '/bookings' (Get-Body $courtId (D 1) @($slotsD1[1].id)) $u1.token "tc02-$stamp"
$ok = $r.status -eq 201 -and $r.json.data.status -eq 'CONFIRMED' -and @($r.json.data.slots).Count -eq 1 -and $r.json.data.bookingCode
Add-Result 'TC-02' 'Booking 1 slot thanh cong' '201 CONFIRMED, 1 slot, co bookingCode' ("status=" + $r.status + " code=" + $r.json.data.bookingCode) $ok $r.raw
$booking1 = $r.json.data

# ---------------------------------------------------------------- TC-03
Write-Host "== TC-03 booking nhieu slot lien tiep =="
$u2 = New-QaUser 'two'
$r = Invoke-Api 'POST' '/bookings' (Get-Body $courtId (D 3) @($slotsD3[1].id, $slotsD3[2].id)) $u2.token "tc03a-$stamp"
$ok2 = $r.status -eq 201 -and @($r.json.data.slots).Count -eq 2
Add-Result 'TC-03' 'Booking 2 slot lien tiep' '201, 2 slot' ("status=" + $r.status + " slots=" + @($r.json.data.slots).Count) $ok2 $r.raw

$u3 = New-QaUser 'three'
$r = Invoke-Api 'POST' '/bookings' (Get-Body $courtId (D 4) @($slotsD4[0].id, $slotsD4[1].id, $slotsD4[2].id, $slotsD4[3].id)) $u3.token "tc03b-$stamp"
$ok3 = $r.status -eq 201 -and @($r.json.data.slots).Count -eq 4
Add-Result 'TC-03' 'Booking 4 slot lien tiep (max=4)' '201, 4 slot' ("status=" + $r.status + " slots=" + @($r.json.data.slots).Count) $ok3 $r.raw

$r = Invoke-Api 'POST' '/bookings' (Get-Body $courtId (D 5) @($slotsD5[0].id, $slotsD5[1].id, $slotsD5[2].id, $slotsD5[3].id, $slotsD5[4].id)) $u3.token "tc03c-$stamp"
Add-Result 'TC-03' 'Booking 5 slot vuot max=4' '422 booking_rule_violation' ("status=" + $r.status + " code=" + $r.json.error.code) ($r.status -eq 422) $r.raw

# ---------------------------------------------------------------- TC-04
Write-Host "== TC-04 reject cau truc slot =="
$u4 = New-QaUser 'four'
$r = Invoke-Api 'POST' '/bookings' (Get-Body $courtId (D 6) @($slotsD6[1].id, $slotsD6[3].id)) $u4.token "tc04-gap-$stamp"
Add-Result 'TC-04' 'Slot khong lien tiep (08:00 + 10:00)' '422 booking_rule_violation' ("status=" + $r.status + " code=" + $r.json.error.code) ($r.status -eq 422) $r.raw

$r = Invoke-Api 'POST' '/bookings' (Get-Body $courtId (D 6) @($slotsD6[2].id, $slotsD6[1].id)) $u4.token "tc04-rev-$stamp"
Add-Result 'TC-04' 'Slot dao thu tu' '422 booking_rule_violation' ("status=" + $r.status + " code=" + $r.json.error.code) ($r.status -eq 422) $r.raw

$slotsC2 = Get-Slots $court2Id (D 6)
$r = Invoke-Api 'POST' '/bookings' (Get-Body $courtId (D 6) @($slotsC2[1].id)) $u4.token "tc04-court-$stamp"
Add-Result 'TC-04' 'Slot thuoc court khac' '422 booking_rule_violation' ("status=" + $r.status + " code=" + $r.json.error.code) ($r.status -eq 422) $r.raw

$r = Invoke-Api 'POST' '/bookings' (Get-Body $courtId (D 2) @($slotsD1[1].id)) $u4.token "tc04-wd-$stamp"
Add-Result 'TC-04' 'Slot sai weekday' '422 booking_rule_violation' ("status=" + $r.status + " code=" + $r.json.error.code) ($r.status -eq 422) $r.raw

$r = Invoke-Api 'POST' '/bookings' (Get-Body $courtId (D 6) @($slotsD6[1].id, $slotsD6[1].id)) $u4.token "tc04-dup-$stamp"
Add-Result 'TC-04' 'Slot trung trong cung request' '400' ("status=" + $r.status + " code=" + $r.json.error.code) ($r.status -eq 400) $r.raw

# ---------------------------------------------------------------- TC-05
Write-Host "== TC-05 reject qua khu/blackout/da bi chiem =="
$r = Invoke-Api 'POST' '/bookings' (Get-Body $courtId (D -1) @($slotsD1[1].id)) $u4.token "tc05-past-$stamp"
Add-Result 'TC-05' 'Ngay qua khu' '422' ("status=" + $r.status + " code=" + $r.json.error.code) ($r.status -eq 422) $r.raw

$r = Invoke-Api 'POST' '/bookings' (Get-Body $courtId (D 2) @($slotsD2[2].id)) $u4.token "tc05-bo-$stamp"
Add-Result 'TC-05' 'Slot nam trong blackout' '409 slot_unavailable' ("status=" + $r.status + " code=" + $r.json.error.code) ($r.status -eq 409 -and $r.json.error.code -eq 'slot_unavailable') $r.raw

$u5 = New-QaUser 'five'
$r = Invoke-Api 'POST' '/bookings' (Get-Body $courtId (D 7) @($slotsD7[1].id)) $u5.token "tc05-taken-$stamp"
$booking5 = $r.json.data
$u6 = New-QaUser 'six'
$r = Invoke-Api 'POST' '/bookings' (Get-Body $courtId (D 7) @($slotsD7[1].id)) $u6.token "tc05-taken2-$stamp"
Add-Result 'TC-05' 'Slot da bi nguoi khac dat' '409 slot_unavailable' ("status=" + $r.status + " code=" + $r.json.error.code) ($r.status -eq 409 -and $r.json.error.code -eq 'slot_unavailable') $r.raw

$r = Invoke-Api 'POST' '/bookings' (Get-Body $court3Id (D 7) @((Get-SlotIdFromOh (Invoke-Api 'GET' "/admin/courts/$court3Id/operating-hours" $null $adminToken $null).json.data ($today.AddDays(7)) 8))) $u4.token "tc05-inactive-$stamp"
Add-Result 'TC-05' 'Court inactive' '422' ("status=" + $r.status + " code=" + $r.json.error.code) ($r.status -eq 422) $r.raw

# ---------------------------------------------------------------- TC-06
Write-Host "== TC-06 ownership =="
$r = Invoke-Api 'GET' "/bookings/$($booking5.id)" $null $u6.token $null
Add-Result 'TC-06' 'User khac xem detail' '404' ("status=" + $r.status + " code=" + $r.json.error.code) ($r.status -eq 404) $r.raw

$r = Invoke-Api 'POST' "/bookings/$($booking5.id)/cancel" $null $u6.token $null
Add-Result 'TC-06' 'User khac cancel' '404' ("status=" + $r.status + " code=" + $r.json.error.code) ($r.status -eq 404) $r.raw

$r = Invoke-Api 'GET' '/bookings' $null $u5.token $null
$found = @($r.json.data | Where-Object { $_.id -eq $booking5.id }).Count
Add-Result 'TC-06' 'Chu so huu thay booking trong list' '200, co booking' ("status=" + $r.status + " found=" + $found) ($r.status -eq 200 -and $found -eq 1) $r.raw

$r = Invoke-Api 'GET' "/bookings?customerId=$($u5.id)" $null $u6.token $null
Add-Result 'TC-06' 'Query customerId khong doi chu so huu' '200, total=0' ("status=" + $r.status + " total=" + $r.json.meta.total) ($r.status -eq 200 -and $r.json.meta.total -eq 0) $r.raw

$r = Invoke-Api 'GET' "/bookings/$($booking5.id)" $null $null $null
Add-Result 'TC-06' 'Khong co token' '401' ("status=" + $r.status) ($r.status -eq 401) $r.raw

$r = Invoke-Api 'GET' "/bookings/$($booking5.id)" $null $adminToken $null
Add-Result 'TC-06' 'ADMIN khac chu van 404' '404' ("status=" + $r.status) ($r.status -eq 404) $r.raw

Sql "UPDATE users SET status='INACTIVE' WHERE email='$($u6.email)';" | Out-Null
$r = Invoke-Api 'GET' '/bookings' $null $u6.token $null
Add-Result 'TC-06' 'User INACTIVE' '403' ("status=" + $r.status + " code=" + $r.json.error.code) ($r.status -eq 403) $r.raw
Sql "UPDATE users SET status='ACTIVE' WHERE email='$($u6.email)';" | Out-Null

# ---------------------------------------------------------------- TC-07
Write-Host "== TC-07 cancel + availability =="
$r = Invoke-Api 'POST' "/bookings/$($booking5.id)/cancel" $null $u5.token $null
$ok7 = $r.status -eq 200 -and $r.json.data.status -eq 'CANCELLED' -and $r.json.data.cancelledAt
Add-Result 'TC-07' 'Cancel truoc gio bat dau' '200 CANCELLED + cancelledAt' ("status=" + $r.status + " statusBooking=" + $r.json.data.status) $ok7 $r.raw

$avail = Get-Slots $courtId (D 7)
$restored = @($avail | Where-Object { $_.id -eq $slotsD7[1].id -and $_.available -eq $true }).Count
Add-Result 'TC-07' 'Availability duoc tra lai sau cancel' 'slot available=true' ("available=" + $restored) ($restored -eq 1) ($avail | ConvertTo-Json -Compress)

$r = Invoke-Api 'POST' "/bookings/$($booking5.id)/cancel" $null $u5.token $null
Add-Result 'TC-07' 'Cancel lan 2' '409 already_cancelled' ("status=" + $r.status + " code=" + $r.json.error.code) ($r.status -eq 409 -and $r.json.error.code -eq 'already_cancelled') $r.raw

$r = Invoke-Api 'POST' '/bookings' (Get-Body $courtId (D 7) @($slotsD7[1].id)) $u5.token "tc05-taken-$stamp"
$okReplay = $r.status -eq 200 -and $r.json.data.id -eq $booking5.id -and $r.json.data.status -eq 'CANCELLED'
Add-Result 'TC-07' 'Replay key cua booking da huy' '200 tra booking CANCELLED, khong tao moi' ("status=" + $r.status + " id=" + $r.json.data.id + " statusBooking=" + $r.json.data.status) $okReplay $r.raw

# ---------------------------------------------------------------- TC-08 / TC-09
Write-Host "== TC-08/09 concurrent cung slot =="
$uA = New-QaUser 'concA'
$uB = New-QaUser 'concB'
$slotConc = $slotsD8[1].id
$reqs = @()
for ($i = 1; $i -le 10; $i++) {
    $u = if ($i % 2 -eq 0) { $uB } else { $uA }
    $reqs += @{ method = 'POST'; path = '/bookings'; token = $u.token; key = "conc-$stamp-$i"; body = (Get-Body $courtId (D 8) @($slotConc)) }
}
$res = Invoke-Parallel $reqs
$created = @($res | Where-Object { $_.status -eq 201 }).Count
$conflict = @($res | Where-Object { $_.status -eq 409 }).Count
$serverErr = @($res | Where-Object { $_.status -ge 500 }).Count
Add-Result 'TC-08' '10 request dong thoi cung slot' '1x201, 9x409, 0x5xx' ("201=" + $created + " 409=" + $conflict + " 5xx=" + $serverErr) ($created -eq 1 -and $conflict -eq 9 -and $serverErr -eq 0) ($res | ForEach-Object { $_.status })

$winner = ($res | Where-Object { $_.status -eq 201 })[0].json.data
$dbBookings = Sql "SELECT count(*) FROM bookings WHERE court_id='$courtId' AND booking_date='$(D 8)' AND status='CONFIRMED';"
$dbSlots = Sql "SELECT count(*) FROM booking_slots WHERE court_id='$courtId' AND booking_date='$(D 8)' AND released_at IS NULL;"
$dbAudit = Sql "SELECT count(*) FROM audit_logs WHERE entity_id='$($winner.id)' AND action='BOOKING_CREATED';"
Add-Result 'TC-09' 'DB chi ghi 1 booking/1 slot/1 audit' 'bookings=1 slots=1 audits=1' ("bookings=$dbBookings slots=$dbSlots audits=$dbAudit") ($dbBookings -eq '1' -and $dbSlots -eq '1' -and $dbAudit -eq '1') @{ bookingId = $winner.id; dbBookings = $dbBookings; dbSlots = $dbSlots; dbAudit = $dbAudit }

# ---------------------------------------------------------------- TC-11
Write-Host "== TC-11 idempotency =="
$uC = New-QaUser 'idem'
$keySeq = "tc11-seq-$stamp"
$body9 = Get-Body $courtId (D 9) @($slotsD9[1].id)
$r1 = Invoke-Api 'POST' '/bookings' $body9 $uC.token $keySeq
$r2 = Invoke-Api 'POST' '/bookings' $body9 $uC.token $keySeq
$okSeq = $r1.status -eq 201 -and $r2.status -eq 200 -and $r1.json.data.id -eq $r2.json.data.id
Add-Result 'TC-11' 'Retry tuan tu cung key' '201 roi 200, cung id' ("status1=" + $r1.status + " status2=" + $r2.status + " sameId=" + ($r1.json.data.id -eq $r2.json.data.id)) $okSeq @{ first = $r1.raw; second = $r2.raw }

$uD = New-QaUser 'idem2'
$keyConc = "tc11-conc-$stamp"
$body10 = Get-Body $courtId (D 10) @($slotsD10[1].id)
$reqs = @()
for ($i = 1; $i -le 8; $i++) { $reqs += @{ method = 'POST'; path = '/bookings'; token = $uD.token; key = $keyConc; body = $body10 } }
$res = Invoke-Parallel $reqs
$c201 = @($res | Where-Object { $_.status -eq 201 }).Count
$c200 = @($res | Where-Object { $_.status -eq 200 }).Count
$ids = @($res | ForEach-Object { $_.json.data.id } | Sort-Object -Unique)
$dbCount = Sql "SELECT count(*) FROM bookings WHERE customer_id='$($uD.id)' AND idempotency_key='$keyConc';"
$okConc = $c201 -eq 1 -and $c200 -eq 7 -and $ids.Count -eq 1 -and $dbCount -eq '1'
Add-Result 'TC-11' '8 request dong thoi cung key' '1x201, 7x200, 1 booking trong DB' ("201=$c201 200=$c200 distinctIds=" + $ids.Count + " db=$dbCount") $okConc ($res | ForEach-Object { $_.status })

$r = Invoke-Api 'POST' '/bookings' (Get-Body $courtId (D 10) @($slotsD10[2].id)) $uD.token $keyConc
Add-Result 'TC-11' 'Cung key nhung body khac' '409 idempotency_conflict' ("status=" + $r.status + " code=" + $r.json.error.code) ($r.status -eq 409 -and $r.json.error.code -eq 'idempotency_conflict') $r.raw

$uE = New-QaUser 'idem3'
$r = Invoke-Api 'POST' '/bookings' (Get-Body $courtId (D 11) @($slotsD11[1].id)) $uE.token $keyConc
$okScope = $r.status -eq 201 -and $r.json.data.customerId -eq $uE.id
Add-Result 'TC-11' 'Key cua user khac khong ro ri booking' '201 booking moi cua user E' ("status=" + $r.status + " customer=" + $r.json.data.customerId) $okScope $r.raw

$r = Invoke-Api 'POST' "/bookings/$($r1.json.data.id)/cancel" $null $uC.token $null
$r = Invoke-Api 'POST' '/bookings' $body9 $uC.token $keySeq
$okCancelled = $r.status -eq 200 -and $r.json.data.status -eq 'CANCELLED'
Add-Result 'TC-11' 'Retry key sau khi huy' '200, van booking CANCELLED' ("status=" + $r.status + " bookingStatus=" + $r.json.data.status) $okCancelled $r.raw

# ---------------------------------------------------------------- TC-12
Write-Host "== TC-12 atomic rollback (test tu dong) =="
$env:TEST_DATABASE_URL = "postgresql://sport:sport_123@localhost:5432/sport_booking_test?sslmode=disable"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location (Join-Path $root 'backend')
$t12 = & go test -count=1 -run 'TestBookingAtomicRollback|TestBookingOverlapConstraintRollsBackAllSlots' ./internal/bootstrap -v 2>&1
Pop-Location
$t12text = ($t12 | Out-String)
Add-Result 'TC-12' 'Atomic rollback + overlap constraint (test isolated schema)' 'PASS ca 2 test' (($t12text -split "`n" | Select-String '^(--- )?(PASS|FAIL|ok)' | ForEach-Object { $_.Line.Trim() }) -join ' | ') ($t12text -match 'PASS' -and $t12text -notmatch 'FAIL') $t12text

# ---------------------------------------------------------------- TC-13
Write-Host "== TC-13 eligibility boundary =="
$uF = New-QaUser 'bound'
$r = Invoke-Api 'POST' '/bookings' (Get-Body $courtId (D 30) @($slotsD30[1].id)) $uF.token "tc13-d30-$stamp"
Add-Result 'TC-13' 'Bien tren: hom nay +30 ngay' '201' ("status=" + $r.status + " code=" + $r.json.error.code) ($r.status -eq 201) $r.raw

$r = Invoke-Api 'POST' '/bookings' (Get-Body $courtId (D 31) @((Get-SlotId $today.AddDays(31) 8))) $uF.token "tc13-d31-$stamp"
Add-Result 'TC-13' 'Vuot horizon: +31 ngay' '422' ("status=" + $r.status + " code=" + $r.json.error.code) ($r.status -eq 422) $r.raw

$uG = New-QaUser 'limit'
$made = @()
foreach ($d in 12, 13, 14) {
    $s = Get-Slots $courtId (D $d)
    $rr = Invoke-Api 'POST' '/bookings' (Get-Body $courtId (D $d) @($s[1].id)) $uG.token "tc13-limit-$d-$stamp"
    $made += $rr.status
}
$ok3 = @($made | Where-Object { $_ -eq 201 }).Count -eq 3
Add-Result 'TC-13' 'Tao 3 booking active' '3x201' ($made -join ',') $ok3 $made

$s15 = Get-Slots $courtId (D 15)
$r = Invoke-Api 'POST' '/bookings' (Get-Body $courtId (D 15) @($s15[1].id)) $uG.token "tc13-limit4-$stamp"
Add-Result 'TC-13' 'Booking active thu 4' '422' ("status=" + $r.status + " code=" + $r.json.error.code) ($r.status -eq 422) $r.raw

$s12 = Get-Slots $courtId (D 12)
$list = Invoke-Api 'GET' '/bookings?status=CONFIRMED' $null $uG.token $null
$first = @($list.json.data)[0]
$r = Invoke-Api 'POST' "/bookings/$($first.id)/cancel" $null $uG.token $null
$r2 = Invoke-Api 'POST' '/bookings' (Get-Body $courtId (D 15) @($s15[1].id)) $uG.token "tc13-aftercancel-$stamp"
Add-Result 'TC-13' 'Booking da huy khong tinh vao gioi han' 'sau cancel tao duoc 201' ("cancel=" + $r.status + " create=" + $r2.status) ($r.status -eq 200 -and $r2.status -eq 201) $r2.raw

# ---------------------------------------------------------------- evidence
$summary = [ordered]@{
    runAt = (Get-Date).ToString('o')
    baseUrl = $BaseUrl
    database = "$Container/$DbName"
    today = $today.ToString('yyyy-MM-dd')
    pass = $script:pass
    fail = $script:fail
    results = $results
    fixtures = [ordered]@{
        adminEmail = $admin.email; sportId = $sportId; courtId = $courtId
        court2Id = $court2Id; court3Id = $court3Id; blackoutId = $boId
    }
}
$summary | ConvertTo-Json -Depth 10 | Out-File -Encoding utf8 (Join-Path $OutDir 'api-evidence.json')

$dbChecks = @(
    "SELECT 'bookings_total', count(*) FROM bookings",
    "SELECT 'slots_active', count(*) FROM booking_slots WHERE released_at IS NULL",
    "SELECT 'audit_created', count(*) FROM audit_logs WHERE action='BOOKING_CREATED'",
    "SELECT 'double_occupancy', count(*) FROM (SELECT court_id, booking_date, starts_at, count(*) c FROM booking_slots WHERE released_at IS NULL GROUP BY 1,2,3 HAVING count(*)>1) x"
)
$dbOut = foreach ($q in $dbChecks) { Sql $q }
$dbOut | Out-File -Encoding utf8 (Join-Path $OutDir 'db-checks.txt')

@"
Commit : $(git -C $root rev-parse HEAD)
Branch : $(git -C $root rev-parse --abbrev-ref HEAD)
Go     : $(go version)
Base   : $BaseUrl
DB     : $dbLabel
Run    : $(Get-Date -Format o)
Result : $($script:pass) PASS / $($script:fail) FAIL
"@ | Out-File -Encoding utf8 (Join-Path $OutDir 'environment.txt')

Write-Host ""
Write-Host "===== KET QUA: $($script:pass) PASS / $($script:fail) FAIL ====="
Write-Host "Evidence: $OutDir"
if ($script:fail -gt 0) { exit 1 }
