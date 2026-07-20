# ==================== TapTap Trial Build Script ====================
# Usage: powershell -ExecutionPolicy Bypass -File .\build-zip.ps1
# Output: dist/gameidea-roug-taptap.zip
#
# Includes only runtime files, with index.html at zip root:
#   - index.html
#   - privacy.html
#   - src/*.js
#   - assets/bosses/*.jpg
# Excludes: .git/, *.md, *.txt, *.py, .vscode/, node_modules/, dist/, .deepcode/

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.Encoding]::UTF8
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$projectRoot = $PSScriptRoot
$distDir = Join-Path $projectRoot 'dist'
$stagingDir = Join-Path $projectRoot '.staging-taptap'
$zipPath = Join-Path $distDir 'gameidea-roug-taptap.zip'

Write-Host '========================================' -ForegroundColor Yellow
Write-Host '  TapTap Trial Build Tool' -ForegroundColor Yellow
Write-Host '========================================' -ForegroundColor Yellow
Write-Host "Project root: $projectRoot"
Write-Host "Output zip:   $zipPath"
Write-Host ''

if (Test-Path $stagingDir) { Remove-Item -Recurse -Force $stagingDir }
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
if (-not (Test-Path $distDir)) { New-Item -ItemType Directory -Path $distDir | Out-Null }

New-Item -ItemType Directory -Path $stagingDir | Out-Null
New-Item -ItemType Directory -Path (Join-Path $stagingDir 'src') | Out-Null
New-Item -ItemType Directory -Path (Join-Path $stagingDir 'assets') | Out-Null
New-Item -ItemType Directory -Path (Join-Path $stagingDir 'assets\bosses') | Out-Null

$filesToCopy = @(
    'index.html',
    'privacy.html',
    'src\audio.js',
    'src\bosses.js',
    'src\entities.js',
    'src\loop.js',
    'src\save.js',
    'src\ui.js'
)

Write-Host '[1/3] Copying game files...' -ForegroundColor Cyan
foreach ($file in $filesToCopy) {
    $src = Join-Path $projectRoot $file
    $dst = Join-Path $stagingDir $file
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $dst -Force
        Write-Host "  OK $file"
    } else {
        Write-Host "  MISSING $file" -ForegroundColor Red
        throw "Missing required file: $file"
    }
}

Write-Host '[2/3] Copying boss images...' -ForegroundColor Cyan
$bossAssetsDir = Join-Path $projectRoot 'assets\bosses'
if (Test-Path $bossAssetsDir) {
    $bossImages = Get-ChildItem -Path $bossAssetsDir -File | Where-Object { $_.Extension -in '.jpg', '.jpeg', '.png', '.webp' }
    foreach ($img in $bossImages) {
        Copy-Item -Path $img.FullName -Destination (Join-Path $stagingDir "assets\bosses\$($img.Name)") -Force
        Write-Host "  OK assets/bosses/$($img.Name)"
    }
    Write-Host "  Total: $($bossImages.Count) boss images"
} else {
    Write-Host '  WARN assets/bosses not found' -ForegroundColor Yellow
}

Write-Host '[3/3] Compressing zip...' -ForegroundColor Cyan
Compress-Archive -Path (Join-Path $stagingDir '*') -DestinationPath $zipPath -CompressionLevel Optimal -Force

Remove-Item -Recurse -Force $stagingDir

$zipInfo = Get-Item $zipPath
$sizeKB = [math]::Round($zipInfo.Length / 1024, 1)
$sizeMB = [math]::Round($zipInfo.Length / 1024 / 1024, 2)

Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host '  BUILD SUCCESS' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
Write-Host "Path: $zipPath"
if ($zipInfo.Length -gt 1MB) {
    Write-Host "Size: $sizeMB MB"
} else {
    Write-Host "Size: $sizeKB KB"
}
Write-Host ''
Write-Host 'Next steps:' -ForegroundColor Yellow
Write-Host '  1. Visit https://developer.taptap.cn/'
Write-Host '  2. Open your game -> Version Management -> Upload Trial Package'
Write-Host '  3. Upload this zip file'
Write-Host '  4. Fill in version (e.g. 1.0.0) and release notes'
Write-Host '  5. In "Compliance" section, provide privacy policy URL or upload privacy.html'
Write-Host '  6. Submit for review'
Write-Host ''
Write-Host 'privacy.html is at project root. Upload it to any static host' -ForegroundColor Cyan
Write-Host '(e.g. GitHub Pages) and paste the URL into TapTap backend.' -ForegroundColor Cyan
