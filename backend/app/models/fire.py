from pydantic import BaseModel, Field


class FireDetection(BaseModel):
    id: str
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    confidence: str | None = None
    brightness: float | None = None
    satellite: str | None = None
    instrument: str | None = None
    acq_date: str | None = None
    acq_time: str | None = None
    frp: float | None = None
    daynight: str | None = None
    source: str | None = None


class FiresResponse(BaseModel):
    fires: list[FireDetection]
    count: int
    source: str
    notes: str


class FireImpactResponse(BaseModel):
    lat: float
    lon: float
    fire_date: str
    before_date: str
    after_date: str
    before_class: str | None
    after_class: str | None
    change: str
    confidence: float | None
