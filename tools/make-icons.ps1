# Generates the application icons.
#
# Comments are in English on purpose: Windows PowerShell 5.1 reads .ps1 as
# ANSI, and Cyrillic here breaks the parser.
#
# Why a generator instead of a drawn file: the icon has to exist in two
# shapes at once. A "maskable" icon is cropped by the system to a circle
# or a squircle, so its content must stay inside the middle 80 per cent.
# An "any" icon is shown as is. The old set used one file for both, and
# that file had a rounded frame baked in - the system rounded it a second
# time and cut the frame off.
#
# Run:  powershell -ExecutionPolicy Bypass -File .\tools\make-icons.ps1

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$assets = Join-Path $root 'assets'

# Palette matches the application: slate-900 ground, amber lettering.
$bgTop     = [System.Drawing.Color]::FromArgb(255, 26, 35, 56)
$bgBottom  = [System.Drawing.Color]::FromArgb(255, 9, 14, 27)
$goldLight = [System.Drawing.Color]::FromArgb(255, 253, 200, 70)
$goldDark  = [System.Drawing.Color]::FromArgb(255, 233, 146, 8)
$flagDark  = [System.Drawing.Color]::FromArgb(255, 61, 76, 102)
$flagRed   = [System.Drawing.Color]::FromArgb(255, 209, 52, 46)

function New-Icon {
    param(
        [int]$Size,
        # Share of the side taken by the drawing. Smaller for maskable:
        # the system crop must not reach the letter.
        [double]$Content,
        [string]$Path
    )

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Full bleed background. No rounded corners on purpose - every system
    # applies its own shape, and a baked one shows up as a double edge.
    $full = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
    $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $full, $bgTop, $bgBottom, [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
    $g.FillRectangle($bg, $full)

    $box = $Size * $Content
    $left = ($Size - $box) / 2.0
    $top = ($Size - $box) / 2.0

    # The letter takes the upper part of the box, the flag bar the lower.
    $wHeight = $box * 0.62

    # Centre the whole group, not the letter: the letter plus the gap plus
    # the bar take about four fifths of the box, and centring the letter
    # alone left the drawing sitting high.
    $groupH = $wHeight + $box * 0.10 + $box * 0.085
    $wTop = $top + ($box - $groupH) / 2.0
    $stroke = $box * 0.145

    # A geometric W is a polyline drawn with a mitred pen: two descents
    # and two ascents. Cheaper and sharper than a font, and it looks the
    # same on any machine.
    #
    # The ends are pulled beyond the letter box and the drawing is
    # clipped to it. A pen cap is always square to the stroke, so on a
    # slanted stroke it comes out slanted too; the clip cuts the tips
    # horizontally, the way a letter is supposed to end.
    $inset = $stroke / 2.0
    $x0 = $left + $inset
    $x1 = $left + $box - $inset
    $span = $x1 - $x0
    $yTop = $wTop + $inset
    $yBottom = $wTop + $wHeight - $inset
    $over = ($yBottom - $yTop) * 0.10

    $points = @(
        (New-Object System.Drawing.PointF([float]$x0, [float]($yTop - $over))),
        (New-Object System.Drawing.PointF([float]($x0 + $span * 0.27), [float]($yBottom + $over))),
        (New-Object System.Drawing.PointF([float]($x0 + $span * 0.50), [float]($yTop + ($yBottom - $yTop) * 0.38))),
        (New-Object System.Drawing.PointF([float]($x0 + $span * 0.73), [float]($yBottom + $over))),
        (New-Object System.Drawing.PointF([float]$x1, [float]($yTop - $over)))
    )

    $letterRect = New-Object System.Drawing.RectangleF(
        [float]$left, [float]$wTop, [float]$box, [float]$wHeight)
    $gold = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $letterRect, $goldLight, $goldDark, [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)

    $pen = New-Object System.Drawing.Pen($gold, [float]$stroke)
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Miter
    $pen.MiterLimit = 12
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Flat
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Flat

    $clip = New-Object System.Drawing.RectangleF(
        [float]($left - 1), [float]$wTop, [float]($box + 2), [float]$wHeight)
    $g.SetClip($clip)
    $g.DrawLines($pen, $points)
    $g.ResetClip()

    # German flag as a short bar: black would disappear on a dark ground,
    # so the first stripe is the slate the application already uses.
    $barH = [math]::Max(2.0, $box * 0.085)
    $barW = $box * 0.62
    $barX = $left + ($box - $barW) / 2.0
    $barY = $wTop + $wHeight + $box * 0.10
    $third = $barW / 3.0

    $stripes = @($flagDark, $flagRed, $goldLight)
    for ($i = 0; $i -lt 3; $i++) {
        $brush = New-Object System.Drawing.SolidBrush($stripes[$i])
        $rect = New-Object System.Drawing.RectangleF(
            [float]($barX + $third * $i), [float]$barY, [float]$third, [float]$barH)
        $g.FillRectangle($brush, $rect)
        $brush.Dispose()
    }

    # Rounded ends of the bar: draw two circles over the outer stripes.
    $r = $barH / 2.0
    $capLeft = New-Object System.Drawing.SolidBrush($flagDark)
    $g.FillEllipse($capLeft, [float]($barX - $r), [float]$barY, [float]$barH, [float]$barH)
    $capLeft.Dispose()
    $capRight = New-Object System.Drawing.SolidBrush($goldLight)
    $g.FillEllipse($capRight, [float]($barX + $barW - $r), [float]$barY, [float]$barH, [float]$barH)
    $capRight.Dispose()

    $pen.Dispose(); $gold.Dispose(); $bg.Dispose(); $g.Dispose()

    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    $kb = [math]::Round((Get-Item $Path).Length / 1KB, 1)
    Write-Output ("{0} - {1}x{1}, {2} KB" -f (Split-Path -Leaf $Path), $Size, $kb)
}

# "any": shown as is, the drawing may come closer to the edge.
New-Icon -Size 192 -Content 0.68 -Path (Join-Path $assets 'icon-192.png')
New-Icon -Size 512 -Content 0.68 -Path (Join-Path $assets 'icon-512.png')

# "maskable": the system crops to a circle, keep clear of the edge.
New-Icon -Size 512 -Content 0.54 -Path (Join-Path $assets 'icon-maskable-512.png')
New-Icon -Size 192 -Content 0.54 -Path (Join-Path $assets 'icon-maskable-192.png')

Write-Output 'Done.'
