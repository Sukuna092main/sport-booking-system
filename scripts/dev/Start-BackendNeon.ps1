param(
    [string]$EnvFile = (Join-Path $PSScriptRoot '../../backend/.env')
)

$ErrorActionPreference = 'Stop'
$qaBackendPath = (Resolve-Path (Join-Path $PSScriptRoot '../../backend')).Path
$qaPreviousEnvironment = @{}

try {
    $null = Get-Command go -ErrorAction Stop
    foreach ($qaLine in Get-Content -LiteralPath $EnvFile) {
        if ($qaLine -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') { continue }
        $qaName = $Matches[1]
        $qaValue = $Matches[2].Trim()
        if ($qaName -notmatch '^(APP_[A-Z_]+|HTTP_[A-Z_]+|LOG_LEVEL|DATABASE_URL|DB_[A-Z_]+|JWT_[A-Z_]+|CORS_ALLOWED_ORIGINS)$') { continue }
        if ($qaValue.Length -ge 2 -and (
            ($qaValue.StartsWith('"') -and $qaValue.EndsWith('"')) -or
            ($qaValue.StartsWith("'") -and $qaValue.EndsWith("'"))
        )) { $qaValue = $qaValue.Substring(1, $qaValue.Length - 2) }
        if (-not $qaPreviousEnvironment.ContainsKey($qaName)) {
            $qaPreviousEnvironment[$qaName] = [Environment]::GetEnvironmentVariable($qaName, 'Process')
        }
        [Environment]::SetEnvironmentVariable($qaName, $qaValue, 'Process')
    }

    try { $qaDatabaseUri = [Uri]$env:DATABASE_URL }
    catch { throw 'DATABASE_URL khong hop le; kiem tra file env, khong gui credential len chat.' }
    if ($qaDatabaseUri.Scheme -notin @('postgres', 'postgresql') -or
        -not $qaDatabaseUri.Host.EndsWith('.neon.tech')) {
        throw 'Script nay chi chay backend voi Neon. Kiem tra DATABASE_URL trong file env.'
    }
    if ($qaDatabaseUri.Query -notmatch '(?:^|[?&])sslmode=(require|verify-ca|verify-full)(?:&|$)') {
        throw 'Ket noi Neon can sslmode=require, verify-ca hoac verify-full.'
    }

    if ([string]::IsNullOrWhiteSpace($env:JWT_SECRET)) {
        if ($env:APP_ENV -and $env:APP_ENV -ne 'development') {
            throw 'JWT_SECRET phai duoc cau hinh cho moi truong ngoai development.'
        }
        if (-not $qaPreviousEnvironment.ContainsKey('JWT_SECRET')) {
            $qaPreviousEnvironment['JWT_SECRET'] = [Environment]::GetEnvironmentVariable('JWT_SECRET', 'Process')
        }
        $qaRandom = [Security.Cryptography.RandomNumberGenerator]::Create()
        try {
            $qaSecretBytes = New-Object byte[] 32
            $qaRandom.GetBytes($qaSecretBytes)
            $env:JWT_SECRET = [Convert]::ToBase64String($qaSecretBytes)
        }
        finally { $qaRandom.Dispose() }
        Write-Host 'Da tao JWT_SECRET tam cho phien dev; dang nhap lai sau khi khoi dong lai backend.'
    }

    Write-Host 'Khoi dong backend voi Neon/TLS; khong tu chay migration hoac seed.'
    Push-Location $qaBackendPath
    try {
        & go run ./cmd/api
        if ($LASTEXITCODE -ne 0) { throw "Backend dung voi exit code $LASTEXITCODE." }
    }
    finally { Pop-Location }
}
finally {
    foreach ($qaName in $qaPreviousEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($qaName, $qaPreviousEnvironment[$qaName], 'Process')
    }
}
