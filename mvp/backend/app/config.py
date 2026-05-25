import os


class Settings:
  app_name: str = "fot-planner-mvp"
  database_url: str = os.getenv("DATABASE_URL", "sqlite:///./fot_planner_dev.db")


settings = Settings()

