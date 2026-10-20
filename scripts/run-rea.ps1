param(
  [string]$BrowserPath = 'C:\Program Files\Google\Chrome\Application\chrome.exe',
  [int]$Port = 4187
)
$ErrorActionPreference = 'Stop'
$canonicalShell = 'L:\Programs\PowerShell\7\pwsh.exe'
if ($PSHOME -ne 'L:\Programs\PowerShell\7' -and (Test-Path -LiteralPath $canonicalShell)) {
  & $canonicalShell -NoLogo -NoProfile -NonInteractive -File $PSCommandPath -BrowserPath $BrowserPath -Port $Port
  exit $LASTEXITCODE
}
Write-Output "PowerShell $($PSVersionTable.PSVersion), PSHOME=$PSHOME"
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$nodeCommand = (Get-Command node -ErrorAction Stop).Source
$reaCommand = (Get-Command rea -ErrorAction Stop).Source
if (-not (Test-Path -LiteralPath $BrowserPath -PathType Leaf)) { throw 'Select an existing Chrome-family browser.' }
$runName = 'run-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,6)
$runRoot = Join-Path $projectRoot "captures/$runName"
[System.IO.Directory]::CreateDirectory($runRoot) | Out-Null
$processInfo = [System.Diagnostics.ProcessStartInfo]::new()
$processInfo.FileName = $nodeCommand
$processInfo.ArgumentList.Add((Join-Path $projectRoot 'backend/server.mjs'))
$processInfo.WorkingDirectory = $projectRoot
$processInfo.UseShellExecute = $false
$processInfo.CreateNoWindow = $true
$processInfo.RedirectStandardOutput = $true
$processInfo.RedirectStandardError = $true
$processInfo.Environment['PORT'] = [string]$Port
$processInfo.Environment['TRAVEL_DB'] = Join-Path $runRoot 'isolated.sqlite'
$processInfo.Environment['TRAVEL_INSTANCE'] = $runName
$ownedProcess = [System.Diagnostics.Process]::new()
$ownedProcess.StartInfo = $processInfo
$ownedStarted = $false
$stdoutTask = $null
$stderrTask = $null
try {
  $ownedStarted = $ownedProcess.Start()
  $stdoutTask = $ownedProcess.StandardOutput.ReadToEndAsync()
  $stderrTask = $ownedProcess.StandardError.ReadToEndAsync()
  $ready = $false
  for ($attempt=0; $attempt -lt 30; $attempt++) {
    if ($ownedProcess.HasExited) { throw 'Owned local server exited before readiness.' }
    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 1
      if ($health.ok -and $health.instanceId -eq $runName) { $ready=$true; break }
    } catch { Start-Sleep -Milliseconds 150 }
  }
  if (-not $ready) { throw 'Local server did not become ready.' }
  $summary = @()
  foreach ($name in @('local-homepage','local-booking-flow','local-mobile','local-planner','local-orders','local-agency')) {
    $scenario = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "inputs/$name.json") | ConvertFrom-Json
    $scenario.browser.executable_path = $BrowserPath
    $scenario.start_url.url = $scenario.start_url.url.Replace('127.0.0.1:4173',"127.0.0.1:$Port")
    $inputPath=Join-Path $runRoot "$name.input.json"
    $outputPath=Join-Path $runRoot "$name.evidence.json"
    $scenario | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $inputPath -Encoding utf8
    & $reaCommand capture-browser-scenario $inputPath --json | Set-Content -LiteralPath $outputPath -Encoding utf8
    if ($LASTEXITCODE -ne 0) { throw "REA command failed: $name. Evidence retained at $outputPath" }
    $e=Get-Content -Raw -LiteralPath $outputPath | ConvertFrom-Json
    $failed=@($e.normalized_result.steps | Where-Object status -ne 'completed')
    if ($failed.Count -gt 0) { throw "Scenario action failed: $name. Evidence retained at $outputPath" }
    $summary += [pscustomobject]@{name=$name;evidence_id=$e.evidence_id;completed_steps=$e.normalized_result.steps.Count}
    Write-Output "PASS $name"
  }
  $summary | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $runRoot 'summary.json') -Encoding utf8
  Write-Output "Evidence saved to $runRoot"
} finally {
  # Retain the exact started Process handle; never find/kill a process by a reused PID.
  if ($ownedStarted -and -not $ownedProcess.HasExited) { $ownedProcess.Kill(); $ownedProcess.WaitForExit(5000) | Out-Null }
  if ($stdoutTask) { $stdoutTask.GetAwaiter().GetResult() | Set-Content -LiteralPath (Join-Path $runRoot 'server.stdout.log') -Encoding utf8 }
  if ($stderrTask) { $stderrTask.GetAwaiter().GetResult() | Set-Content -LiteralPath (Join-Path $runRoot 'server.stderr.log') -Encoding utf8 }
  $ownedProcess.Dispose()
}
