param(
  [string]$BaseUrl = "http://127.0.0.1:8000"
)

$ErrorActionPreference = "Stop"
$OutputEncoding = [System.Text.UTF8Encoding]::new()
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "== $Message =="
}

function Assert-True {
  param(
    [bool]$Condition,
    [string]$Message
  )
  if (-not $Condition) {
    throw $Message
  }
}

Write-Host "CalliLens backend readonly test"
Write-Host "BaseUrl: $BaseUrl"
Write-Host "This script does not upload files and does not modify data."

Write-Step "1. health"
$health = Invoke-RestMethod -Uri "$BaseUrl/api/health" -Method Get
Assert-True ($health.status -eq "ok") "Expected health.status = ok"
Write-Host "OK /api/health"

Write-Step "2. works"
$works = Invoke-RestMethod -Uri "$BaseUrl/api/works" -Method Get
Assert-True ($null -ne $works.works) "Expected works list"
Assert-True ($works.works.Count -ge 1) "Expected at least one work"
Write-Host "OK /api/works"
Write-Host ("Works count: " + $works.works.Count)
foreach ($work in $works.works) {
  Write-Host ("- " + $work.id + " | " + $work.title)
}

Write-Step "3. default work detail"
$defaultWorkId = $works.defaultWorkId
if ([string]::IsNullOrWhiteSpace($defaultWorkId)) {
  $defaultWorkId = "work_003"
}
$workDetail = Invoke-RestMethod -Uri "$BaseUrl/api/works/$defaultWorkId" -Method Get
Assert-True ($workDetail.id -eq $defaultWorkId) "Expected default work detail"
Write-Host ("OK /api/works/" + $defaultWorkId)
Write-Host ("Default title: " + $workDetail.title)

Write-Step "4. knowledge"
$knowledge = Invoke-RestMethod -Uri "$BaseUrl/api/knowledge" -Method Get
Assert-True ($knowledge.count -gt 0) "Expected knowledge count > 0"
Write-Host "OK /api/knowledge"
Write-Host ("Knowledge chunks: " + $knowledge.count)

Write-Step "5. local RAG ask"
$askBody = @{
  work_id = $defaultWorkId
  question = "RAG"
  use_llm = $false
} | ConvertTo-Json
$ask = Invoke-RestMethod -Uri "$BaseUrl/api/ask" -Method Post -ContentType "application/json; charset=utf-8" -Body $askBody
Assert-True ($ask.mode -eq "local_rag") "Expected mode = local_rag"
Assert-True ($ask.answer.Length -gt 0) "Expected non-empty answer"
Assert-True ($ask.sources.Count -gt 0) "Expected at least one source"
Write-Host "OK /api/ask"
Write-Host ("Mode: " + $ask.mode)
Write-Host ("Sources: " + $ask.sources.Count)

Write-Step "6. admin login"
$loginBody = @{
  password = "callilens-admin"
}
$login = Invoke-RestMethod -Uri "$BaseUrl/api/admin/login" -Method Post -ContentType "application/x-www-form-urlencoded" -Body "password=callilens-admin"
Assert-True ($login.ok -eq $true) "Expected admin login ok"
Write-Host "OK /api/admin/login"

Write-Host ""
Write-Host "All readonly backend checks passed."
Write-Host "Open frontend: http://127.0.0.1:5190/web/"
Write-Host "Open API docs: $BaseUrl/docs"
