# Prueba técnica rápida (requiere API en ejecución)
param(
  [string]$BaseUrl = "http://localhost:5080",
  [string]$Fixture = "tests/fixtures/sample-benign.txt"
)

$root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path $Fixture)) { $Fixture = Join-Path $root "tests/fixtures/sample-benign.txt" }

Write-Host "GET /health"
Invoke-RestMethod "$BaseUrl/health" | ConvertTo-Json

Write-Host "GET /v1/capabilities"
Invoke-RestMethod "$BaseUrl/v1/capabilities" | ConvertTo-Json -Depth 5

Write-Host "POST /v1/analyses"
$headers = @{ "X-User-Id" = "tech-test"; "X-Tenant-Id" = "lab" }
$form = @{
  file = Get-Item -Path (Resolve-Path $Fixture)
  expectedProduct = "Demo Product"
}
$created = Invoke-RestMethod -Method Post -Uri "$BaseUrl/v1/analyses" -Headers $headers -Form $form
$id = $created.id
Write-Host "AnalysisId: $id"

for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  $job = Invoke-RestMethod "$BaseUrl/v1/analyses/$id" -Headers $headers
  Write-Host "Status: $($job.status)"
  if ($job.status -in @("Completed", "Failed")) {
    $job.report | ConvertTo-Json -Depth 8
    break
  }
}
