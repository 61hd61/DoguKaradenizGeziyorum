@echo off
chcp 65001 >nul
title Karadeniz Turizm Platformu
cd /d "%~dp0"

set "ODEV_ROOT=%~dp0.."
set "TURIZM_ROOT=%ODEV_ROOT%\turizm-platformu"
set TURIZM_DB_PASSWORD=1234

echo ============================================================
echo  1) Yonetim paneli  -> baslat-panel.bat  (ONCE BUNU DENEYIN)
echo  2) Bu dosya        -> web + istege bagli veri aktarimi
echo ============================================================
echo.

if /I "%~1"=="--import" (
  echo [Veri] 6 il + resimler PostgreSQL'e aktariliyor...
  python tools\import_from_odev.py
  echo.
)

echo [Web] API http://localhost:3000
start "Turizm API" cmd /k "cd /d "%TURIZM_ROOT%\apps\api" && npm run dev"
timeout /t 2 /nobreak >nul

echo [Web] Kullanici arayuzu http://localhost:5173
start "Turizm Web" cmd /k "cd /d "%TURIZM_ROOT%\apps\web" && npm run dev"
timeout /t 2 /nobreak >nul

echo [Panel] Masaustu yonetim paneli aciliyor...
start "Yonetim Paneli" cmd /k "cd /d "%~dp0" && baslat-panel.bat"

echo.
echo Tarayici: http://localhost:5173
echo Yonetim (web): http://localhost:5173/yonetim  -> admin@turizm.local / admin123
echo Masaustu panel: bu pencerede "Yonetim Paneli" acilir
echo Profil: http://localhost:5173/profil  (once /giris ile kayit olun)
echo.
echo Veri aktarmak icin: baslat.bat --import
start "" "http://localhost:5173/"
start "" "http://localhost:5173/yonetim"
pause
