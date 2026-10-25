@echo off
chcp 65001 >nul
title Veri Yonetim Paneli Baslat
cd /d "%~dp0destinasyon"
call baslat-panel.bat
