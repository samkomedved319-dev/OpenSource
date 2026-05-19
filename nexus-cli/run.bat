@echo off
:: ============================================================================
:: OpenSource CLI - Launch Script (Windows)
:: Usage: run.bat [args...]
:: Example: run.bat "Explain this codebase"
:: Example: run.bat --vault "C:\Users\you\Obsidian" "find auth patterns"
:: ============================================================================
setlocal

set "VERSION=1.1.0"
set "SCRIPT_DIR=%~dp0"

echo.
echo   OpenSource CLI v%VERSION%
echo   Local-First AI Coding Agent
echo.

:: Check if node is installed
where node >nul 2>&1
if errorlevel 1 (
    echo   [ERROR] Node.js not found. Install from https://nodejs.org
    exit /b 1
)

:: Check if Ollama is reachable (non-blocking warning)
curl -s --max-time 2 http://localhost:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo   [WARN]  Ollama not running. Start it with: ollama serve
    echo           Then pull a model:  ollama pull llama3.2
    echo.
)

:: Use OBSIDIAN_VAULT env var if set
if defined OBSIDIAN_VAULT (
    echo   [VAULT] %OBSIDIAN_VAULT%
    echo.
)

:: Install dependencies if node_modules is missing
if not exist "%SCRIPT_DIR%node_modules" (
    echo   [SETUP] Installing dependencies...
    call npm install --silent
    if errorlevel 1 (
        echo   [ERROR] npm install failed
        exit /b 1
    )
)

:: Build if dist is missing or source is newer
if not exist "%SCRIPT_DIR%dist\index.js" (
    echo   [BUILD] Compiling TypeScript...
    call npm run build
    if errorlevel 1 (
        echo   [ERROR] Build failed
        exit /b 1
    )
)

:: Run
node "%SCRIPT_DIR%dist\index.js" %*
