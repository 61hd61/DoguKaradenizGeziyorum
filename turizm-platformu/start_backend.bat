@echo off
title Turizm Backend Server
echo Fastify API sunucusu baslatiliyor...
cd /d "%~dp0apps\api"
echo Calisma dizini: %cd%
echo.
echo npm run dev baslatiliyor... Lutfen bekleyin.
call npm run dev
echo.
echo Sunucuyu durdurmak icin Ctrl+C, sonra bir tusa basin.
pause
