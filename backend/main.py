from contextlib import asynccontextmanager

from dotenv import load_dotenv

from fastapi import FastAPI

from fastapi.middleware.cors import (
    CORSMiddleware,
)

from routes import (
    analysis,
    alerts,
    hotspots,
    persistence,
    persistence_scan,
    response,
    satellite,
    storage,
    prediction,
)

from services.database_service import (
    init_database,
)


# =========================================================
# ENVIRONMENT VARIABLES
# =========================================================

load_dotenv()


# =========================================================
# APPLICATION LIFESPAN
# =========================================================

@asynccontextmanager
async def lifespan(
    app: FastAPI,
):

    # Initialize persistent GIS storage.
    init_database()

    yield


# =========================================================
# FASTAPI APPLICATION
# =========================================================

app = FastAPI(
    title="FireWatch AI API",

    description=(
        "NASA FIRMS thermal monitoring, "
        "OpenStreetMap geospatial context, "
        "historical persistence analysis, "
        "Copernicus Sentinel-2 satellite evidence, "
        "GIS storage and risk analysis API."
    ),

    version="1.0.0",

    lifespan=lifespan,
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],

    allow_credentials=True,

    allow_methods=[
        "*"
    ],

    allow_headers=[
        "*"
    ],
)


# =========================================================
# ROUTES
# =========================================================

app.include_router(
    hotspots.router
)

app.include_router(
    analysis.router
)

app.include_router(
    alerts.router
)

app.include_router(
    response.router
)

app.include_router(
    persistence.router
)

app.include_router(
    persistence_scan.router
)

app.include_router(
    satellite.router
)

app.include_router(
    storage.router
)

app.include_router(
    prediction.router
)

# =========================================================
# ROOT
# =========================================================

@app.get("/")
async def root():

    return {
        "name":
            "FireWatch AI",

        "status":
            "online",

        "services": [
            "NASA FIRMS thermal hotspots",
            "Persistent GIS storage",
            "OpenStreetMap context",
            "Reverse geocoding",
            "Historical FIRMS persistence",
            "Copernicus Sentinel-2 evidence",
            "NDVI analysis",
            "Incident response support",
            "Heuristic risk analysis",
            "Rule-based alerts",
        ],

        "modelStatus":
            "ML model not integrated",

        "satelliteStatus":
            "Sentinel-2 integration active",

        "storageStatus":
            "Persistent GIS storage active",
    }


# =========================================================
# HEALTH
# =========================================================

@app.get("/health")
async def health():

    return {
        "status":
            "ok"
    }