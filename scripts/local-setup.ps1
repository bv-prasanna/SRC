param(
  [string]$Directory = "SRC",
  [switch]$SkipClone,
  [switch]$StartApi,
  [switch]$StartWeb,
  [switch]$UseDockerDb
)
$ErrorActionPreference = 'Stop'
function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' is unavailable. Install it and reopen PowerShell."
  }
}
Require-Command node
Require-Command npm
if (-not $SkipClone) {
  Require-Command git
  if (Test-Path $Directory) {
    Write-Host "Using existing repository folder: $Directory" -ForegroundColor Cyan
    Push-Location $Directory
    try { git fetch origin; if ($LASTEXITCODE -ne 0) { throw "git fetch failed" }; git pull --ff-only; if ($LASTEXITCODE -ne 0) { throw "git pull failed; resolve local changes manually" } }
    finally { Pop-Location }
  } else {
    git clone https://github.com/bv-prasanna/SRC.git $Directory
    if ($LASTEXITCODE -ne 0) { throw "git clone failed" }
  }
}
if (-not (Test-Path (Join-Path $Directory "server/package.json"))) { throw "server/package.json not found under $Directory" }
$repo = (Resolve-Path $Directory).Path
if ($UseDockerDb) {
  Require-Command docker
  docker info | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Docker is not running" }
  $exists = docker ps -a --format "{{.Names}}" | Where-Object { $_ -eq "src-postgres-local" }
  if (-not $exists) {
    docker run -d --name src-postgres-local -e POSTGRES_USER=src -e POSTGRES_PASSWORD=src_dev_only -e POSTGRES_DB=src -p 127.0.0.1:5433:5432 -v src_postgres_data:/var/lib/postgresql/data postgres:16
    if ($LASTEXITCODE -ne 0) { throw "Failed to create local PostgreSQL" }
  } else {
    docker start src-postgres-local | Out-Null
  }
  $ready=$false
  for ($i=0; $i -lt 25; $i++) {
    docker exec src-postgres-local pg_isready -U src -d src *> $null
    if ($LASTEXITCODE -eq 0) { $ready=$true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw "PostgreSQL did not become ready" }
  foreach ($sql in @("001_init.sql","002_business_sections.sql","003_scheme_drafts.sql","004_content.sql","005_standard_orders.sql","006_inventory.sql")) {
    $hostSql = Join-Path $repo "server/sql/$sql"
    $containerSql = "/tmp/src_$sql"
    Write-Host "Applying database migration: $sql" -ForegroundColor Cyan
    docker cp $hostSql "src-postgres-local:$containerSql"
    if ($LASTEXITCODE -ne 0) { throw "Could not copy migration: $sql" }
    docker exec src-postgres-local psql -v ON_ERROR_STOP=1 -U src -d src -f $containerSql
    if ($LASTEXITCODE -ne 0) { throw "Migration failed: $sql (see PostgreSQL error above)" }
  }
}
Push-Location (Join-Path $repo "server")
try {
  if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Warning "Created server/.env; review before starting API."
  }
  if ($UseDockerDb) {
    $token=([guid]::NewGuid().ToString("N")+[guid]::NewGuid().ToString("N"))
    @("PORT=8080","DATABASE_URL=postgresql://src:src_dev_only@127.0.0.1:5433/src","CORS_ORIGIN=http://localhost:8000","SRC_ADMIN_TOKEN=$token") | Set-Content ".env"
    Write-Host "Local-only test credentials generated in .env. Never commit this file."
  }
  npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "TypeScript build failed" }
  npm test
  if ($LASTEXITCODE -ne 0) { throw "Node tests failed" }
  Write-Host "Node build and test commands passed." -ForegroundColor Green
  if ($StartApi) {
    Start-Process -FilePath "npm.cmd" -ArgumentList "run","dev" -WorkingDirectory (Get-Location).Path
    Write-Host "API starting at http://localhost:8080/health"
  }
} finally { Pop-Location }
if ($StartWeb) {
  Require-Command python
  Start-Process -FilePath "python" -ArgumentList "-m","http.server","8000" -WorkingDirectory $repo
  Write-Host "Web starting at http://localhost:8000"
}
Write-Host "Repository: $repo"
Write-Host "No fireworks online checkout or subscription activation is available."
