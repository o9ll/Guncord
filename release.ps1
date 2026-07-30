$ErrorActionPreference = "Stop"

git fetch --tags

pnpm install --frozen-lockfile
pnpm buildStandalone

$env:GH_TOKEN = $env:GITHUB_TOKEN

try {
    node electron-builder.config.cjs
} catch {
}

npx electron-builder --config electron-builder.config.cjs --win --publish always

$staging = "guncord-dist-staging"

New-Item -ItemType Directory -Path $staging -Force | Out-Null

if (Test-Path "dist\desktop") {
    Copy-Item "dist\desktop\*" "$staging\" -Recurse -Force
} elseif (Test-Path "dist") {
    Copy-Item "dist\*" "$staging\" -Recurse -Force
}

if (Test-Path "server") {
    Copy-Item "server" "$staging\server" -Recurse
}

if (Test-Path "release\guncord-dist") {
    Copy-Item "release\guncord-dist\*" "$staging\" -Recurse -Force
}

foreach ($file in @(
    "guncord-index.js",
    "guncord-preload.js"
)) {
    if (Test-Path $file) {
        Copy-Item $file "$staging\"
    }
}

if (-not (Test-Path "$staging\patcher.js")) {
    Write-Error "BUILD ERROR: patcher.js is missing from the staging root. The installer will not work."
    exit 1
}

Compress-Archive `
    -Path "$staging\*" `
    -DestinationPath "guncord-dist.zip" `
    -Force

Write-Host "guncord-dist.zip created ($([math]::Round((Get-Item 'guncord-dist.zip').Length / 1MB, 2)) MB)"