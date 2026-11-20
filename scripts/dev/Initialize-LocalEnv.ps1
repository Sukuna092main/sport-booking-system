$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$examplePath = Join-Path $projectRoot '.env.example'
$envPath = Join-Path $projectRoot '.env'

if (Test-Path -LiteralPath $envPath) {
    throw 'File .env da ton tai. Script dung lai de khong ghi de credential hien co.'
}

function New-RandomBase64([int]$Length = 32) {
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $bytes = New-Object byte[] $Length
        $generator.GetBytes($bytes)
        return [Convert]::ToBase64String($bytes)
    }
    finally { $generator.Dispose() }
}

function New-RandomHex([int]$Length = 32) {
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $bytes = New-Object byte[] $Length
        $generator.GetBytes($bytes)
        return [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
    }
    finally { $generator.Dispose() }
}

if (-not (Test-Path -LiteralPath $examplePath)) {
    throw 'Khong tim thay .env.example trong thu muc goc repository.'
}

$contents = Get-Content -LiteralPath $examplePath -Raw
$generated = @{
    JWT_SECRET = New-RandomBase64 32
    EMAIL_ENCRYPTION_KEY = New-RandomBase64 32
    POSTGRES_PASSWORD = New-RandomHex 32
}
foreach ($name in $generated.Keys) {
    $pattern = '(?m)^' + [regex]::Escape($name) + '=.*$'
    $contents = [regex]::Replace($contents, $pattern, ($name + '=' + $generated[$name]))
}

[System.IO.File]::WriteAllText($envPath, $contents, [System.Text.UTF8Encoding]::new($false))
Write-Host 'Da tao .env local voi secret ngau nhien. Khong chia se hoac commit file nay.'
Write-Host 'Chay local bang Docker: docker compose up --build'
Write-Host 'Email va VNPAY mac dinh tat; hay tu dien credential cua rieng ban neu can bat.'
