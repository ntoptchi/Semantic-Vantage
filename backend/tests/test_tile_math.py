from app.utils.tile_math import get_tile_coords, get_pixel_in_tile, build_gibs_tile_url


def test_get_tile_coords_origin():
    row, col = get_tile_coords(0, 0, 2)
    assert row == 2
    assert col == 4


def test_get_tile_coords_positive():
    row, col = get_tile_coords(45, 90, 3)
    assert 0 <= row < 8
    assert 0 <= col < 16


def test_get_pixel_in_tile_range():
    row, col = get_tile_coords(40.0, -74.0, 5)
    px, py = get_pixel_in_tile(40.0, -74.0, 5, row, col)
    assert 0 <= px < 256
    assert 0 <= py < 256


def test_build_gibs_tile_url():
    url = build_gibs_tile_url(
        "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best",
        "MODIS_Terra_NDVI_8Day",
        "2024-01-01",
        "250m",
        6, 10, 20,
    )
    assert "MODIS_Terra_NDVI_8Day" in url
    assert "2024-01-01" in url
    assert "6/10/20.png" in url
