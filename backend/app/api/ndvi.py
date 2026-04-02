import asyncio

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import (
    ComparePointResponse,
    CompareStatsRequest,
    CompareStatsResponse,
    LossAlert,
    LossAlertsResponse,
    PointResponse,
    PointSeriesItem,
    PointSeriesResponse,
    PolygonStatsRequest,
    PolygonStatsResponse,
)
from app.services.ndvi_service import sample_ndvi_at_point, sample_ndvi_series, describe_vegetation_change
from app.utils.sampling import sample_points_in_polygon

router = APIRouter(prefix="/ndvi", tags=["ndvi"])


@router.get("/point", response_model=PointResponse)
async def get_ndvi_point(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    date: str = Query(pattern=r"^\d{4}-\d{2}-\d{2}$"),
    layer: str = Query(min_length=1),
):
    (
        vegetation_class,
        confidence_note,
        confidence_percent,
        ndvi,
        raw_pixel,
        notes,
        effective_date,
    ) = await sample_ndvi_at_point(lat, lon, date, layer)
    return PointResponse(
        lat=lat,
        lon=lon,
        date=effective_date,
        layer=layer,
        ndvi=ndvi,
        raw_pixel=raw_pixel,
        notes=notes,
        vegetation_class=vegetation_class,
        confidence_note=confidence_note,
        confidence_percent=confidence_percent,
    )


@router.get("/point/series", response_model=PointSeriesResponse)
async def get_ndvi_point_series(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    layer: str = Query(min_length=1),
    count: int = Query(default=8, ge=2, le=16),
):
    items = await sample_ndvi_series(lat, lon, layer, count=count)
    return PointSeriesResponse(series=[PointSeriesItem(date=x["date"], ndvi=x["ndvi"]) for x in items])


@router.post("/stats", response_model=PolygonStatsResponse)
async def get_ndvi_stats(req: PolygonStatsRequest):
    geom_type = req.polygon.get("type", "")
    if geom_type not in ("Polygon", "MultiPolygon"):
        raise HTTPException(status_code=422, detail="polygon must be a GeoJSON Polygon or MultiPolygon geometry")

    points = sample_points_in_polygon(req.polygon, req.sample_count)

    if not points:
        return PolygonStatsResponse(
            mean=None, min=None, max=None,
            sample_count=req.sample_count, valid_samples=0,
            notes="Could not generate sample points inside polygon",
        )

    values: list[float] = []
    errors: list[str] = []

    for lat, lon in points:
        _, _, _, ndvi, _, note, _ = await sample_ndvi_at_point(lat, lon, req.date, req.layer)
        if ndvi is not None:
            values.append(ndvi)
        else:
            errors.append(note)

    if not values:
        return PolygonStatsResponse(
            mean=None, min=None, max=None,
            sample_count=len(points), valid_samples=0,
            notes=f"No valid NDVI samples. Errors: {'; '.join(set(errors[:3]))}",
        )

    return PolygonStatsResponse(
        mean=round(sum(values) / len(values), 4),
        min=round(min(values), 4),
        max=round(max(values), 4),
        sample_count=len(points),
        valid_samples=len(values),
        notes=f"Sampled {len(values)} valid points of {len(points)} total",
    )


_describe_change = describe_vegetation_change


@router.get("/compare", response_model=ComparePointResponse)
async def compare_point(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    layer: str = Query(min_length=1),
    before: str = Query(pattern=r"^\d{4}-\d{2}-\d{2}$"),
    after: str = Query(pattern=r"^\d{4}-\d{2}-\d{2}$"),
):
    (b_class, _, b_conf, _, _, _, b_eff) = await sample_ndvi_at_point(lat, lon, before, layer)
    (a_class, _, a_conf, _, _, _, a_eff) = await sample_ndvi_at_point(lat, lon, after, layer)

    change = _describe_change(b_class, a_class)
    conf_vals = [c for c in (b_conf, a_conf) if c is not None]
    avg_conf = round(sum(conf_vals) / len(conf_vals), 1) if conf_vals else None

    return ComparePointResponse(
        lat=lat,
        lon=lon,
        layer=layer,
        before_date=b_eff,
        after_date=a_eff,
        before_class=b_class,
        after_class=a_class,
        before_confidence=b_conf,
        after_confidence=a_conf,
        change=change,
        confidence=avg_conf,
        notes="Qualitative comparison from visualization layer; not calibrated NDVI.",
    )


def _mean_class(values: list[float]) -> str | None:
    if not values:
        return None
    avg = sum(values) / len(values)
    if avg < 0.2:
        return "Low vegetation"
    if avg < 0.5:
        return "Moderate vegetation"
    return "High vegetation"


@router.post("/compare/stats", response_model=CompareStatsResponse)
async def compare_stats(req: CompareStatsRequest):
    geom_type = req.polygon.get("type", "")
    if geom_type not in ("Polygon", "MultiPolygon"):
        raise HTTPException(status_code=422, detail="polygon must be a GeoJSON Polygon or MultiPolygon geometry")

    points = sample_points_in_polygon(req.polygon, req.sample_count)
    if not points:
        return CompareStatsResponse(
            before_date=req.before_date, after_date=req.after_date,
            before_class=None, after_class=None, change="Insufficient data",
            before_valid=0, after_valid=0, sample_count=0,
            notes="Could not generate sample points inside polygon",
        )

    before_vals: list[float] = []
    after_vals: list[float] = []
    for lat, lon in points:
        _, _, _, bv, _, _, _ = await sample_ndvi_at_point(lat, lon, req.before_date, req.layer)
        _, _, _, av, _, _, _ = await sample_ndvi_at_point(lat, lon, req.after_date, req.layer)
        if bv is not None:
            before_vals.append(bv)
        if av is not None:
            after_vals.append(av)

    b_class = _mean_class(before_vals)
    a_class = _mean_class(after_vals)
    change = _describe_change(b_class, a_class)

    return CompareStatsResponse(
        before_date=req.before_date,
        after_date=req.after_date,
        before_class=b_class,
        after_class=a_class,
        change=change,
        before_valid=len(before_vals),
        after_valid=len(after_vals),
        sample_count=len(points),
        notes="Qualitative area comparison from visualization layer.",
    )


def _severity(change: str, confidence: float | None) -> str | None:
    """Map a vegetation change label to an alert severity, or None if not a decline."""
    lower = change.lower()
    if "decline" not in lower:
        return None
    if "significant" in lower:
        return "moderate" if confidence is not None and confidence < 60 else "severe"
    if "moderate" in lower:
        return "mild" if confidence is not None and confidence < 60 else "moderate"
    return "mild"


def _generate_grid(
    west: float, south: float, east: float, north: float, grid_size: int,
) -> list[tuple[float, float]]:
    """Return evenly spaced (lat, lon) points over a bbox."""
    pts: list[tuple[float, float]] = []
    lat_step = (north - south) / max(1, grid_size - 1) if grid_size > 1 else 0
    lon_step = (east - west) / max(1, grid_size - 1) if grid_size > 1 else 0
    for r in range(grid_size):
        lat = south + r * lat_step
        for c in range(grid_size):
            lon = west + c * lon_step
            pts.append((round(lat, 5), round(lon, 5)))
    return pts


_LOSS_SEMAPHORE = asyncio.Semaphore(12)


async def _compare_one(
    lat: float, lon: float, before: str, after: str, layer: str,
) -> LossAlert | None:
    async with _LOSS_SEMAPHORE:
        (b_class, _, b_conf, _, _, _, _) = await sample_ndvi_at_point(lat, lon, before, layer)
        (a_class, _, a_conf, _, _, _, _) = await sample_ndvi_at_point(lat, lon, after, layer)

    change = _describe_change(b_class, a_class)
    conf_vals = [c for c in (b_conf, a_conf) if c is not None]
    avg_conf = round(sum(conf_vals) / len(conf_vals), 1) if conf_vals else None
    sev = _severity(change, avg_conf)
    if sev is None:
        return None
    return LossAlert(
        lat=lat, lon=lon, severity=sev,
        before_class=b_class, after_class=a_class,
        change=change, confidence=avg_conf,
    )


@router.get("/loss-alerts", response_model=LossAlertsResponse)
async def get_loss_alerts(
    bbox: str = Query(description="west,south,east,north"),
    before: str = Query(pattern=r"^\d{4}-\d{2}-\d{2}$"),
    after: str = Query(pattern=r"^\d{4}-\d{2}-\d{2}$"),
    layer: str = Query(min_length=1),
    grid_size: int = Query(default=12, ge=3, le=30),
):
    parts = [p.strip() for p in bbox.split(",")]
    if len(parts) != 4:
        raise HTTPException(status_code=422, detail="bbox must be west,south,east,north")
    try:
        west, south, east, north = (float(p) for p in parts)
    except ValueError:
        raise HTTPException(status_code=422, detail="bbox values must be numeric")

    if south >= north or west >= east:
        raise HTTPException(status_code=422, detail="invalid bbox bounds")

    grid = _generate_grid(west, south, east, north, grid_size)
    results = await asyncio.gather(*[
        _compare_one(lat, lon, before, after, layer) for lat, lon in grid
    ])

    alerts = [a for a in results if a is not None]
    alerts.sort(key=lambda a: {"severe": 0, "moderate": 1, "mild": 2}.get(a.severity, 3))

    return LossAlertsResponse(
        before_date=before,
        after_date=after,
        alerts=alerts,
        grid_size=grid_size,
        sampled=len(grid),
        notes="Viewport-based vegetation loss scan; qualitative only.",
    )
