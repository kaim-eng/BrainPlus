"""
API v1 Router
"""

from fastapi import APIRouter

from app.api.v1 import deals, points, attribution

api_router = APIRouter()

# Include subrouters
api_router.include_router(deals.router, prefix="/deals", tags=["deals"])
api_router.include_router(points.router, prefix="/points", tags=["points"])
api_router.include_router(attribution.router, prefix="/r", tags=["attribution"])

