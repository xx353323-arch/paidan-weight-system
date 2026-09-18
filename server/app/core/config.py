from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="PAIDAN_", extra="ignore")

    app_name: str = "派单权重综合评价系统"
    db_path: str = str(BASE_DIR / "data" / "paidan.db")
    jwt_secret: str = "change-this-secret-in-production"
    jwt_algorithm: str = "HS256"
    access_token_hours: int = 12
    refresh_token_days: int = 30
    cors_origins: str = "http://localhost:8001,http://127.0.0.1:8001"
    default_password: str = "123456"

    max_failed_attempts: int = 5
    lock_minutes: int = 15
    password_min_length: int = 8
    require_strong_password: bool = True
    public_facing: bool = False

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.db_path}"

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


settings = Settings()
