from fastapi import APIRouter, HTTPException

from app.models.schemas import CapabilitiesResponse
from app.services.gibs_service import fetch_capabilities

router = APIRouter(prefix="/gibs", tags=["gibs"])


@router.get("/capabilities", response_model=CapabilitiesResponse)
async def get_capabilities():
    try:
        return await fetch_capabilities()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch GIBS capabilities: {e}")
