@echo off
setlocal DisableDelayedExpansion
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Install-Portable.ps1" %*
if errorlevel 1 (
  if not defined CI pause
  exit /b 1
)
