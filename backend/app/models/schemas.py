from pydantic import BaseModel, Field


class NDVILayer(BaseModel):
    identifier: str
    title: str
    format: str
    style: str
    tile_matrix_set_id: str
    time_start: str | None = None
    time_end: str | None = None
    time_default: str | None = None


class CapabilitiesResponse(BaseModel):
    layers: list[NDVILayer]
    fetched_at: str


class PointQuery(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    layer: str


class PointResponse(BaseModel):
    lat: float
    lon: float
    date: str
    layer: str
    ndvi: float | None
    raw_pixel: list[int] | None = None
    notes: str
    vegetation_class: str | None = None
    confidence_note: str | None = None
    confidence_percent: float | None = None


class PointSeriesItem(BaseModel):
    date: str
    ndvi: float | None


class PointSeriesResponse(BaseModel):
    series: list[PointSeriesItem]


class PolygonStatsRequest(BaseModel):
    polygon: dict  # GeoJSON geometry
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    layer: str
    sample_count: int = Field(default=50, ge=5, le=500)


class PolygonStatsResponse(BaseModel):
    mean: float | None
    min: float | None
    max: float | None
    sample_count: int
    valid_samples: int
    notes: str


class ComparePointResponse(BaseModel):
    lat: float
    lon: float
    layer: str
    before_date: str
    after_date: str
    before_class: str | None
    after_class: str | None
    before_confidence: float | None
    after_confidence: float | None
    change: str
    confidence: float | None
    notes: str


class CompareStatsRequest(BaseModel):
    polygon: dict
    layer: str
    before_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    after_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    sample_count: int = Field(default=50, ge=5, le=500)


class CompareStatsResponse(BaseModel):
    before_date: str
    after_date: str
    before_class: str | None
    after_class: str | None
    change: str
    before_valid: int
    after_valid: int
    sample_count: int
    notes: str


class LossAlert(BaseModel):
    lat: float
    lon: float
    severity: str
    before_class: str | None
    after_class: str | None
    change: str
    confidence: float | None


class LossAlertsResponse(BaseModel):
    before_date: str
    after_date: str
    alerts: list[LossAlert]
    grid_size: int
    sampled: int
    notes: str
