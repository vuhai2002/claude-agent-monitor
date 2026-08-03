@echo off
REM ASCII only on purpose. cmd.exe tracks its position in a .bat file by byte
REM offset, so multi-byte UTF-8 characters here corrupt every following line -
REM including the "node server.js" call. All Vietnamese text the user reads is
REM printed by server.js instead, where UTF-8 output works correctly.
chcp 65001 >nul
title Claude Subagent Monitor
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [X] Node.js not found / Khong tim thay Node.js
  echo.
  echo   Install it from https://nodejs.org then run this file again.
  echo.
  pause
  exit /b 1
)

set AGENT_MONITOR_OPEN=1
node server.js

echo.
pause
