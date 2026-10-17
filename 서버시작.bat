@echo off
chcp 65001 >nul
title Idle Game Server
cd /d "%~dp0server"
if not exist node_modules (
  echo Installing required files for the first run. Please wait...
  call npm install
)
call npm run sync
call npm run db:init >nul
echo.
echo ================================================
echo  Starting the server. Your browser will open shortly.
echo  Address: http://127.0.0.1:8787
echo  Close this window to stop the server.
echo ================================================
start "" cmd /c "timeout /t 10 >nul & start http://127.0.0.1:8787"
call npm run dev