@echo off
title Alatas Electron (Dev)
cd /d "%~dp0"

echo.
echo  Starting Alatas Desktop (Electron)...
echo  Frontend Vite + Electron window
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not in PATH.
  pause
  exit /b 1
)

if not exist "node_modules\electron" (
  echo Installing root / Electron tools...
  call npm install
)

if not exist "frontend\node_modules" (
  echo Installing frontend dependencies...
  call npm install --prefix frontend
)

if not exist "backend\node_modules" (
  echo Installing backend dependencies...
  call npm install --prefix backend
)

call npm run electron:dev
