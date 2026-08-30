@echo off
rem ============================================================================
rem  Library Management System - One-Click Demo Launcher (wrapper)
rem  Launches run_demo.ps1 which opens the backend and frontend in two windows.
rem ============================================================================

title Library Management System - Demo Launcher

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_demo.ps1"

if errorlevel 1 (
    echo.
    echo Failed to launch the demo. See the error message above.
    pause
) else (
    echo.
    echo Launcher finished. The backend and frontend windows are open.
    pause
)