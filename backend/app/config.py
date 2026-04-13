from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
    )
    gibs_capabilities_cache_ttl: int = 21600  # 6 hours
    gibs_wmts_base: str = "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best"
    gibs_wmts_base_3857: str = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best"
    firms_map_key: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
