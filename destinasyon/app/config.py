"""config.ini okuma/yazma ve yapilandirma modelleri."""

from __future__ import annotations

import configparser
import os
from dataclasses import dataclass, asdict, field, replace
from pathlib import Path
from typing import Any, Dict

from app.paths import AppPaths


class ConfigError(Exception):
    """Yapilandirma dosyasi okunamadiginda / gecersiz oldugunda firlatilir."""


@dataclass(frozen=True)
class DatabaseConfig:
    """psycopg2.connect(**kwargs) ile dogrudan kullanilabilen ayarlar."""

    host: str = "localhost"
    port: int = 5432
    dbname: str = "trabzon_turizm"
    user: str = "postgres"
    password: str = ""
    sslmode: str = "prefer"
    connect_timeout: int = 5

    def to_dsn_kwargs(self) -> Dict[str, Any]:
        kwargs = asdict(self)
        kwargs["application_name"] = "TurizmVeriPaneli"
        return kwargs

    def safe_summary(self) -> str:
        """Sifre icermeyen, arayuzde gosterilebilir ozet."""
        return f"{self.user}@{self.host}:{self.port}/{self.dbname}"


@dataclass(frozen=True)
class ApplicationConfig:
    images_dir: str = "images"
    theme: str = "dark"
    max_rows: int = 0


@dataclass(frozen=True)
class AppConfig:
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    application: ApplicationConfig = field(default_factory=ApplicationConfig)


class ConfigManager:
    """config.ini dosyasini okur, yoksa varsayilanlarla olusturur.

    Ayarlar ortam degiskenleriyle ezilebilir (gelistirme/test ortamlari
    icin): TURIZM_DB_HOST, TURIZM_DB_PORT, TURIZM_DB_NAME, TURIZM_DB_USER,
    TURIZM_DB_PASSWORD, TURIZM_DB_SSLMODE. Ortam degiskeni config.ini'den
    onceliklidir ve dosyaya yazilmaz.
    """

    ENV_PREFIX = "TURIZM_DB_"
    ENV_MAP = {
        "host": "HOST",
        "port": "PORT",
        "dbname": "NAME",
        "user": "USER",
        "password": "PASSWORD",
        "sslmode": "SSLMODE",
    }

    def __init__(self, paths: AppPaths) -> None:
        self._paths = paths
        self._parser = configparser.ConfigParser()

    @property
    def config_path(self) -> Path:
        return self._paths.config_file

    def load(self) -> AppConfig:
        if not self.config_path.exists():
            self._write_default()

        try:
            read_ok = self._parser.read(self.config_path, encoding="utf-8")
        except (configparser.Error, OSError) as exc:
            raise ConfigError(f"config.ini okunamadi: {exc}") from exc

        if not read_ok:
            raise ConfigError(f"config.ini bulunamadi: {self.config_path}")

        db_section = self._parser["database"] if self._parser.has_section("database") else {}
        app_section = self._parser["application"] if self._parser.has_section("application") else {}

        database = DatabaseConfig(
            host=self._as_str(db_section, "host", "localhost"),
            port=self._as_int(db_section, "port", 5432),
            dbname=self._as_str(db_section, "dbname", "trabzon_turizm"),
            user=self._as_str(db_section, "user", "postgres"),
            password=self._as_str(db_section, "password", ""),
            sslmode=self._as_str(db_section, "sslmode", "prefer"),
            connect_timeout=self._as_int(db_section, "connect_timeout", 5),
        )
        application = ApplicationConfig(
            images_dir=self._as_str(app_section, "images_dir", "images"),
            theme=self._as_str(app_section, "theme", "dark").lower(),
            max_rows=self._as_int(app_section, "max_rows", 0),
        )

        database = self._apply_env_overrides(database)

        # images klasor adi config'ten geldigi icin yol yoneticisini guncelle
        self._paths.set_images_dirname(application.images_dir)
        return AppConfig(database=database, application=application)

    # ------------------------------------------------------------------
    def _apply_env_overrides(self, database: DatabaseConfig) -> DatabaseConfig:
        overrides: Dict[str, Any] = {}
        for field_name, env_suffix in self.ENV_MAP.items():
            raw = os.environ.get(f"{self.ENV_PREFIX}{env_suffix}")
            if not raw:
                continue
            if field_name == "port":
                try:
                    overrides[field_name] = int(raw)
                except ValueError:
                    continue
            else:
                overrides[field_name] = raw
        if not overrides:
            return database
        return replace(database, **overrides)

    # ------------------------------------------------------------------
    def save_database(self, database: DatabaseConfig) -> None:
        """Arayuzdeki baglanti ayarlari ekranindan geri yazma icin."""
        if not self._parser.has_section("database"):
            self._parser.add_section("database")
        for key, value in asdict(database).items():
            self._parser.set("database", key, str(value))
        self._flush()

    # ------------------------------------------------------------------
    def _write_default(self) -> None:
        default = AppConfig()
        parser = configparser.ConfigParser()
        parser["database"] = {k: str(v) for k, v in asdict(default.database).items()}
        parser["application"] = {k: str(v) for k, v in asdict(default.application).items()}
        self._parser = parser
        self._flush()

    def _flush(self) -> None:
        try:
            with self.config_path.open("w", encoding="utf-8") as handle:
                self._parser.write(handle)
        except OSError as exc:
            raise ConfigError(f"config.ini yazilamadi: {exc}") from exc

    @staticmethod
    def _as_str(section, key: str, default: str) -> str:
        try:
            value = section.get(key, default)
        except AttributeError:  # bos dict
            value = default
        return (value if value is not None else default).strip()

    @staticmethod
    def _as_int(section, key: str, default: int) -> int:
        raw = ConfigManager._as_str(section, key, str(default))
        try:
            return int(raw)
        except (TypeError, ValueError):
            return default
