@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Install Node.js first: https://nodejs.org & pause & exit /b)
if not exist node_modules (echo Installing for the first time... & call npm install)
if not exist .env.local copy .env.example .env.local >nul
if not exist .next\BUILD_ID (echo Building... & call npm run build)
start "" http://localhost:3000
call npm run start
