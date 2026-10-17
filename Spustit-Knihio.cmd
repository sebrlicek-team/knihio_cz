@echo off
cd /d "%~dp0"
echo Knihio - osobni knihovna
echo Po spusteni otevrete http://127.0.0.1:4173
echo Zavrenim tohoto okna aplikaci zastavite.
where node >nul 2>nul
if errorlevel 1 (
  echo Pro spusteni je potreba Node.js 22 nebo novejsi z https://nodejs.org/
  pause
  exit /b 1
)
node server.cjs
pause
