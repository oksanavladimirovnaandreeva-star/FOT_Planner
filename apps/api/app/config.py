from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./fot_planner.db"
    secret_key: str = "dev-change-in-production"
    cors_origins: str = "http://localhost:5180,http://127.0.0.1:5180"

    class Config:
        env_file = ".env"


settings = Settings()
