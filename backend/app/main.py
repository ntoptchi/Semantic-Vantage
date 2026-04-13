from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api import health, gibs, ndvi, fires, flood

app = FastAPI(
    title="Environmental NDVI Globe API",
    version="0.1.0",
    description="Backend API for NDVI vegetation data exploration",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(gibs.router)
app.include_router(ndvi.router)
app.include_router(fires.router)
app.include_router(flood.router)
