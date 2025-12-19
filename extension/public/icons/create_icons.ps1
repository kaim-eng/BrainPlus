# Create placeholder icons for the extension
# This creates simple colored squares as icons

Write-Host "Creating placeholder icons..." -ForegroundColor Cyan

# Create icons directory if it doesn't exist
$iconsDir = "public\icons"
if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir -Force | Out-Null
}

# Function to create a simple PNG icon
function Create-Icon {
    param([int]$size, [string]$path)
    
    # Create a simple colored square using .NET
    Add-Type -AssemblyName System.Drawing
    
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    
    # Fill with blue background
    $blue = [System.Drawing.Color]::FromArgb(0, 132, 255)  # #0084ff
    $brush = New-Object System.Drawing.SolidBrush($blue)
    $graphics.FillRectangle($brush, 0, 0, $size, $size)
    
    # Add white "DP" text
    $white = [System.Drawing.Color]::White
    $font = New-Object System.Drawing.Font("Arial", [int]($size/3), [System.Drawing.FontStyle]::Bold)
    $textBrush = New-Object System.Drawing.SolidBrush($white)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    
    $graphics.DrawString("DP", $font, $textBrush, $rect, $format)
    
    # Save as PNG
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    
    # Cleanup
    $graphics.Dispose()
    $bitmap.Dispose()
    $brush.Dispose()
    $textBrush.Dispose()
    $font.Dispose()
}

try {
    Create-Icon -size 16 -path "$iconsDir\icon16.png"
    Write-Host "Created icon16.png" -ForegroundColor Green
    
    Create-Icon -size 48 -path "$iconsDir\icon48.png"
    Write-Host "Created icon48.png" -ForegroundColor Green
    
    Create-Icon -size 128 -path "$iconsDir\icon128.png"
    Write-Host "Created icon128.png" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "Success! Icons created in $iconsDir" -ForegroundColor Green
    Write-Host "Now rebuild the extension: npm run build" -ForegroundColor Yellow
    
} catch {
    Write-Host "Error creating icons: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Download any PNG images and rename them:" -ForegroundColor Yellow
    Write-Host "  - Save as $iconsDir\icon16.png (16x16 pixels)" -ForegroundColor White
    Write-Host "  - Save as $iconsDir\icon48.png (48x48 pixels)" -ForegroundColor White
    Write-Host "  - Save as $iconsDir\icon128.png (128x128 pixels)" -ForegroundColor White
}

