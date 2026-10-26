@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo PostgreSQL semasi (prisma db push)...
cd turizm-platformu\packages\database
call npx prisma db push
if errorlevel 1 (
  echo [HATA] prisma db push basarisiz. PostgreSQL ve DATABASE_URL kontrol edin.
  pause
  exit /b 1
)
cd /d "%~dp0..\destinasyon"
echo veritabani paketi yukleniyor...
python tools\import_veritabani_paket.py
pause
