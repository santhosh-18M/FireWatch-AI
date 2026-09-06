from fastapi import (
    APIRouter,
    HTTPException,
    Query,
)

from services.database_service import (
    get_database_status,
    get_historical_analytics,
    get_hotspots_in_bbox,
    get_repeated_thermal_locations,
)


router = APIRouter(
    prefix="/storage",
    tags=["GIS Storage"],
)


# =========================================================
# STORAGE STATUS
# =========================================================

@router.get("/status")
async def storage_status():

    try:

        return get_database_status()

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to read GIS storage: "
                f"{str(exc)}"
            ),
        ) from exc


# =========================================================
# HISTORICAL GIS ANALYTICS
# =========================================================

@router.get("/analytics")
async def historical_analytics():

    try:

        return get_historical_analytics()

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to build historical analytics: "
                f"{str(exc)}"
            ),
        ) from exc


# =========================================================
# REPEATED THERMAL LOCATIONS
# =========================================================

@router.get("/repeated-locations")
async def repeated_thermal_locations(

    days: int = Query(
        30,
        ge=1,
        le=90,
    ),

    radius_km: float = Query(
        1.0,
        ge=0.1,
        le=5.0,
    ),

    min_active_days: int = Query(
        2,
        ge=2,
        le=30,
    ),

    limit: int = Query(
        100,
        ge=1,
        le=500,
    ),
):

    try:

        return get_repeated_thermal_locations(
            days=days,
            radius_km=radius_km,
            min_active_days=min_active_days,
            limit=limit,
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "Repeated thermal location analysis "
                "failed: "
                f"{str(exc)}"
            ),
        ) from exc


# =========================================================
# STORED HOTSPOTS BY BOUNDING BOX
# =========================================================

@router.get("/hotspots")
async def stored_hotspots(

    min_lat: float = Query(
        ...,
        ge=-90,
        le=90,
    ),

    max_lat: float = Query(
        ...,
        ge=-90,
        le=90,
    ),

    min_lng: float = Query(
        ...,
        ge=-180,
        le=180,
    ),

    max_lng: float = Query(
        ...,
        ge=-180,
        le=180,
    ),

    limit: int = Query(
        1000,
        ge=1,
        le=5000,
    ),
):

    try:

        return get_hotspots_in_bbox(
            min_lat=min_lat,
            max_lat=max_lat,
            min_lng=min_lng,
            max_lng=max_lng,
            limit=limit,
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "Stored hotspot query failed: "
                f"{str(exc)}"
            ),
        ) from exc