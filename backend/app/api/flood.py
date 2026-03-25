from fastapi import APIRouter, HTTPException, Query

from app.models.flood import (
    FloodLayersResponse,
    FloodPointResponse,
    FloodStatsRequest,
    FloodStatsResponse,
)
from app.services.flood_service import (
    get_flood_layers,
    get_flood_layer_by_id,
    sample_flood_at_point,
    WATER_NONE,
    WATER_POSSIBLE,
    WATER_HIGH,
)
from app.utils.sampling import sample_points_in_polygon

router = APIRouter(prefix="/flood", tags=["flood"])


@router.get("/layers", response_model=FloodLayersResponse)
async def list_flood_layers():
    return FloodLayersResponse(layers=get_flood_layers())


@router.get("/point", response_model=FloodPointResponse)
async def get_flood_point(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    date: str = Query(pattern=r"^\d{4}-\d{2}-\d{2}$"),
    layer: str = Query(min_length=1),
):
    if get_flood_layer_by_id(layer) is None:
        raise HTTPException(status_code=422, detail=f"Unknown flood layer: {layer}")

    water_class, confidence, note, effective_date, debug = await sample_flood_at_point(
        lat, lon, date, layer
    )
    return FloodPointResponse(
        lat=lat,
        lon=lon,
        layer=layer,
        imagery_date=effective_date,
        water_class=water_class,
        confidence=confidence,
        note=note,
        debug=debug,
    )


@router.post("/stats", response_model=FloodStatsResponse)
async def get_flood_stats(req: FloodStatsRequest):
    geom_type = req.polygon.get("type", "")
    if geom_type not in ("Polygon", "MultiPolygon"):
        raise HTTPException(
            status_code=422,
            detail="polygon must be a GeoJSON Polygon or MultiPolygon geometry",
        )

    if get_flood_layer_by_id(req.layer) is None:
        raise HTTPException(status_code=422, detail=f"Unknown flood layer: {req.layer}")

    points = sample_points_in_polygon(req.polygon, req.sample_count)
    if not points:
        return FloodStatsResponse(
            layer=req.layer,
            imagery_date=None,
            water_class=WATER_NONE,
            coverage_percent=None,
            sample_count=req.sample_count,
            valid_samples=0,
            note="Could not generate sample points inside polygon",
        )

    classes: list[str] = []
    effective_date: str | None = None

    for lat, lon in points:
        cls, _, _, eff, _ = await sample_flood_at_point(lat, lon, req.date, req.layer)
        classes.append(cls)
        if effective_date is None:
            effective_date = eff

    valid = [c for c in classes if c != WATER_NONE or True]
    water_count = sum(1 for c in classes if c in (WATER_POSSIBLE, WATER_HIGH))
    high_count = sum(1 for c in classes if c == WATER_HIGH)
    total = len(classes)

    coverage = round((water_count / total) * 100, 1) if total > 0 else None

    if high_count > total * 0.5:
        summary_class = WATER_HIGH
    elif water_count > total * 0.2:
        summary_class = WATER_POSSIBLE
    else:
        summary_class = WATER_NONE

    return FloodStatsResponse(
        layer=req.layer,
        imagery_date=effective_date,
        water_class=summary_class,
        coverage_percent=coverage,
        sample_count=total,
        valid_samples=len(valid),
        note="Qualitative area water analysis from visualization layer.",
    )
