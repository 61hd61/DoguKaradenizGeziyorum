@echo off
chcp 65001 >nul
title Karadeniz Turizm — Hepsi bir arada
cd /d "%~dp0destinasyon"
call baslat.bat
start "" "http://localhost:5173"
start "" "http://localhost:5173/admin"
start "" "http://localhost:5173/profil"
