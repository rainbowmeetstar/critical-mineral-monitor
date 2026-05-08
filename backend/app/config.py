from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./minerals.db"
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    news_refresh_minutes: int = 30
    price_refresh_minutes: int = 60
    usgs_refresh_hours: int = 24

    class Config:
        env_file = ".env"


settings = Settings()
