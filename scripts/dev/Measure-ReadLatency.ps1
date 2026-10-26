# Do read latency cho cac API doc, doi chieu NFR-07.
#
# NFR-07 (SRS-SB-001, technical proposal - KHONG phai SLA khach hang):
#   >= 95% read request binh thuong phai <= 2 giay, trong load profile da thong nhat.
#
# Script do tung request, tinh percentile, dem so request vuot 2s va error rate.
# Chay rieng cho WARM va COLD: cold = sau khi backend da ngu (Render Free ngu sau ~15 phut).
#
# VI DU:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/Measure-ReadLatency.ps1 -Label warm
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/Measure-ReadLatency.ps1 -Label cold -Requests 30

param(
    [string]$ApiBaseUrl = 'https://sport-booking-api-staging.onrender.com/api/v1',
    [ValidateSet('warm', 'cold')]
    [string]$Label = 'warm',
    [int]$Requests = 300,
    [int]$Concurrency = 10,
    [int]$TimeoutSeconds = 60,
    [string]$OutDir = '',
    # Endpoint duoc coi la "read request binh thuong" theo NFR-07.
    [string[]]$Endpoints = @('/courts', '/courts/{id}', '/courts/{id}/availability')
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $OutDir) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $OutDir = Join-Path $root "artifacts/tests/perf-$($stamp.Substring(0,8))"
}
New-Item -ItemType Directory -Force $OutDir | Out-Null

$TargetMs = 2000      # NFR-07: 95% read request <= 2s
$TargetPercent = 95

Add-Type -AssemblyName System.Net.Http

$client = [System.Net.Http.HttpClient]::new()
$client.Timeout = [TimeSpan]::FromSeconds($TimeoutSeconds)

function Get-Json([string]$Path) {
    $r = $client.GetAsync("$ApiBaseUrl$Path").Result
    $body = $r.Content.ReadAsStringAsync().Result
    return [pscustomobject]@{ status = [int]$r.StatusCode; json = ($body | ConvertFrom-Json) }
}

function Percentile([double[]]$Values, [double]$P) {
    if ($Values.Count -eq 0) { return 0 }
    $sorted = $Values | Sort-Object
    $rank = [Math]::Ceiling(($P / 100) * $sorted.Count) - 1
    if ($rank -lt 0) { $rank = 0 }
    if ($rank -ge $sorted.Count) { $rank = $sorted.Count - 1 }
    return [double]$sorted[$rank]
}

# ---------------------------------------------------------------- chuan bi

Write-Host "API      : $ApiBaseUrl"
Write-Host "Label    : $Label"
Write-Host "Requests : $Requests (concurrency $Concurrency)"
Write-Host "Tieu chi : NFR-07 - >= $TargetPercent% read request <= ${TargetMs}ms"
Write-Host ''

Write-Host 'Dang lay court id de do endpoint detail/availability...'
$courtsProbe = Get-Json '/courts'
if ($courtsProbe.status -ne 200) {
    throw "GET /courts tra $($courtsProbe.status); khong chuan bi duoc du lieu do."
}
$courtId = @($courtsProbe.json.data)[0].id
if (-not $courtId) {
    throw 'Khong co court nao de do. Can seed du lieu truoc (xem Reset-StagingFixture.ps1).'
}
$date = (Get-Date).Date.AddDays(2).ToString('yyyy-MM-dd')
Write-Host "  courtId = $courtId"
Write-Host "  date    = $date"
Write-Host ''

$paths = @()
foreach ($e in $Endpoints) {
    $paths += ($e -replace '\{id\}', $courtId) -replace '\{date\}', $date
}
$paths = $paths | ForEach-Object {
    # KHONG dung "$_?date=$date": PowerShell coi "$_?date" la mot ten bien duy
    # nhat (rong) nen chuoi bi cat cut thanh "=2026-10-28". Noi chuoi cho chac.
    if ($_ -match 'availability') { $_ + '?date=' + $date } else { $_ }
}

# ---------------------------------------------------------------- do

Write-Host "Bat dau do luc $(Get-Date -Format 'HH:mm:ss')..."
$samples = New-Object System.Collections.ArrayList
$errors = 0
$done = 0

while ($done -lt $Requests) {
    $batchSize = [Math]::Min($Concurrency, $Requests - $done)
    $batch = New-Object System.Collections.ArrayList

    for ($i = 0; $i -lt $batchSize; $i++) {
        $path = $paths[($done + $i) % $paths.Count]
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $task = $client.GetAsync("$ApiBaseUrl$path")
        [void]$batch.Add([pscustomobject]@{ path = $path; sw = $sw; task = $task })
    }

    [System.Threading.Tasks.Task]::WaitAll([System.Threading.Tasks.Task[]]@($batch | ForEach-Object { $_.task }))

    foreach ($b in $batch) {
        $b.sw.Stop()
        $ms = [double]$b.sw.ElapsedMilliseconds
        $status = [int]$b.task.Result.StatusCode
        if ($status -ne 200) { $errors++ }
        [void]$samples.Add([pscustomobject]@{
            path = $b.path
            ms = $ms
            status = $status
            at = (Get-Date).ToString('o')
        })
    }

    $done += $batchSize
    Write-Host ("  {0,4}/{1} request" -f $done, $Requests) -NoNewline
    Write-Host "`r" -NoNewline
}

$client.Dispose()
Write-Host ''
Write-Host "Do xong luc $(Get-Date -Format 'HH:mm:ss')."
Write-Host ''

# ---------------------------------------------------------------- tong hop

$all = [double[]]@($samples | ForEach-Object { $_.ms })
$ok = @($samples | Where-Object { $_.status -eq 200 })
$okMs = [double[]]@($ok | ForEach-Object { $_.ms })
$within = @($ok | Where-Object { $_.ms -le $TargetMs }).Count
$pctWithin = if ($ok.Count -gt 0) { [Math]::Round(100 * $within / $ok.Count, 2) } else { 0 }

$summary = [ordered]@{
    label = $Label
    apiBaseUrl = $ApiBaseUrl
    runAt = (Get-Date).ToString('o')
    requests = $Requests
    concurrency = $Concurrency
    endpoints = $paths
    errorCount = $errors
    errorRatePct = [Math]::Round(100 * $errors / [Math]::Max(1, $samples.Count), 2)
    minMs = ($all | Measure-Object -Minimum).Minimum
    meanMs = [Math]::Round(($all | Measure-Object -Average).Average, 1)
    p50Ms = Percentile $all 50
    p90Ms = Percentile $all 90
    p95Ms = Percentile $all 95
    p99Ms = Percentile $all 99
    maxMs = ($all | Measure-Object -Maximum).Maximum
    nfr07 = [ordered]@{
        target = ">= $TargetPercent% read request <= ${TargetMs}ms"
        withinTarget = $within
        totalOk = $ok.Count
        percentWithin = $pctWithin
        met = ($pctWithin -ge $TargetPercent)
    }
    note = 'NFR-07 la technical proposal, khong phai cam ket khach hang. Khong dung so lieu nay lam SLA.'
    samples = $samples
}

$jsonPath = Join-Path $OutDir "read-latency-$Label.json"
$summary | ConvertTo-Json -Depth 6 | Out-File -Encoding utf8 $jsonPath

Write-Host '=== KET QUA ==='
Write-Host ("  requests        {0}" -f $Requests)
Write-Host ("  errors          {0} ({1}%)" -f $errors, $summary.errorRatePct)
Write-Host ("  min / mean      {0} ms / {1} ms" -f $summary.minMs, $summary.meanMs)
Write-Host ("  p50 / p90       {0} ms / {1} ms" -f $summary.p50Ms, $summary.p90Ms)
Write-Host ("  p95 / p99       {0} ms / {1} ms" -f $summary.p95Ms, $summary.p99Ms)
Write-Host ("  max             {0} ms" -f $summary.maxMs)
Write-Host ''
Write-Host ("  NFR-07: {0}/{1} request <= {2}ms = {3}%  (can >= {4}%)  -> {5}" -f `
        $within, $ok.Count, $TargetMs, $pctWithin, $TargetPercent, $(if ($pctWithin -ge $TargetPercent) { 'DAT' } else { 'KHONG DAT' }))
Write-Host ''
Write-Host "Evidence: $jsonPath"
Write-Host 'Luu y: NFR-07 la technical proposal, khong phai SLA khach hang.'
