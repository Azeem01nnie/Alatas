param(
  [switch]$Rebuild
)

function Add-PathIfExists {
  param([string]$Dir)
  if ($Dir -and (Test-Path $Dir)) {
    if ($env:Path -notlike "*$Dir*") {
      $env:Path = "$Dir;$env:Path"
    }
  }
}

function Initialize-Toolchain {
  # nvm-windows / fnm / default Node installs (npm spawns a fresh shell without these)
  $nodeCandidates = @(
    $env:NVM_SYMLINK,
    'C:\nvm4w\nodejs',
    (Join-Path $env:ProgramFiles 'nodejs'),
    (Join-Path ${env:ProgramFiles(x86)} 'nodejs'),
    (Join-Path $env:LOCALAPPDATA 'Programs\node')
  ) | Where-Object { $_ }

  foreach ($dir in $nodeCandidates) {
    Add-PathIfExists $dir
    if (Get-Command node -ErrorAction SilentlyContinue) { break }
  }

  $mobileRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
  Add-PathIfExists (Join-Path $mobileRoot 'node_modules\.bin')

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js not found. Install Node (nvm-windows: C:\nvm4w\nodejs) or run from a terminal where 'node' works."
  }

  $sdkRoot = $env:ANDROID_HOME
  if (-not $sdkRoot) { $sdkRoot = $env:ANDROID_SDK_ROOT }
  if (-not $sdkRoot) { $sdkRoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
  if (Test-Path $sdkRoot) {
    $env:ANDROID_HOME = $sdkRoot
    $env:ANDROID_SDK_ROOT = $sdkRoot
    Add-PathIfExists (Join-Path $sdkRoot 'platform-tools')
    Add-PathIfExists (Join-Path $sdkRoot 'emulator')
  }
}

# Java 22+ breaks React Native CMake (configureCMakeDebug: restricted System methods)
$Jdk17 = 'C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot'

if (-not (Test-Path "$Jdk17\bin\java.exe")) {
  Write-Error "JDK 17 not found at: $Jdk17"
  exit 1
}

try {
  Initialize-Toolchain
} catch {
  Write-Error $_.Exception.Message
  exit 1
}

$env:JAVA_HOME = $Jdk17
# Prepend JDK 17 without dropping Node/Android paths added above
if ($env:Path -notlike "*$Jdk17\bin*") {
  $env:Path = "$Jdk17\bin;$env:Path"
}
if (-not $env:GRADLE_USER_HOME) {
  $env:GRADLE_USER_HOME = Join-Path $env:USERPROFILE '.gradle'
}

Write-Host "Using JAVA_HOME=$env:JAVA_HOME"
Write-Host "Using node=$((Get-Command node -ErrorAction Stop | Select-Object -ExpandProperty Source))"
Write-Host "Tip: use 'npm run android' instead of 'npx expo run:android' (JDK 17 required for native build)."
& java -version

Set-Location (Join-Path $PSScriptRoot '..')

function Repair-MainApplicationKt {
  $mainApp = 'android\app\src\main\java\com\uryzei\mobile\MainApplication.kt'
  if (-not (Test-Path $mainApp)) { return }

  $content = Get-Content $mainApp -Raw
  $fixed = $content -replace '(?m)^import com\.nozbe\.watermelondb\.jsi\.WatermelonDBJSIPackage;\r?\n', '' `
                    -replace '(?m)^import com\.facebook\.react\.bridge\.JSIModulePackage;\s*\r?\n', ''
  if ($fixed -ne $content) {
    Set-Content -Path $mainApp -Value $fixed -NoNewline
    Write-Host "    Patched MainApplication.kt (removed obsolete WatermelonDB JSI imports)"
  }
}

if ($Rebuild) {
  Write-Host "`n>>> Uninstalling old app from device/emulator..."
  $adb = Get-Command adb -ErrorAction SilentlyContinue
  if ($adb) {
    & $adb.Source uninstall com.uryzei.mobile 2>$null | Out-Null
  } else {
    Write-Host "    (adb not found - skip uninstall; uninstall manually from emulator if needed)"
  }

  Write-Host ">>> Regenerating native Android project (clean)..."
  npx expo prebuild --clean --platform android
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Repair-MainApplicationKt

  Write-Host ">>> Gradle clean..."
  Push-Location android
  .\gradlew.bat clean
  if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
  Pop-Location
} else {
  Write-Host "`n>>> Stopping stale Gradle daemons (wrong Java version)..."
  if (Test-Path android\gradlew.bat) {
    Push-Location android
    .\gradlew.bat --stop 2>$null | Out-Null
    Pop-Location
  }
}

Repair-MainApplicationKt

Write-Host ">>> Building and installing..."
npx expo run:android @args
exit $LASTEXITCODE
