"""Service for interacting with NASA GIBS WMTS."""

import time
import xml.etree.ElementTree as ET

import httpx

from app.config import settings
from app.models.schemas import NDVILayer, CapabilitiesResponse

_capabilities_cache: dict[str, tuple[float, CapabilitiesResponse]] = {}

NDVI_KEYWORDS = [
    "ndvi",
    "normalized difference vegetation index",
]

# Temporary hardcoded fallback NDVI layer for robustness when discovery fails.
FALLBACK_NDVI_LAYERS: list[NDVILayer] = [
    NDVILayer(
        identifier="MODIS_Terra_NDVI_8Day",
        title="MODIS Terra NDVI 8 Day",
        format="image/png",
        style="default",
        tile_matrix_set_id="250m",
        time_start=None,
        time_end=None,
        time_default=None,
    )
]

NS = {
    "wmts": "http://www.opengis.net/wmts/1.0",
    "ows": "http://www.opengis.net/ows/1.1",
}


async def fetch_capabilities() -> CapabilitiesResponse:
    cache_key = "gibs_caps"
    now = time.time()

    if cache_key in _capabilities_cache:
        ts, cached = _capabilities_cache[cache_key]
        if now - ts < settings.gibs_capabilities_cache_ttl:
            return cached

    url = f"{settings.gibs_wmts_base}/1.0.0/WMTSCapabilities.xml"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url)
        resp.raise_for_status()

    root = ET.fromstring(resp.text)
    contents = root.find("wmts:Contents", NS)
    if contents is None:
        return CapabilitiesResponse(layers=[], fetched_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))

    layers: list[NDVILayer] = []

    for layer_el in contents.findall("wmts:Layer", NS):
        identifier_el = layer_el.find("ows:Identifier", NS)
        title_el = layer_el.find("ows:Title", NS)
        if identifier_el is None:
            continue
        ident = (identifier_el.text or "").strip()
        title_text = (title_el.text or "").strip() if title_el is not None else ident

        ident_lower = ident.lower()
        title_lower = title_text.lower()
        if not any(kw in ident_lower or kw in title_lower for kw in NDVI_KEYWORDS):
            # Skip non-NDVI layers for this MVP – we only expose NDVI-related imagery.
            continue

        title = title_text or ident
        fmt = "image/png"
        style = "default"

        fmt_el = layer_el.find("wmts:Format", NS)
        if fmt_el is not None and fmt_el.text:
            fmt = fmt_el.text

        style_el = layer_el.find("wmts:Style/ows:Identifier", NS)
        if style_el is not None and style_el.text:
            style = style_el.text

        tms_link = layer_el.find("wmts:TileMatrixSetLink/wmts:TileMatrixSet", NS)
        tms_id = tms_link.text if tms_link is not None and tms_link.text else "250m"

        time_start = None
        time_end = None
        time_default = None
        dim_el = layer_el.find("wmts:Dimension", NS)
        if dim_el is not None:
            dim_id = dim_el.find("ows:Identifier", NS)
            if dim_id is not None and dim_id.text and dim_id.text.lower() == "time":
                default_el = dim_el.find("wmts:Default", NS)
                if default_el is not None and default_el.text:
                    time_default = default_el.text
                values_el = dim_el.find("wmts:Value", NS)
                if values_el is not None and values_el.text:
                    parts = values_el.text.split("/")
                    if len(parts) >= 2:
                        time_start = parts[0]
                        time_end = parts[1]
                    else:
                        time_start = parts[0]

        layers.append(NDVILayer(
            identifier=ident,
            title=title,
            format=fmt,
            style=style,
            tile_matrix_set_id=tms_id,
            time_start=time_start,
            time_end=time_end,
            time_default=time_default,
        ))

    if not layers:
        # TEMPORARY FALLBACK:
        # If no NDVI layers were discovered from the capabilities document,
        # return a known-good MODIS Terra NDVI layer so the frontend can render
        # an overlay immediately. Remove this once discovery is reliable.
        result = CapabilitiesResponse(
            layers=FALLBACK_NDVI_LAYERS,
            fetched_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        )
    else:
        result = CapabilitiesResponse(
            layers=layers,
            fetched_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        )

    _capabilities_cache[cache_key] = (now, result)
    return result


async def get_ndvi_layer_by_identifier(identifier: str) -> NDVILayer | None:
    """Return the NDVI layer with the given identifier from cached capabilities, or None."""
    caps = await fetch_capabilities()
    for layer in caps.layers:
        if layer.identifier == identifier:
            return layer
    return None
