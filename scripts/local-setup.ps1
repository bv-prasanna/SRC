param(
 [string]$Directory="SRC",
 [switch]$SkipClone,
 [switch]$StartApi,
 [switch]$StartWeb,
 [switch]$UseDockerDb,
 [switch]$RunIntegrationTests,
 [switch]$RunCoverage,
 [switch]$SeedDemo,
 [switch]$SkipDemoSeed
)
$ErrorActionPreference="Stop"
function Require([string]$cmd){if(!(Get-Command $cmd -ErrorAction SilentlyContinue)){throw "Required tool missing: $cmd"}}
Require node
Require npm
if(!$SkipClone){
 Require git
 if(Test-Path $Directory){
  Push-Location $Directory
  try{git pull --ff-only;if($LASTEXITCODE -ne 0){throw "Git pull failed"}}finally{Pop-Location}
 }else{git clone https://github.com/bv-prasanna/SRC.git $Directory;if($LASTEXITCODE -ne 0){throw "Git clone failed"}}
}
$repo=(Resolve-Path $Directory).Path
if(!(Test-Path (Join-Path $repo "server/package.json"))){throw "SRC server/package.json not found. Use -Directory . inside repository root"}
if($UseDockerDb){
 Require docker
 docker info | Out-Null
 if($LASTEXITCODE -ne 0){throw "Docker unavailable"}
 $found=docker ps -a --format "{{.Names}}" | Where-Object {$_ -eq "src-postgres-local"}
 if(!$found){
  docker run -d --name src-postgres-local -e POSTGRES_USER=src -e POSTGRES_PASSWORD=src_dev_only -e POSTGRES_DB=src -p 127.0.0.1:5433:5432 -v src_postgres_data:/var/lib/postgresql/data postgres:16
  if($LASTEXITCODE -ne 0){throw "Could not start local database"}
 }else{docker start src-postgres-local | Out-Null}
 $ready=$false
 for($i=0;$i -lt 30;$i++){
  docker exec src-postgres-local pg_isready -U src -d src *> $null
  if($LASTEXITCODE -eq 0){$ready=$true;break}
  Start-Sleep -Seconds 1
 }
 if(!$ready){throw "Local PostgreSQL failed readiness"}
}
Push-Location (Join-Path $repo "server")
try{
 if(!(Test-Path ".env")){Copy-Item ".env.example" ".env";Write-Host "Created .env: configure DATABASE_URL before continuing" -ForegroundColor Yellow}
 $raw=Get-Content ".env" -Raw
 if($UseDockerDb -and $raw -match 'src_user:change_me|YOUR_NEON|DATABASE_URL=$'){
  $raw=[regex]::Replace($raw,'(?m)^DATABASE_URL=.*$',"DATABASE_URL=postgresql://src:src_dev_only@127.0.0.1:5433/src")
 }
 if($raw -notmatch '(?m)^SRC_JWT_SECRET=[a-zA-Z0-9]{48,}' -or $raw -match 'SRC_JWT_SECRET=REPLACE_WITH'){
  [byte[]]$bytes=New-Object byte[] 48
  $rng=[System.Security.Cryptography.RandomNumberGenerator]::Create()
  try{$rng.GetBytes($bytes)}finally{$rng.Dispose()}
  $secret=($bytes|ForEach-Object{$_.ToString("x2")}) -join ''
  if($raw -match '(?m)^SRC_JWT_SECRET='){$raw=[regex]::Replace($raw,'(?m)^SRC_JWT_SECRET=.*$',"SRC_JWT_SECRET=$secret")}
  else{$raw+="`nSRC_JWT_SECRET=$secret`n"}
  Write-Host "Generated local-only signing secret (not printed)" -ForegroundColor Yellow
 }
 if($raw -notmatch '(?m)^SRC_PAN_ENCRYPTION_KEY=[a-fA-F0-9]{64}
 npm install --no-audit --no-fund
 if($LASTEXITCODE -ne 0){throw "Dependency installation failed"}
 npm run migrate
 if($LASTEXITCODE -ne 0){throw "Database migration failed; verify DATABASE_URL, TLS and existing schema"}
 if($SeedDemo -and !$SkipDemoSeed){
  if($raw -match '(?m)^NODE_ENV=production'){throw "Refusing demo seed in a production environment"}
  npm run seed:demo
  if($LASTEXITCODE -ne 0){throw "Demo seed failed"}
 }
 npm run build
 if($LASTEXITCODE -ne 0){throw "TypeScript build failed"}
 npm test
 if($LASTEXITCODE -ne 0){throw "Node tests failed"}
 if($RunCoverage){
  npm run coverage
  if($LASTEXITCODE -ne 0){throw "Coverage run failed"}
 }
 if($RunIntegrationTests){
  if(!$env:SRC_TEST_DATABASE_URL){throw "Set SRC_TEST_DATABASE_URL to an isolated PostgreSQL database ending _test"}
  npm run test:integration
  if($LASTEXITCODE -ne 0){throw "Integration tests failed"}
 }
 if($StartApi){
  Start-Process -FilePath "npm.cmd" -ArgumentList @("run","dev") -WorkingDirectory (Get-Location).Path
  Write-Host "Backend starting at http://localhost:8080/ready"
 }
}finally{Pop-Location}
if($StartWeb){
 Require python
 Start-Process -FilePath "python" -ArgumentList @("-m","http.server","8000") -WorkingDirectory $repo
 Write-Host "Frontend starting at http://localhost:8000"
}
Write-Host "SRC setup completed; financial collections remain disabled unless separately configured." -ForegroundColor Green
){
  [byte[]]$panBytes=New-Object byte[] 32
  $panRng=[System.Security.Cryptography.RandomNumberGenerator]::Create()
  try{$panRng.GetBytes($panBytes)}finally{$panRng.Dispose()}
  $panKey=($panBytes|ForEach-Object{$_.ToString("x2")}) -join ''
  if($raw -match '(?m)^SRC_PAN_ENCRYPTION_KEY='){$raw=[regex]::Replace($raw,'(?m)^SRC_PAN_ENCRYPTION_KEY=.*
 npm install --no-audit --no-fund
 if($LASTEXITCODE -ne 0){throw "Dependency installation failed"}
 npm run migrate
 if($LASTEXITCODE -ne 0){throw "Database migration failed; verify DATABASE_URL, TLS and existing schema"}
 if($SeedDemo -and !$SkipDemoSeed){
  if($raw -match '(?m)^NODE_ENV=production'){throw "Refusing demo seed in a production environment"}
  npm run seed:demo
  if($LASTEXITCODE -ne 0){throw "Demo seed failed"}
 }
 npm run build
 if($LASTEXITCODE -ne 0){throw "TypeScript build failed"}
 npm test
 if($LASTEXITCODE -ne 0){throw "Node tests failed"}
 if($RunCoverage){
  npm run coverage
  if($LASTEXITCODE -ne 0){throw "Coverage run failed"}
 }
 if($RunIntegrationTests){
  if(!$env:SRC_TEST_DATABASE_URL){throw "Set SRC_TEST_DATABASE_URL to an isolated PostgreSQL database ending _test"}
  npm run test:integration
  if($LASTEXITCODE -ne 0){throw "Integration tests failed"}
 }
 if($StartApi){
  Start-Process -FilePath "npm.cmd" -ArgumentList @("run","dev") -WorkingDirectory (Get-Location).Path
  Write-Host "Backend starting at http://localhost:8080/ready"
 }
}finally{Pop-Location}
if($StartWeb){
 Require python
 Start-Process -FilePath "python" -ArgumentList @("-m","http.server","8000") -WorkingDirectory $repo
 Write-Host "Frontend starting at http://localhost:8000"
}
Write-Host "SRC setup completed; financial collections remain disabled unless separately configured." -ForegroundColor Green
,"SRC_PAN_ENCRYPTION_KEY=$panKey")}
  else{$raw+="`nSRC_PAN_ENCRYPTION_KEY=$panKey`n"}
  Write-Host "Generated local AES-256 PAN encryption key (stored only in .env)" -ForegroundColor Yellow
 }
 Set-Content ".env" $raw
 npm install --no-audit --no-fund
 if($LASTEXITCODE -ne 0){throw "Dependency installation failed"}
 npm run migrate
 if($LASTEXITCODE -ne 0){throw "Database migration failed; verify DATABASE_URL, TLS and existing schema"}
 if($SeedDemo -and !$SkipDemoSeed){
  if($raw -match '(?m)^NODE_ENV=production'){throw "Refusing demo seed in a production environment"}
  npm run seed:demo
  if($LASTEXITCODE -ne 0){throw "Demo seed failed"}
 }
 npm run build
 if($LASTEXITCODE -ne 0){throw "TypeScript build failed"}
 npm test
 if($LASTEXITCODE -ne 0){throw "Node tests failed"}
 if($RunCoverage){
  npm run coverage
  if($LASTEXITCODE -ne 0){throw "Coverage run failed"}
 }
 if($RunIntegrationTests){
  if(!$env:SRC_TEST_DATABASE_URL){throw "Set SRC_TEST_DATABASE_URL to an isolated PostgreSQL database ending _test"}
  npm run test:integration
  if($LASTEXITCODE -ne 0){throw "Integration tests failed"}
 }
 if($StartApi){
  Start-Process -FilePath "npm.cmd" -ArgumentList @("run","dev") -WorkingDirectory (Get-Location).Path
  Write-Host "Backend starting at http://localhost:8080/ready"
 }
}finally{Pop-Location}
if($StartWeb){
 Require python
 Start-Process -FilePath "python" -ArgumentList @("-m","http.server","8000") -WorkingDirectory $repo
 Write-Host "Frontend starting at http://localhost:8000"
}
Write-Host "SRC setup completed; financial collections remain disabled unless separately configured." -ForegroundColor Green
