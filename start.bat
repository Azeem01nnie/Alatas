@echo off
title Alatas Car Rental Services
cd /d "%~dp0"

echo.
echo  Starting Alatas...
echo  Frontend + Backend will launch together.
echo  Browser opens at http://localhost:5173
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not in PATH.
  pause
  exit /b 1
)

if not exist "node_modules\concurrently" (
  echo First run: installing root tools...
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

start "" "http://localhost:5173"
call npm start
