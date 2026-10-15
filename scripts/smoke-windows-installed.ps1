# Isolated CI install/launch/uninstall; never targets an owner installation.
$ErrorActionPreference = 'Stop'
$installDir = Join-Path $env:RUNNER_TEMP 'companion-v62-installed'
$bundles = @(Get-ChildItem 'src-tauri/target/release/bundle/nsis' -Filter '*.exe' -File)
if ($bundles.Count -ne 1) { throw 'Expected one exact-build installer' }
$install = Start-Process -FilePath $bundles[0].FullName -ArgumentList @('/S', "/D=$installDir") -PassThru -Wait
if ($install.ExitCode -ne 0) { throw "NSIS install failed: $($install.ExitCode)" }
$app = @(Get-ChildItem -LiteralPath $installDir -Filter '*.exe' -File | Where-Object { $_.Name -notmatch 'uninstall' })
if ($app.Count -ne 1) { throw "Installed app binary count: $($app.Count)" }
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9222 --enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader'
$process = Start-Process -FilePath $app[0].FullName -PassThru
try {
  node scripts/smoke-windows-installed.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Installed WebView2 runtime verification failed' }
} finally {
  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  $uninstaller = Get-ChildItem -LiteralPath $installDir -Filter '*uninstall*.exe' -File | Select-Object -First 1
  if ($uninstaller) {
    $remove = Start-Process -FilePath $uninstaller.FullName -ArgumentList '/S' -PassThru -Wait
    if ($remove.ExitCode -ne 0) { throw "NSIS uninstall failed: $($remove.ExitCode)" }
  }
}
