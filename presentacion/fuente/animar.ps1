# Agrega a la presentación: barras de tiempo que se llenan solas y videos que arrancan solos.
param([string]$Archivo)
$yaAbierto = [bool](Get-Process POWERPNT -ErrorAction SilentlyContinue)
$app = New-Object -ComObject PowerPoint.Application
$p = $app.Presentations.Open($Archivo, $false, $false, $false)
$reporte = @()
foreach ($slide in $p.Slides) {
  $seq = $slide.TimeLine.MainSequence
  # quitar efectos previos (si se corre dos veces)
  for ($i = $seq.Count; $i -ge 1; $i--) { $seq.Item($i).Delete() }
  foreach ($sh in $slide.Shapes) {
    if ($sh.Name -like 'barra-tiempo-*') {
      $segundos = [int]($sh.Name -replace 'barra-tiempo-', '')
      # 22 = Wipe (barrido), 2 = con la anterior: empieza solo al mostrar la diapositiva
      $ef = $seq.AddEffect($sh, 22, 0, 2)
      $ef.EffectParameters.Direction = 4   # desde la izquierda
      $ef.Timing.Duration = $segundos
      $reporte += "diapositiva $($slide.SlideIndex): barra de $segundos s"
    }
    if ($sh.Type -eq 16) {
      $sh.AnimationSettings.PlaySettings.PlayOnEntry = -1
      $sh.AnimationSettings.PlaySettings.HideWhileNotPlaying = 0
      $reporte += "diapositiva $($slide.SlideIndex): video $($sh.Name) arranca solo"
    }
  }
}
$p.Save()
$p.Close()
if (-not $yaAbierto) { $app.Quit() }
$reporte -join "`n"
