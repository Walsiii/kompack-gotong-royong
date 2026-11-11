@echo off
setlocal DisableDelayedExpansion
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Start-Kompack.ps1" -Lan %*
if errorlevel 1 pause
