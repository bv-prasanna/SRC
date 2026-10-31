param(
  [string]$Directory = "SRC",
  [switch]$SkipClone,
  [switch]$StartApi,
  [switch]$StartWeb,
  [switch]$UseDockerDb,
  [switch]$RunIntegrationTests,
  [switch]$RunCoverage,
  [switch]$SkipDemoSeed
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
  foreach ($sql in @("001_init.sql","002_business_sections.sql","003_scheme_drafts.sql","004_content.sql","005_standard_orders.sql","006_inventory.sql","007_identity.sql","008_fulfillment.sql","009_commerce.sql","010_paid_fulfillment.sql","011_operational_roles.sql","012_festival_members.sql","013_festival_counter_receipts.sql","014_standalone_scheme_section.sql","015_scheme_management.sql","016_jwt_superadmin.sql")) {
    $hostSql = Join-Path $repo "server/sql/$sql"
    $containerSql = "/tmp/src_$sql"
    Write-Host "Applying database migration: $sql" -ForegroundColor Cyan
    docker cp $hostSql "src-postgres-local:$containerSql"
    if ($LASTEXITCODE -ne 0) { throw "Could not copy migration: $sql" }
    docker exec src-postgres-local psql -v ON_ERROR_STOP=1 -U src -d src -f $containerSql
    if ($LASTEXITCODE -ne 0) { throw "Migration failed: $sql (see PostgreSQL error above)" }
  }
  if (-not $SkipDemoSeed) {
    Write-Host "Loading clearly marked sample products for LOCAL DEMO ONLY" -ForegroundColor Yellow
    $seedFile = Join-Path $repo "server/sql/dev_seed_catalogue_v3.sql"
    docker cp $seedFile "src-postgres-local:/tmp/dev_seed_catalogue_v2.sql"
    if ($LASTEXITCODE -ne 0) { throw "Failed to copy local demo seed" }
    docker exec src-postgres-local psql -v ON_ERROR_STOP=1 -U src -d src -f "/tmp/dev_seed_catalogue_v2.sql"
    if ($LASTEXITCODE -ne 0) { throw "Local demo seed failed" }
  }
}
Push-Location (Join-Path $repo "server")
try {
  if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Warning "Created server/.env; review before starting API."
  }
  if ($UseDockerDb -and ((Get-Content ".env" -Raw) -match "src_user:change_me")) {
    $token=([guid]::NewGuid().ToString("N")+[guid]::NewGuid().ToString("N"))
    @("PORT=8080","DATABASE_URL=postgresql://src:src_dev_only@127.0.0.1:5433/src","CORS_ORIGIN=http://localhost:8000","SRC_JWT_SECRET=$token","SRC_PAYMENTS_ENABLED=false") | Set-Content ".env"
    Write-Host "Created local-only .env configuration. Never commit this file."
  } elseif ($UseDockerDb) {
    Write-Host "Preserving your existing .env secrets and settings."
  }
  $envContents=Get-Content ".env" -Raw
  if ($envContents -match 'SRC_JWT_SECRET=REPLACE_WITH_48_PLUS_CRYPTOGRAPHICALLY_RANDOM_BYTES' -or $envContents -notmatch '(?m)^SRC_JWT_SECRET=') {
    if ($envContents -match '(?m)^NODE_ENV=production') { throw "Production JWT secret must be configured outside the repository." }
    [byte[]]$secretBytes=New-Object byte[] 48
    $random=[System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $random.GetBytes($secretBytes) } finally { $random.Dispose() }
    $newJwt=($secretBytes | ForEach-Object { $_.ToString("x2") }) -join ''
    if ($envContents -match '(?m)^SRC_JWT_SECRET=') {
      $envContents=[regex]::Replace($envContents,'(?m)^SRC_JWT_SECRET=.*
  if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
  if (-not $UseDockerDb) {
    Write-Host "Using DATABASE_URL from server/.env (no Docker needed)" -ForegroundColor Cyan
    npm run migrate
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL migration failed. Check server/.env DATABASE_URL" }
    if (-not $SkipDemoSeed) {
      npm run seed:demo
      if ($LASTEXITCODE -ne 0) { throw "Demo seed failed" }
    }
  }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "TypeScript build failed" }
  npm test
  if ($LASTEXITCODE -ne 0) { throw "Node tests failed" }
  if ($RunCoverage) {
    npm run coverage
    if ($LASTEXITCODE -ne 0) { throw "Coverage run failed" }
  }
  if ($RunIntegrationTests) {
    if (-not $UseDockerDb) {
      if (-not $env:SRC_TEST_DATABASE_URL) { throw "Set SRC_TEST_DATABASE_URL to an isolated database (name ending _test) before running -RunIntegrationTests without Docker" }
      npm run test:integration
      if ($LASTEXITCODE -ne 0) { throw "Integration tests failed" }
    } else {
    $existingDb = docker exec src-postgres-local psql -U src -d src -tAc "SELECT 1 FROM pg_database WHERE datname='src_test'"
    if (-not (($existingDb | Out-String).Trim() -eq "1")) {
      docker exec src-postgres-local createdb -U src src_test
      if ($LASTEXITCODE -ne 0) { throw "Could not create isolated src_test database" }
    }
    $env:SRC_TEST_DATABASE_URL = "postgresql://src:src_dev_only@127.0.0.1:5433/src_test"
    $prevPayments=$env:SRC_PAYMENTS_ENABLED
    $env:SRC_PAYMENTS_ENABLED="false"
    try {
      npm run test:integration
      if ($LASTEXITCODE -ne 0) { throw "Integration tests failed" }
    } finally { Remove-Item Env:SRC_TEST_DATABASE_URL -ErrorAction SilentlyContinue; $env:SRC_PAYMENTS_ENABLED=$prevPayments }
    }
  }
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
,"SRC_JWT_SECRET=$newJwt")
    } else { $envContents+="`nSRC_JWT_SECRET=$newJwt`n" }
    Set-Content ".env" $envContents
    Write-Host "Generated local-only JWT signing secret in server/.env" -ForegroundColor Yellow
  }
  npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
  if (-not $UseDockerDb) {
    Write-Host "Using DATABASE_URL from server/.env (no Docker needed)" -ForegroundColor Cyan
    npm run migrate
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL migration failed. Check server/.env DATABASE_URL" }
    if (-not $SkipDemoSeed) {
      npm run seed:demo
      if ($LASTEXITCODE -ne 0) { throw "Demo seed failed" }
    }
  }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "TypeScript build failed" }
  npm test
  if ($LASTEXITCODE -ne 0) { throw "Node tests failed" }
  if ($RunCoverage) {
    npm run coverage
    if ($LASTEXITCODE -ne 0) { throw "Coverage run failed" }
  }
  if ($RunIntegrationTests) {
    if (-not $UseDockerDb) {
      if (-not $env:SRC_TEST_DATABASE_URL) { throw "Set SRC_TEST_DATABASE_URL to an isolated database (name ending _test) before running -RunIntegrationTests without Docker" }
      npm run test:integration
      if ($LASTEXITCODE -ne 0) { throw "Integration tests failed" }
    } else {
    $existingDb = docker exec src-postgres-local psql -U src -d src -tAc "SELECT 1 FROM pg_database WHERE datname='src_test'"
    if (-not (($existingDb | Out-String).Trim() -eq "1")) {
      docker exec src-postgres-local createdb -U src src_test
      if ($LASTEXITCODE -ne 0) { throw "Could not create isolated src_test database" }
    }
    $env:SRC_TEST_DATABASE_URL = "postgresql://src:src_dev_only@127.0.0.1:5433/src_test"
    $prevPayments=$env:SRC_PAYMENTS_ENABLED
    $env:SRC_PAYMENTS_ENABLED="false"
    try {
      npm run test:integration
      if ($LASTEXITCODE -ne 0) { throw "Integration tests failed" }
    } finally { Remove-Item Env:SRC_TEST_DATABASE_URL -ErrorAction SilentlyContinue; $env:SRC_PAYMENTS_ENABLED=$prevPayments }
    }
  }
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
