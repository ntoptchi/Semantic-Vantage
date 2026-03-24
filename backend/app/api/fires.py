from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Query

from app.models.fire import FiresResponse, FireImpactResponse
from app.services.fire_service import get_recent_fires
from app.services.ndvi_service import sample_ndvi_at_point, describe_vegetation_change

router = APIRouter(prefix="/fires", tags=["fires"])


@router.get("/recent", response_model=FiresResponse)
async def get_fires_recent(
    bbox: str | None = Query(default=None, description="west,south,east,north"),
    source: str = Query(default="all", pattern=r"^(viirs|modis|all)$"),
    days: int = Query(default=3, ge=1, le=14),
    limit: int = Query(default=200, ge=1, le=1000),
):
    if bbox is not None:
        parts = bbox.split(",")
        if len(parts) != 4:
            raise HTTPException(status_code=422, detail="bbox must be 'west,south,east,north'")
        try:
            vals = [float(p) for p in parts]
        except ValueError:
            raise HTTPException(status_code=422, detail="bbox values must be numeric")
        west, south, east, north = vals
        if not (-180 <= west <= 180 and -180 <= east <= 180):
            raise HTTPException(status_code=422, detail="bbox longitude out of range")
        if not (-90 <= south <= 90 and -90 <= north <= 90):
            raise HTTPException(status_code=422, detail="bbox latitude out of range")

    fires, source_label = await get_recent_fires(bbox=bbox, source=source, days=days, limit=limit)

    notes = f"{len(fires)} detections from {source_label}"
    if source_label == "mock":
        notes += " (sample data – set FIRMS_MAP_KEY for live detections)"

    return FiresResponse(
        fires=fires,
        count=len(fires),
        source=source_label,
        notes=notes,
    )


IMPACT_DEFAULT_LAYER = "MODIS_Terra_NDVI_8Day"


@router.get("/impact", response_model=FireImpactResponse)
async def get_fire_impact(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    fire_date: str = Query(pattern=r"^\d{4}-\d{2}-\d{2}$"),
    layer: str = Query(default=IMPACT_DEFAULT_LAYER, min_length=1),
):
    try:
        fire_dt = datetime.strptime(fire_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=422, detail="fire_date must be YYYY-MM-DD")

    before_dt = fire_dt - timedelta(days=16)
    after_dt = fire_dt + timedelta(days=16)

    (b_class, _, b_conf, _, _, _, b_eff) = await sample_ndvi_at_point(
        lat, lon, before_dt.strftime("%Y-%m-%d"), layer
    )
    (a_class, _, a_conf, _, _, _, a_eff) = await sample_ndvi_at_point(
        lat, lon, after_dt.strftime("%Y-%m-%d"), layer
    )

    change = describe_vegetation_change(b_class, a_class)
    conf_vals = [c for c in (b_conf, a_conf) if c is not None]
    avg_conf = round(sum(conf_vals) / len(conf_vals), 1) if conf_vals else None

    return FireImpactResponse(
        lat=lat,
        lon=lon,
        fire_date=fire_date,
        before_date=b_eff,
        after_date=a_eff,
        before_class=b_class,
        after_class=a_class,
        change=change,
        confidence=avg_conf,
    )
