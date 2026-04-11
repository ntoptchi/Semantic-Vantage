from pydantic import BaseModel, Field


class FloodLayer(BaseModel):
    identifier: str
    title: str
    format: str
    style: str
    tile_matrix_set_id: str
    time_start: str | None = None
    time_end: str | None = None
    time_default: str | None = None


class FloodLayersResponse(BaseModel):
    layers: list[FloodLayer]


class FloodPointResponse(BaseModel):
    lat: float
    lon: float
    layer: str
    imagery_date: str | None
    water_class: str
    confidence: float | None
    note: str | None
    debug: dict | None = None


class FloodStatsRequest(BaseModel):
    polygon: dict
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    layer: str
    sample_count: int = Field(default=50, ge=5, le=500)


class FloodStatsResponse(BaseModel):
    layer: str
    imagery_date: str | None
    water_class: str
    coverage_percent: float | None
    sample_count: int
    valid_samples: int
    note: str | None
