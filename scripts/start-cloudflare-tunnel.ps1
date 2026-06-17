# Exposes local backend (port 4000) over HTTPS for Square OAuth + webhooks.
# Updates backend/.env POS_PROVIDER_BASE_URL when the tunnel URL is printed.

$cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
if (-not (Test-Path $cloudflared)) {
  $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($cmd) {
    $cloudflared = $cmd.Source
  }
}
if (-not $cloudflared -or -not (Test-Path $cloudflared)) {
  Write-Host 'cloudflared not found. Install: winget install Cloudflare.cloudflared'
  exit 1
}

$envFile = Join-Path $PSScriptRoot '..\backend\.env'
$oauthRedirectPath = '/pos/oauth/square/callback'

function Update-ProviderBaseUrl {
  param([string]$Url)

  if (-not (Test-Path $envFile)) {
    Write-Host ('backend/.env not found - set POS_PROVIDER_BASE_URL=' + $Url + ' manually.')
    return
  }

  $content = Get-Content $envFile -Raw
  if ($content -match '(?m)^POS_PROVIDER_BASE_URL=') {
    $content = $content -replace '(?m)^POS_PROVIDER_BASE_URL=.*$', ('POS_PROVIDER_BASE_URL=' + $Url)
  } else {
    $content = $content.TrimEnd() + "`nPOS_PROVIDER_BASE_URL=$Url`n"
  }

  Set-Content -Path $envFile -Value $content
  Write-Host ''
  Write-Host 'Updated backend/.env:'
  Write-Host ('  POS_PROVIDER_BASE_URL=' + $Url)
  Write-Host ('  Square OAuth redirect: ' + $Url + $oauthRedirectPath)
  Write-Host 'Restart the backend, then add that redirect URL in Square Developer Dashboard -> OAuth.'
  Write-Host ''
}

Write-Host ('Using: ' + $cloudflared)
Write-Host 'Starting tunnel to http://localhost:4000 ...'
& $cloudflared tunnel --url http://localhost:4000 2>&1 | ForEach-Object {
  $line = $_.ToString()
  Write-Host $line
  if ($line -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
    Update-ProviderBaseUrl $Matches[0]
  }
}
