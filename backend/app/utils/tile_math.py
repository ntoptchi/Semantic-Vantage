"""WMTS tile math for NASA GIBS: EPSG:4326 (Geographic) and EPSG:3857 (Web Mercator)."""

import math

# GIBS tile constants
TILE_SIZE = 256
TOP_LEFT_LAT = 90.0
TOP_LEFT_LON = -180.0


def get_tile_coords(lat: float, lon: float, zoom: int) -> tuple[int, int]:
    """Return (tile_row, tile_col) for a given lat/lon at the specified zoom level.

    GIBS EPSG:4326 uses a 2:1 tile matrix at zoom 0 (2 cols x 1 row),
    doubling each level.
    """
    n_rows = 2**zoom
    n_cols = 2 ** (zoom + 1)

    col = int((lon - TOP_LEFT_LON) / 360.0 * n_cols)
    row = int((TOP_LEFT_LAT - lat) / 180.0 * n_rows)

    col = max(0, min(col, n_cols - 1))
    row = max(0, min(row, n_rows - 1))
    return row, col


def get_pixel_in_tile(lat: float, lon: float, zoom: int, tile_row: int, tile_col: int) -> tuple[int, int]:
    """Return (pixel_x, pixel_y) within a tile for a given lat/lon."""
    n_rows = 2**zoom
    n_cols = 2 ** (zoom + 1)

    tile_lon_span = 360.0 / n_cols
    tile_lat_span = 180.0 / n_rows

    tile_left = TOP_LEFT_LON + tile_col * tile_lon_span
    tile_top = TOP_LEFT_LAT - tile_row * tile_lat_span

    frac_x = (lon - tile_left) / tile_lon_span
    frac_y = (tile_top - lat) / tile_lat_span

    px = int(frac_x * TILE_SIZE)
    py = int(frac_y * TILE_SIZE)

    px = max(0, min(px, TILE_SIZE - 1))
    py = max(0, min(py, TILE_SIZE - 1))
    return px, py


def build_gibs_tile_url(
    base_url: str,
    layer: str,
    date: str,
    tile_matrix_set: str,
    zoom: int,
    tile_row: int,
    tile_col: int,
    img_format: str = "image/png",
    style: str = "default",
) -> str:
    """Build a GIBS WMTS REST tile URL (EPSG:4326 or EPSG:3857)."""
    fmt_ext = "png" if "png" in img_format.lower() else "jpg"
    return (
        f"{base_url}/{layer}/{style}/{date}/{tile_matrix_set}/{zoom}/{tile_row}/{tile_col}.{fmt_ext}"
    )


# --- EPSG:3857 (Web Mercator) for GoogleMapsCompatible tile matrix sets ---

def _mercator_tile_y(lat_deg: float, n: int) -> float:
    """Web Mercator tile Y (row) from latitude; row 0 = north."""
    lat_rad = math.radians(lat_deg)
    # Avoid pole singularities
    lat_rad = max(-85.051129, min(85.051129, lat_rad))
    return (1 - math.log(math.tan(lat_rad) + 1 / math.cos(lat_rad)) / math.pi) / 2 * n


def get_tile_coords_3857(lat: float, lon: float, zoom: int) -> tuple[int, int]:
    """Return (tile_col, tile_row) for lat/lon in Web Mercator at the given zoom (Google convention)."""
    n = 2**zoom
    col = int((lon + 180.0) / 360.0 * n)
    col = max(0, min(col, n - 1))
    y = _mercator_tile_y(lat, n)
    row = int(math.floor(y))
    row = max(0, min(row, n - 1))
    return col, row


def get_pixel_in_tile_3857(
    lat: float, lon: float, zoom: int, tile_col: int, tile_row: int,
    tile_size: int = 512,
) -> tuple[int, int]:
    """Return (pixel_x, pixel_y) within a tile for the given lat/lon.

    ``tile_size`` defaults to 512 (GIBS high-res products).  Pass 256 for
    standard-resolution products like flood layers.
    """
    n = 2**zoom
    tile_left = (tile_col / n) * 360.0 - 180.0
    tile_right = ((tile_col + 1) / n) * 360.0 - 180.0
    lat_rad_top = math.atan(math.sinh(math.pi * (1 - 2 * tile_row / n)))
    lat_rad_bot = math.atan(math.sinh(math.pi * (1 - 2 * (tile_row + 1) / n)))
    tile_top_lat = math.degrees(lat_rad_top)
    tile_bottom_lat = math.degrees(lat_rad_bot)

    frac_x = (lon - tile_left) / (tile_right - tile_left)
    frac_y = (
        (tile_top_lat - lat) / (tile_top_lat - tile_bottom_lat)
        if tile_top_lat != tile_bottom_lat
        else 0.5
    )

    px = int(frac_x * tile_size)
    py = int(frac_y * tile_size)

    px = max(0, min(px, tile_size - 1))
    py = max(0, min(py, tile_size - 1))
    return px, py


def tile_matrix_set_id_to_3857(native_tile_matrix_set_id: str) -> tuple[str, int]:
    """Map GIBS native (4326) matrix set id to (GoogleMapsCompatible_LevelX, zoom_level)."""
    mapping = {
        "2km": ("GoogleMapsCompatible_Level6", 6),
        "1km": ("GoogleMapsCompatible_Level7", 7),
        "500m": ("GoogleMapsCompatible_Level8", 8),
        "250m": ("GoogleMapsCompatible_Level9", 9),
    }
    return mapping.get(
        native_tile_matrix_set_id,
        ("GoogleMapsCompatible_Level7", 7),
    )
