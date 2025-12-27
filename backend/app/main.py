"""
FastAPI Main Application
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.api.v1 import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic"""
    print("[API] Starting up...")
    # TODO: Initialize database connections
    yield
    print("[API] Shutting down...")
    # TODO: Close database connections

# Create FastAPI app
app = FastAPI(
    title="BrainPlus API",
    description="Optional backend for BrainPlus - Deals matching and points system",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")

# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
    }

@app.get("/")
async def root():
    return {
        "message": "BrainPlus API",
        "docs": "/docs",
        "health": "/health",
    }

