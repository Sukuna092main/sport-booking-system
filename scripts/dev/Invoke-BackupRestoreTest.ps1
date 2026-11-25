# Script thuc hien kiem thu dien tap Backup & Restore Readiness (The #102)
# Chay bang Python + psycopg2, an toan tuyet doi:
#   - Khong bao gio ghi de Database Staging/Production
#   - Tao database dien tap doc lap tren Neon: sport_restore_rehearsal
#   - Kiem tra toan ven 10/10 bang va chay smoke truoc khi don dep
#
# Cach dung:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/Invoke-BackupRestoreTest.ps1

$ErrorActionPreference = 'Stop'

$scriptDir = $PSScriptRoot
$pyScript = Join-Path $scriptDir "backup_restore_rehearsal.py"

if (-not (Test-Path -LiteralPath $pyScript)) {
    throw "Khong tim thay script: $pyScript"
}

Write-Host "Dang thuc thi Backup & Restore Readiness Test..." -ForegroundColor Cyan
python -u $pyScript

if ($LASTEXITCODE -ne 0) {
    throw "Kiem thu Backup & Restore that bai (exit code $LASTEXITCODE)."
}
