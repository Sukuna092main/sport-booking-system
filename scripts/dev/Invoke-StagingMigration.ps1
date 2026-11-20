# Chay Goose migration cho moi truong staging (Neon) bang Docker.
# Khong can cai goose tren may: dung dung image ma docker-compose dang dung.
#
# Vi du:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/Invoke-StagingMigration.ps1 -Command status
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/Invoke-StagingMigration.ps1 -Command up
#
# Chi dung endpoint DIRECT cua Neon. Pooled (-pooler) di qua PgBouncer, khong hop cho DDL.

param(
    [ValidateSet('status', 'up', 'version')]
    [string]$Command = 'status',
    [string]$EnvFile = (Join-Path $PSScriptRoot '../../backend/.env.staging'),
    [string]$Image = 'ghcr.io/kukymbr/goose-docker:3.24.0'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $EnvFile)) {
    throw "Khong tim thay file env: $EnvFile"
}

$directUrl = $null
foreach ($line in Get-Content -LiteralPath $EnvFile) {
    if ($line -match '^\s*STAGING_DATABASE_URL_DIRECT\s*=\s*(.+)$') {
        $directUrl = $Matches[1].Trim()
    }
}
if (-not $directUrl) {
    throw 'Thieu STAGING_DATABASE_URL_DIRECT trong file env.'
}

try { $uri = [Uri]$directUrl }
catch { throw 'STAGING_DATABASE_URL_DIRECT khong hop le; khong gui credential len chat.' }

if (-not $uri.Host.EndsWith('.neon.tech')) {
    throw 'URL khong tro toi Neon. Kiem tra lai file env.'
}
if ($uri.Host -like '*-pooler*') {
    throw 'Dang dung endpoint pooled (-pooler). Migration phai dung endpoint direct.'
}
if ($uri.Query -notmatch '(?:^|[?&])sslmode=(require|verify-ca|verify-full)(?:&|$)') {
    throw 'Ket noi Neon can sslmode=require, verify-ca hoac verify-full.'
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$migrations = Join-Path $repoRoot 'backend/migrations'
if (-not (Test-Path -LiteralPath $migrations)) {
    throw "Khong tim thay thu muc migrations: $migrations"
}

Write-Host "Goose '$Command' -> $($uri.Host)"
Write-Host "Migrations: $migrations"

# Truyen secret qua bien moi truong cua tien trinh, khong dat tren command line
# de URL khong lo ra danh sach tien trinh.
$previousDbString = $env:GOOSE_DBSTRING
$previousEap = $ErrorActionPreference
$output = $null
$exitCode = 0

try {
    $env:GOOSE_DBSTRING = $directUrl
    # goose ghi log ra stderr; PS 5.1 se coi do la loi neu con ErrorActionPreference=Stop.
    $ErrorActionPreference = 'Continue'
    $output = & docker run --rm `
        -v "${migrations}:/migrations" `
        -e GOOSE_DRIVER=postgres `
        -e GOOSE_MIGRATION_DIR=/migrations `
        -e GOOSE_DBSTRING `
        $Image $Command 2>&1
    $exitCode = $LASTEXITCODE
}
finally {
    $ErrorActionPreference = $previousEap
    $env:GOOSE_DBSTRING = $previousDbString
}

$output | ForEach-Object { Write-Host $_ }

if ($exitCode -ne 0) {
    throw "goose $Command that bai (exit $exitCode)."
}
