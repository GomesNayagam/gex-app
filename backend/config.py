from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    gex_adapter: str = "seed"  # "seed" | "flash_alpha"
    flash_alpha_base_url: str = "https://lab.flashalpha.com/v1"
    flash_alpha_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "deepseek/deepseek-v4-flash"
    logfire_token: Optional[str] = None
    logfire_service_name: str = "gex-app"
    chat_max_messages_per_session: int = 30
    chat_max_tokens: int = 2048
    chat_max_tool_iterations: int = 6
    cache_ttl_seconds: int = 300
    snapshot_interval_seconds: int = 60
    snapshot_max_per_symbol: int = 390  # full trading day at 1-min intervals
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]


    model_config = {
        "env_file": ["backend/.env", ".env"],
        "env_file_encoding": "utf-8",
    }


settings = Settings()
