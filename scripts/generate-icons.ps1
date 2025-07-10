# POAM Tracker Icon Generator for Windows
# Generates all required Tauri icon formats from the master SVG

Write-Host "🎨 POAM Tracker Icon Generator" -ForegroundColor Blue
Write-Host "================================" -ForegroundColor Blue

$masterSvg = Join-Path $PSScriptRoot "..\src-tauri\icons\icon-master.svg"
$iconsDir = Join-Path $PSScriptRoot "..\src-tauri\icons"

# Check if master SVG exists
if (-not (Test-Path $masterSvg)) {
    Write-Host "❌ Master SVG not found at: $masterSvg" -ForegroundColor Red
    exit 1
}

# Create icons directory if it doesn't exist
if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir -Force | Out-Null
}

Write-Host "📁 Icons will be generated in: $iconsDir" -ForegroundColor Yellow

# Icon sizes needed
$iconSizes = @(
    @{Size=32; Name="32x32.png"},
    @{Size=128; Name="128x128.png"},
    @{Size=256; Name="128x128@2x.png"},
    @{Size=256; Name="icon.png"},
    @{Size=30; Name="Square30x30Logo.png"},
    @{Size=44; Name="Square44x44Logo.png"},
    @{Size=71; Name="Square71x71Logo.png"},
    @{Size=89; Name="Square89x89Logo.png"},
    @{Size=107; Name="Square107x107Logo.png"},
    @{Size=142; Name="Square142x142Logo.png"},
    @{Size=150; Name="Square150x150Logo.png"},
    @{Size=284; Name="Square284x284Logo.png"},
    @{Size=310; Name="Square310x310Logo.png"},
    @{Size=50; Name="StoreLogo.png"}
)

# Check for ImageMagick
$magickPath = Get-Command "magick" -ErrorAction SilentlyContinue
if ($magickPath) {
    Write-Host "✅ ImageMagick found, generating icons..." -ForegroundColor Green
    
    foreach ($icon in $iconSizes) {
        $outputPath = Join-Path $iconsDir $icon.Name
        $size = $icon.Size
        
        try {
            & magick convert -background none -size "$($size)x$($size)" $masterSvg $outputPath
            Write-Host "  ✅ Generated $($icon.Name) ($($size)x$($size))" -ForegroundColor Green
        }
        catch {
            Write-Host "  ❌ Failed to generate $($icon.Name): $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    # Generate ICO file
    try {
        $icoPath = Join-Path $iconsDir "icon.ico"
        & magick convert -background none -size "256x256" $masterSvg $icoPath
        Write-Host "  ✅ Generated icon.ico" -ForegroundColor Green
    }
    catch {
        Write-Host "  ❌ Failed to generate ICO: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host "`n✨ Icon generation complete!" -ForegroundColor Green
}
else {
    Write-Host "❌ ImageMagick not found!" -ForegroundColor Red
    Write-Host "`n🔧 Installation options:" -ForegroundColor Yellow
    Write-Host "1. Install ImageMagick: https://imagemagick.org/script/download.php#windows" -ForegroundColor Cyan
    Write-Host "2. Or use the Node.js script: npm run generate-icons" -ForegroundColor Cyan
    Write-Host "3. Or use online SVG to PNG converters for each size needed" -ForegroundColor Cyan
    
    Write-Host "`n📋 Required sizes:" -ForegroundColor Yellow
    foreach ($icon in $iconSizes) {
        Write-Host "   - $($icon.Name): $($icon.Size)x$($icon.Size) pixels" -ForegroundColor Cyan
    }
    
    Write-Host "`nAlternatively, you can:" -ForegroundColor Yellow
    Write-Host "1. Open icon-master.svg in Inkscape or Illustrator" -ForegroundColor Cyan
    Write-Host "2. Export each size as PNG manually" -ForegroundColor Cyan
    Write-Host "3. Save them with the exact names listed above" -ForegroundColor Cyan
}

Write-Host "`n🎯 Next steps:" -ForegroundColor Blue
Write-Host "1. Run 'npm run tauri:build' to test the new icons" -ForegroundColor Cyan
Write-Host "2. Check the built application for correct icon display" -ForegroundColor Cyan 