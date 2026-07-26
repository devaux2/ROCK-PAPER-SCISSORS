@echo off
title RPS
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed yet - it's the engine that runs the game.
  echo   Opening the download page now: click the big green "LTS" button,
  echo   run the installer with default options, then double-click this
  echo   file again.
  echo.
  start https://nodejs.org
  pause
  exit /b 1
)
node scripts\play.mjs
echo.
pause
