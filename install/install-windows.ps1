param([string]$InstallDir="$env:ProgramData\\Project-Titan",[int]$Port=1200,[string]$AdminEmail="admin@example.com")
$ErrorActionPreference="Stop"
function Has($n){[bool](Get-Command $n -ErrorAction SilentlyContinue)}
if(-not (Has winget)){throw "Windows Package Manager (winget) is required."}
if(-not (Has git)){winget install --id Git.Git -e --silent --accept-package-agreements --accept-source-agreements}
if(-not (Has docker)){winget install --id Docker.DockerDesktop -e --silent --accept-package-agreements --accept-source-agreements}
$env:Path=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')
$dockerDesktop="$env:ProgramFiles\\Docker\\Docker\\Docker Desktop.exe";if(Test-Path $dockerDesktop){Start-Process $dockerDesktop}
for($i=0;$i-lt 90;$i++){docker info *> $null;if($LASTEXITCODE-eq 0){break};Start-Sleep 5}
if($LASTEXITCODE-ne 0){throw "Docker Desktop is not ready. Complete its first-run setup or restart Windows, then rerun."}
if(Test-Path "$InstallDir\\.git"){git -C $InstallDir fetch origin;git -C $InstallDir reset --hard origin/main}else{if(Test-Path $InstallDir){Rename-Item $InstallDir "$InstallDir.incomplete-$(Get-Date -Format yyyyMMddHHmmss)"};git clone https://github.com/jrmediagroupvan/Project-Titan.git $InstallDir}
Set-Location $InstallDir
if(-not(Test-Path .env)){$db=[guid]::NewGuid().ToString('N');$auth=[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N');$enc=[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N');$minio=[guid]::NewGuid().ToString('N');$pass="Titan!"+[guid]::NewGuid().ToString('N').Substring(0,14);@"
NODE_ENV=production
TITAN_BIND_ADDRESS=0.0.0.0
TITAN_PORT=$Port
TITAN_BASE_URL=http://localhost:$Port
COOKIE_SECURE=false
POSTGRES_USER=titan
POSTGRES_DB=titan
POSTGRES_PASSWORD=$db
DATABASE_URL=postgresql://titan:$db@postgres:5432/titan?schema=public
REDIS_URL=redis://redis:6379
MINIO_ACCESS_KEY=titan-storage
MINIO_SECRET_KEY=$minio
MINIO_ENDPOINT=http://minio:9000
AUTH_SECRET=$auth
CREDENTIAL_ENCRYPTION_KEY=$enc
ADMIN_EMAIL=$AdminEmail
ADMIN_PASSWORD=$pass
TITAN_UPDATE_BRANCH=main
TITAN_GIT_REPOSITORY=https://github.com/jrmediagroupvan/Project-Titan.git
"@ | Set-Content .env -Encoding utf8;Write-Host "Temporary owner password: $pass"}
docker compose build --pull app updater
docker compose up -d
Write-Host "Project TITAN: http://localhost:$Port"
