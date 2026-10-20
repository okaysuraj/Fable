# Export the geometry in mobile/assets/brand/mark.svg using Windows' built-in drawing API.
# No app dependency is needed. Run from any directory with PowerShell on Windows.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$taskBrandDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../assets/brand'))
$taskBrandExports = @(
    @{ Name = 'icon.png'; Size = 1024; Background = '#0067DD'; Foreground = '#FFFFFF'; Scale = 1.0 },
    @{ Name = 'adaptive-foreground.png'; Size = 1024; Background = ''; Foreground = '#FFFFFF'; Scale = 0.78 },
    @{ Name = 'splash.png'; Size = 256; Background = ''; Foreground = '#0067DD'; Scale = 1.0 },
    @{ Name = 'favicon.png'; Size = 64; Background = '#0067DD'; Foreground = '#FFFFFF'; Scale = 1.0 }
)
foreach ($taskExport in $taskBrandExports) {
    $taskBitmap = [System.Drawing.Bitmap]::new($taskExport.Size, $taskExport.Size)
    $taskGraphics = [System.Drawing.Graphics]::FromImage($taskBitmap)
    $taskPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($taskExport.Foreground), 80)
    $taskBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#C7E1FF'))
    try {
        $taskGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $taskGraphics.Clear([System.Drawing.Color]::Transparent)
        if ($taskExport.Background) { $taskGraphics.Clear([System.Drawing.ColorTranslator]::FromHtml($taskExport.Background)) }
        $taskFactor = [single]($taskExport.Size / 1024)
        $taskGraphics.ScaleTransform($taskFactor, $taskFactor)
        $taskInset = [single](512 * (1 - $taskExport.Scale))
        $taskGraphics.TranslateTransform($taskInset, $taskInset)
        $taskGraphics.ScaleTransform([single]$taskExport.Scale, [single]$taskExport.Scale)
        $taskPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $taskPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        $taskPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
        $taskPoints = [System.Drawing.PointF[]]@([System.Drawing.PointF]::new(340, 700), [System.Drawing.PointF]::new(340, 300), [System.Drawing.PointF]::new(670, 300))
        $taskGraphics.DrawLines($taskPen, $taskPoints)
        $taskGraphics.DrawLine($taskPen, 340, 470, 590, 470)
        $taskAccent = [System.Drawing.PointF[]]@([System.Drawing.PointF]::new(700, 640), [System.Drawing.PointF]::new(760, 640), [System.Drawing.PointF]::new(760, 730), [System.Drawing.PointF]::new(670, 640))
        $taskGraphics.FillPolygon($taskBrush, $taskAccent)
        $taskBitmap.Save((Join-Path $taskBrandDirectory $taskExport.Name), [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $taskBrush.Dispose()
        $taskPen.Dispose()
        $taskGraphics.Dispose()
        $taskBitmap.Dispose()
    }
    Write-Output ('Exported ' + $taskExport.Name)
}
