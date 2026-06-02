from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    gex_adapter: str = "seed"  # "seed" | "flash_alpha"
    flash_alpha_base_url: str = "https://lab.flashalpha.com/v1"
    flash_alpha_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    cache_ttl_seconds: int = 300
    snapshot_interval_seconds: int = 60
    snapshot_max_per_symbol: int = 390  # full trading day at 1-min intervals
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]


    model_config = {
        "env_file": ["backend/.env", ".env"],
        "env_file_encoding": "utf-8",
    }


settings = Settings()
