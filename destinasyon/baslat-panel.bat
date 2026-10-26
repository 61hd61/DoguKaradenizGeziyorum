@echo off
chcp 65001 >nul
title Karadeniz Veri Yonetim Paneli
cd /d "%~dp0"

echo ============================================================
echo  Veri Yonetim Paneli (Destinasyon / Otel / Tur Firmasi)
echo ============================================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
  echo [HATA] Python bulunamadi. Python 3.10+ yukleyin.
  pause
  exit /b 1
)

if not exist "requirements.txt" (
  echo [HATA] requirements.txt bulunamadi.
  pause
  exit /b 1
)

pip show customtkinter >nul 2>&1
if errorlevel 1 (
  echo Bagimliliklar kuruluyor...
  pip install -r requirements.txt
)

echo Panel aciliyor...
python main.py
if errorlevel 1 (
  echo.
  echo [HATA] Panel kapanirken hata olustu. app.log dosyasina bakin.
)
pause
