@echo off
title Turizm Frontend Server
echo React development server baslatiliyor...
cd /d "%~dp0apps\web"
echo Calisma dizini: %cd%
echo.
echo npm run dev baslatiliyor... Lutfen bekleyin.
call npm run dev
echo.
echo Sunucuyu durdurmak icin Ctrl+C, sonra bir tusa basin.
pause
