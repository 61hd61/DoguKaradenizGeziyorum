@echo off
chcp 65001 >nul
echo PostgreSQL: trabzon_turizm_users olusturuluyor...
psql -U postgres -c "SELECT 1 FROM pg_database WHERE datname = 'trabzon_turizm_users'" | findstr /C:"1 row" >nul
if errorlevel 1 (
  psql -U postgres -c "CREATE DATABASE trabzon_turizm_users;"
)
echo Tamam. API acildiginda tablolar otomatik olusur.
pause
