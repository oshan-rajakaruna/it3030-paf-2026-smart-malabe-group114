@ECHO OFF
SETLOCAL

set WRAPPER_DIR=%~dp0.mvn\wrapper
set PROPS_FILE=%WRAPPER_DIR%\maven-wrapper.properties

if not exist "%PROPS_FILE%" (
  echo Maven wrapper properties not found: %PROPS_FILE%
  exit /b 1
)

for /f "tokens=1,* delims==" %%A in (%PROPS_FILE%) do (
  if /I "%%A"=="distributionUrl" set DISTRIBUTION_URL=%%B
)

if "%DISTRIBUTION_URL%"=="" (
  echo distributionUrl is missing in %PROPS_FILE%
  exit /b 1
)

for %%F in ("%DISTRIBUTION_URL%") do set ZIP_NAME=%%~nxF
set ZIP_PATH=%WRAPPER_DIR%\%ZIP_NAME%
set EXTRACT_DIR=%WRAPPER_DIR%\dist

if not exist "%EXTRACT_DIR%\apache-maven-3.9.9\bin\mvn.cmd" (
  if not exist "%WRAPPER_DIR%" mkdir "%WRAPPER_DIR%"
  if not exist "%EXTRACT_DIR%" mkdir "%EXTRACT_DIR%"

  if not exist "%ZIP_PATH%" (
    echo Downloading Maven distribution...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri '%DISTRIBUTION_URL%' -OutFile '%ZIP_PATH%'"
    if errorlevel 1 exit /b 1
  )

  echo Extracting Maven distribution...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%ZIP_PATH%' -DestinationPath '%EXTRACT_DIR%' -Force"
  if errorlevel 1 exit /b 1
)

call "%EXTRACT_DIR%\apache-maven-3.9.9\bin\mvn.cmd" %*
exit /b %ERRORLEVEL%
