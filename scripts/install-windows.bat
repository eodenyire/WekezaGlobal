@echo off
:: =============================================================================
::  install-windows.bat — WekezaGlobal Windows Installer (batch wrapper)
::
::  Launches the PowerShell installer with an execution-policy bypass so
::  users don't need to change system-wide PowerShell settings.
::
::  Usage:
::    Double-click install-windows.bat          — standard install
::    install-windows.bat --with-logging        — include ELK stack
::    install-windows.bat --skip-prereq-check   — skip version checks (CI)
:: =============================================================================
setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "REPO_ROOT=%%~fI"

echo.
echo ============================================================
echo   WekezaGlobal Developer Ecosystem - Windows Installer
echo ============================================================
echo   Repository: %REPO_ROOT%
echo.

where powershell >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] PowerShell not found. Install from: https://aka.ms/powershell
    pause & exit /b 1
)

set "PS_EXTRA="
:parse
if "%~1"=="" goto run
if /I "%~1"=="--with-logging"      set "PS_EXTRA=%PS_EXTRA% -WithLogging"
if /I "%~1"=="--skip-prereq-check" set "PS_EXTRA=%PS_EXTRA% -SkipPrereqCheck"
shift & goto parse

:run
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass ^
    -File "%SCRIPT_DIR%install-windows.ps1" %PS_EXTRA%

set "RC=%ERRORLEVEL%"
if %RC% neq 0 (
    echo.
    echo [ERROR] Installer exited with code %RC%. Review the output above.
    pause & exit /b %RC%
)
endlocal
