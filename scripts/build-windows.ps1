#!/usr/bin/env pwsh
# Simple Windows build script for AI Terminal

param(
    [switch]$Clean = $false,
    [string]$ElectronVersion = "32.3.3"
)

Write-Host "AI Terminal Windows Build Script" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# Clean dist directory if requested
if ($Clean) {
    Write-Host "Cleaning dist directory..." -ForegroundColor Yellow
    Remove-Item -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue
}

# Step 1: Build renderer
Write-Host "Building renderer..." -ForegroundColor Cyan
npm run build:renderer
if ($LASTEXITCODE -ne 0) {
    Write-Error "Renderer build failed"
    exit 1
}

# Step 2: Build electron
Write-Host "Building electron..." -ForegroundColor Cyan
npm run build:electron
if ($LASTEXITCODE -ne 0) {
    Write-Error "Electron build failed"
    exit 1
}

# Step 3: Try electron-builder first
Write-Host "Attempting electron-builder..." -ForegroundColor Cyan
npm run dist:portable
$electronBuilderSuccess = ($LASTEXITCODE -eq 0)

if (-not $electronBuilderSuccess) {
    Write-Host "Electron-builder failed, creating manual build..." -ForegroundColor Yellow
    
    # Create release directory
    $releaseDir = "dist/release/win-unpacked"
    New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
    
    # Create app directory structure
    $appDir = "$releaseDir/resources/app"
    New-Item -ItemType Directory -Force -Path $appDir | Out-Null
    
    # Copy built files
    Write-Host "Copying application files..." -ForegroundColor Cyan
    Copy-Item -Path "dist/electron" -Destination "$appDir/" -Recurse -Force
    Copy-Item -Path "dist/*.html" -Destination "$appDir/" -Force -ErrorAction SilentlyContinue
    Copy-Item -Path "dist/assets" -Destination "$appDir/" -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item -Path "package.json" -Destination "$appDir/" -Force
    
    # Download Electron
    $electronUrl = "https://github.com/electron/electron/releases/download/v$ElectronVersion/electron-v$ElectronVersion-win32-x64.zip"
    $electronZip = "electron-temp.zip"
    
    Write-Host "Downloading Electron v$ElectronVersion..." -ForegroundColor Cyan
    try {
        Invoke-WebRequest -Uri $electronUrl -OutFile $electronZip -UseBasicParsing
        
        Write-Host "Extracting Electron..." -ForegroundColor Cyan
        Expand-Archive -Path $electronZip -DestinationPath $releaseDir -Force
        
        # Rename electron.exe
        $electronExe = "$releaseDir/electron.exe"
        $appExe = "$releaseDir/AI-Terminal.exe"
        if (Test-Path $electronExe) {
            Rename-Item $electronExe "AI-Terminal.exe"
            Write-Host "Renamed electron.exe to 'AI-Terminal.exe'" -ForegroundColor Green
        }
        
        # Clean up
        Remove-Item $electronZip -Force -ErrorAction SilentlyContinue
        
        Write-Host "Manual build completed successfully!" -ForegroundColor Green
    }
    catch {
        Write-Error "Manual build failed: $_"
        exit 1
    }
}

# Step 4: Create ZIP
Write-Host "Creating ZIP archive..." -ForegroundColor Cyan
$unpackedDir = "dist/release/win-unpacked"
if (Test-Path $unpackedDir) {
    $zipPath = "dist/release/AI-Terminal-win-unpacked.zip"
    Compress-Archive -Path "$unpackedDir/*" -DestinationPath $zipPath -Force
    
    $zipSize = (Get-Item $zipPath).Length
    $zipSizeMB = [math]::Round($zipSize / 1MB, 2)
    
    Write-Host "ZIP created: $zipPath" -ForegroundColor Green
    Write-Host "ZIP size: $zipSizeMB MB" -ForegroundColor Green
} else {
    Write-Error "Unpacked directory not found"
    exit 1
}

# Step 5: Show results
Write-Host "`nBuild Summary:" -ForegroundColor Green
Write-Host "==============" -ForegroundColor Green
Write-Host "Electron-builder success: $electronBuilderSuccess"
Write-Host "Final artifact: dist/release/AI-Terminal-win-unpacked.zip"

if (Test-Path "dist/release/win-unpacked/AI-Terminal.exe") {
    Write-Host "Executable: dist/release/win-unpacked/AI-Terminal.exe" -ForegroundColor Green
} elseif (Test-Path "dist/release/win-unpacked/electron.exe") {
    Write-Host "Executable: dist/release/win-unpacked/electron.exe" -ForegroundColor Green
} else {
    Write-Host "WARNING: No executable found" -ForegroundColor Red
}

Write-Host "`nBuild completed successfully! 🎉" -ForegroundColor Green