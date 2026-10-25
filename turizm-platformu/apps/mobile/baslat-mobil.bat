@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo npm install calistiriliyor...
  call npm install
)
echo Expo baslatiliyor — telefon/emulator icin QR kodu kullanin.
call npx expo start
