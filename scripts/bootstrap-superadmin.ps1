param([Parameter(Mandatory=$true)][string]$Email)
$ErrorActionPreference="Stop"
$repo=(Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Push-Location (Join-Path $repo "server")
try {
  if (-not (Test-Path ".env")) { throw "server/.env missing. Configure DATABASE_URL and apply migrations first." }
  $emailValue=$Email.Trim().ToLowerInvariant()
  if ($emailValue -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') { throw "Provide a valid administrator email." }
  $secure=Read-Host "New Super Admin password (16+ chars, number and symbol)" -AsSecureString
  $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  $env:SRC_BOOTSTRAP_EMAIL=$emailValue
  $env:SRC_BOOTSTRAP_PASSWORD=$plain
  $env:SRC_BOOTSTRAP_CONFIRM="CREATE_FIRST_SUPERADMIN"
  try {
    npm run bootstrap:superadmin
    if ($LASTEXITCODE -ne 0) { throw "Bootstrap failed; no second Super Admin was created." }
  } finally {
    Remove-Item Env:SRC_BOOTSTRAP_EMAIL,Env:SRC_BOOTSTRAP_PASSWORD,Env:SRC_BOOTSTRAP_CONFIRM -ErrorAction SilentlyContinue
    $plain=$null
  }
} finally { Pop-Location }
