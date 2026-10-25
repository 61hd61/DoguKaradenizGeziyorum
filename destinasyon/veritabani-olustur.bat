@echo off
chcp 65001 >nul
cd /d "%~dp0.."
set TURIZM_DB_PASSWORD=1234
echo veritabani klasorune paket yaziliyor...
python -c "import sys; sys.path.insert(0, r'%~dp0'); from app.config import ConfigManager; from app.paths import AppPaths; from app.database import DatabaseManager; from app.services.paket_service import PaketService, PaketSecenekleri; p=AppPaths(); c=ConfigManager(p).load(); db=DatabaseManager(c.database); db.connect(); s=PaketService(p, db); r=s.export_paket(p.root.parent / 'veritabani', PaketSecenekleri()); print('OK', r.destinasyon_sayisi, 'destinasyon', r.resim_sayisi, 'resim'); db.close()"
pause
