@echo off
setlocal

cd /d "%~dp0"

where corepack.cmd >nul 2>nul
if errorlevel 1 goto :missing_corepack

if not exist "node_modules" (
  echo [Excalidraw] First run detected. Preparing Yarn and installing dependencies...
  call corepack.cmd prepare yarn@1.22.22 --activate
  if errorlevel 1 goto :startup_failed

  call corepack.cmd yarn install
  if errorlevel 1 goto :startup_failed
)

echo [Excalidraw] Starting dev server...
echo [Excalidraw] Browser should open automatically at http://localhost:3001/
call corepack.cmd yarn start
if errorlevel 1 goto :startup_failed
goto :eof

:missing_corepack
echo [Excalidraw] corepack.cmd was not found.
echo [Excalidraw] Please install Node.js 18+ first, then run this file again.
pause
exit /b 1

:startup_failed
echo.
echo [Excalidraw] Startup failed. Check the messages above for details.
pause
exit /b 1
