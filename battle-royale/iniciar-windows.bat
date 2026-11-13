@echo off
title ILHA ZERO - servidor
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale em https://nodejs.org ^(versao LTS^) e rode este arquivo de novo.
  pause
  exit /b
)
if not exist node_modules\ws call npm install
start "" http://localhost:8080
node server.js
pause
