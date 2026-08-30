# ============================================================================
#  Library Management System - One-Click Demo Launcher
#  ---------------------------------------------------------------------------
#  Starts the Django backend and the React/Vite frontend in two separate
#  terminal windows with a single command.
#
#  Usage:
#      powershell -ExecutionPolicy Bypass -File .\run_demo.ps1
# ============================================================================

# Location of this script = repository root
$Root = $PSScriptRoot
$BackendDir = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend"
$VenvPython = Join-Path $BackendDir "venv\Scripts\python.exe"
$Requirements = Join-Path $BackendDir "requirements.txt"
$FrontendPackage = Join-Path $FrontendDir "package.json"

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
function Write-ErrorBanner {
    param([string]$Message)
    Write-Host ""
    Write-Host "ERROR: $Message" -ForegroundColor Red
    Write-Host ""
}

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $BackendDir)) {
    Write-ErrorBanner "Backend directory not found: $BackendDir"
    exit 1
}
if (-not (Test-Path -LiteralPath $VenvPython)) {
    Write-ErrorBanner "Backend virtual environment not found: $VenvPython`nRun 'python -m venv venv' inside the backend folder and install requirements first."
    exit 1
}
if (-not (Test-Path -LiteralPath $Requirements)) {
    Write-ErrorBanner "requirements.txt not found: $Requirements"
    exit 1
}
if (-not (Test-Path -LiteralPath $FrontendPackage)) {
    Write-ErrorBanner "Frontend package.json not found: $FrontendPackage"
    exit 1
}

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   Library Management System - Demo Launcher" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Backend  : http://127.0.0.1:8000  (Django REST API)"
Write-Host "  Frontend : http://127.0.0.1:5173  (React + Vite)"
Write-Host "  Demo login: admin / admin123"
Write-Host ""
Write-Host "  Two new terminal windows will open. Press Ctrl+C in either" -ForegroundColor Yellow
Write-Host "  window when you are finished to stop that server." -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------------------------
# 1) Start Django backend in its own window
# ---------------------------------------------------------------------------
$backendCommand = "& '$VenvPython' manage.py runserver"
Write-Host "[1/2] Starting Django backend..." -ForegroundColor Green
Start-Process -FilePath "powershell.exe" -WorkingDirectory $BackendDir `
    -ArgumentList @("-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass",
                    "-Command",
                    "`$host.ui.RawUI.WindowTitle = 'LMS - Django Backend'; $backendCommand") `
    | Out-Null

# ---------------------------------------------------------------------------
# 2) Start React/Vite frontend in its own window
# ---------------------------------------------------------------------------
$frontendCommand = "npm run dev"
Write-Host "[2/2] Starting React/Vite frontend..." -ForegroundColor Green
Start-Process -FilePath "powershell.exe" -WorkingDirectory $FrontendDir `
    -ArgumentList @("-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass",
                    "-Command",
                    "`$host.ui.RawUI.WindowTitle = 'LMS - React Frontend'; $frontendCommand") `
    | Out-Null

Write-Host ""
Write-Host "Both servers are starting. Open http://127.0.0.1:5173 in your browser." -ForegroundColor Green
Write-Host "Backend health check: http://127.0.0.1:8000/api/v1/health/" -ForegroundColor Green
Write-Host ""