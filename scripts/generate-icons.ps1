Add-Type -AssemblyName System.Drawing

$sourcePath = "src/assets/logo.png"
$outputDir = "build/appx"

if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir
}

function Resize-Image {
    param (
        [string]$Path,
        [int]$Width,
        [int]$Height,
        [string]$Output
    )
    $img = [System.Drawing.Image]::FromFile($Path)
    $bmp = New-Object System.Drawing.Bitmap($Width, $Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    
    # Fill background if needed (e.g. for wide logo)
    if ($Width -ne $Height) {
        $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 26, 26, 26))
        $g.FillRectangle($brush, 0, 0, $Width, $Height)
        # Center the square logo
        $scale = $Height / $img.Height
        $newW = $img.Width * $scale
        $newH = $Height
        $posX = ($Width - $newW) / 2
        $g.DrawImage($img, $posX, 0, $newW, $newH)
    } else {
        $g.DrawImage($img, 0, 0, $Width, $Height)
    }
    
    $bmp.Save($Output, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    $img.Dispose()
    Write-Host "Created: $Output ($Width x $Height)"
}

Resize-Image $sourcePath 50 50 "$outputDir/StoreLogo.png"
Resize-Image $sourcePath 44 44 "$outputDir/Square44x44Logo.png"
Resize-Image $sourcePath 71 71 "$outputDir/Square71x71Logo.png"
Resize-Image $sourcePath 150 150 "$outputDir/Square150x150Logo.png"
Resize-Image $sourcePath 310 310 "$outputDir/Square310x310Logo.png"
Resize-Image $sourcePath 310 150 "$outputDir/Wide310x150Logo.png"
