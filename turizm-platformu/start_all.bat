@echo off
title Turizm Platformu
echo.
echo Backend ve frontend ayri pencerelerde baslatiliyor...
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:5173  (HARITA)
echo.
start "Turizm Backend" "%~dp0start_backend.bat"
timeout /t 3 /nobreak >nul
start "Turizm Frontend" "%~dp0start_frontend.bat"
timeout /t 4 /nobreak >nul
start "" "http://localhost:5173/"
echo Sunucular acildi. Harita icin tarayici acildi.
echo API penceresi kapaliysa harita bos kalir — start_backend.bat calissin.
pause
