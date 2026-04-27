"""Random point sampling inside a GeoJSON polygon."""

import random

from shapely.geometry import shape, Point


def sample_points_in_polygon(geojson_geom: dict, count: int) -> list[tuple[float, float]]:
    """Generate random (lat, lon) points inside a GeoJSON polygon geometry."""
    geom = shape(geojson_geom)
    if not geom.is_valid:
        geom = geom.buffer(0)

    minx, miny, maxx, maxy = geom.bounds
    points: list[tuple[float, float]] = []
    max_attempts = count * 20

    for _ in range(max_attempts):
        if len(points) >= count:
            break
        lon = random.uniform(minx, maxx)
        lat = random.uniform(miny, maxy)
        if geom.contains(Point(lon, lat)):
            points.append((lat, lon))

    return points
