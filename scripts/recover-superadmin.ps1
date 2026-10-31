param([Parameter(Mandatory=$true)][string]$Email)
$ErrorActionPreference="Stop"
$repo=(Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Push-Location (Join-Path $repo "server")
try{
  if (!(Test-Path ".env")){throw "Configure the trusted PostgreSQL DATABASE_URL in server/.env first"}
  $secure=Read-Host "New Super Admin password (16+ chars, number and symbol)" -AsSecureString
  $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try{$plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}
  finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
  $env:SRC_RECOVERY_EMAIL=$Email.Trim().ToLowerInvariant()
  $env:SRC_RECOVERY_PASSWORD=$plain
  $env:SRC_RECOVERY_CONFIRM="ROTATE_SUPERADMIN_PASSWORD"
  try{
    npm run recover:superadmin
    if($LASTEXITCODE -ne 0){throw "Super Admin recovery failed"}
  }finally{
    Remove-Item Env:SRC_RECOVERY_EMAIL,Env:SRC_RECOVERY_PASSWORD,Env:SRC_RECOVERY_CONFIRM -ErrorAction SilentlyContinue
    $plain=$null
  }
}finally{Pop-Location}
