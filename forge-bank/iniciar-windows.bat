@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Instale o Node.js em https://nodejs.org ^(versao LTS^) & pause & exit /b 1)
start "" http://localhost:8090
node server.js
pause
