@echo off
chcp 65001 >nul
title Dugu Karadeniz Geziyorum — Kurulum
cd /d "%~dp0"

echo [1/4] npm bagimliliklari (turizm-platformu)...
cd turizm-platformu
if not exist node_modules call npm install
if errorlevel 1 goto hata

echo [2/4] .env dosyalari...
cd ..
if not exist "turizm-platformu\.env" copy /Y "turizm-platformu\.env.example" "turizm-platformu\.env"
if not exist "turizm-platformu\apps\api\.env" copy /Y "turizm-platformu\apps\api\.env.example" "turizm-platformu\apps\api\.env"

echo [3/4] PostgreSQL semasi...
cd turizm-platformu\packages\database
call npx prisma db push
if errorlevel 1 (
  echo UYARI: prisma basarisiz — PostgreSQL calisiyor mu? KULLANICI-VERITABANI-OLUSTUR.bat
)

echo [4/4] Veri paketi (veritabani/)...
cd /d "%~dp0destinasyon"
python tools\import_veritabani_paket.py

echo.
echo Kurulum bitti. Calistirmak icin: TUMUNU-BASLAT.bat
echo Site: http://localhost:5173  API saglik: http://localhost:3000/health
pause
exit /b 0

:hata
echo Kurulum hatasi.
pause
exit /b 1
