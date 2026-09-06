import asyncio

from fastapi import (
    APIRouter,
    HTTPException,
    Query,
)

from services.geocoding_service import (
    reverse_geocode,
)

from services.osm_service import (
    get_osm_context,
)

from services.persistence_service import (
    get_persistence_analysis,
)

from services.risk_service import (
    recommendation,
    score_fire,
)


router = APIRouter(
    prefix="/analysis",
    tags=["Analysis"],
)


# ==========================================================
# LIGHTWEIGHT LOCATION LOOKUP
# ==========================================================

@router.get("/location")
async def get_hotspot_location(
    lat: float = Query(
        ...,
        ge=-90,
        le=90,
    ),
    lng: float = Query(
        ...,
        ge=-180,
        le=180,
    ),
):
    """
    Lightweight reverse-geocoding endpoint.

    Called when the user selects a FIRMS hotspot.

    Does NOT run:
    - OSM context
    - persistence analysis
    - risk recalculation
    - ML classification
    """

    try:

        location = await reverse_geocode(
            lat,
            lng,
        )

        return {
            "lat": lat,
            "lng": lng,
            "city": location.city,
            "district": location.district,
            "state": location.state,
            "country": location.country,
            "displayName": location.display_name,
        }

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "Location lookup failed: "
                f"{str(exc)}"
            ),
        ) from exc


# ==========================================================
# FALLBACK OSM CONTEXT
# ==========================================================

def empty_osm_context(
    message: str | None = None,
):
    """
    Fallback response used when OpenStreetMap
    context lookup is temporarily unavailable.

    IMPORTANT:
    No fake distances are created.
    Missing values stay None.
    """

    return {
        "landType": "Unknown",

        # Existing frontend-compatible fields
        "nearestIndustrialKm": None,
        "nearestFactoryKm": None,
        "nearestRefineryKm": None,
        "nearestPowerPlantKm": None,
        "nearestForestKm": None,
        "nearestAgricultureKm": None,

        # V3-compatible natural context
        "nearestNaturalKm": None,

        # V3 deployment model context
        "industrialWithin1_5Km": False,
        "naturalWithin1_5Km": False,

        # General OSM information
        "nearestFeature": None,
        "nearestFeatureName": None,
        "nearestFeatureDistanceKm": None,

        "osmFeaturesFound": 0,

        "lookupStatus": "unavailable",
        "lookupMessage": message,
    }


# ==========================================================
# FALLBACK PERSISTENCE
# ==========================================================

def unavailable_persistence(
    message: str | None = None,
):
    """
    Persistence failure response.

    Missing historical information is not
    replaced with invented values.
    """

    return {
        "available": False,

        "source": "NASA FIRMS",

        "method": (
            "Historical NASA FIRMS "
            "spatial-temporal matching"
        ),

        "features": None,

        "summary": {
            "activityType": "unavailable",

            "repeatActivity": None,

            "status": (
                "Historical analysis unavailable"
            ),

            "distinctActiveDays": None,

            "observationSpanDays": None,

            "firstObserved": None,

            "latestObserved": None,

            "message": (
                message
                or
                "Historical FIRMS data could "
                "not be analyzed."
            ),
        },
    }


# ==========================================================
# FULL HOTSPOT ANALYSIS
# ==========================================================

@router.get("")
@router.get("/")
async def analyze(

    lat: float = Query(
        ...,
        ge=-90,
        le=90,
    ),

    lng: float = Query(
        ...,
        ge=-180,
        le=180,
    ),

    brightness: float | None = Query(
        None,
        description=(
            "NASA FIRMS brightness temperature"
        ),
    ),

    frp: float | None = Query(
        None,
        ge=0,
        description=(
            "NASA FIRMS Fire Radiative Power"
        ),
    ),

    confidence: float | None = Query(
        None,
        ge=0,
        le=100,
        description=(
            "Current normalized FIRMS "
            "confidence value"
        ),
    ),

    nearby: int = Query(
        0,
        ge=0,
        description=(
            "Number of nearby FIRMS hotspots"
        ),
    ),

    vegetation: float | None = Query(
        None,
        ge=0,
        le=1,
        description=(
            "Optional real vegetation value. "
            "Leave empty until Sentinel "
            "analysis is integrated."
        ),
    ),

    reference_date: str | None = Query(
        None,
        description=(
            "FIRMS hotspot acquisition date. "
            "Use YYYY-MM-DD or acquiredAt ISO timestamp."
        ),
    ),
):
    """
    Complete investigation of one NASA FIRMS
    thermal anomaly.

    Combines:

    1. Reverse geocoding
    2. OpenStreetMap context
    3. Historical NASA FIRMS persistence
    4. Heuristic FIRMS risk assessment

    XGBoost classification is intentionally
    handled separately by /prediction/classify.
    """

    try:

        # ==================================================
        # 1. RUN EXTERNAL LOOKUPS IN PARALLEL
        # ==================================================

        (
            location_result,
            osm_result,
            persistence_result,
        ) = await asyncio.gather(

            reverse_geocode(
                lat,
                lng,
            ),

            get_osm_context(
                lat,
                lng,
            ),

            get_persistence_analysis(
                lat=lat,
                lng=lng,
                reference_date=reference_date,
            ),

            return_exceptions=True,
        )


        # ==================================================
        # 2. LOCATION
        # ==================================================

        if isinstance(
            location_result,
            BaseException,
        ):

            raise RuntimeError(
                "Reverse geocoding failed: "
                f"{str(location_result)}"
            )


        location = location_result


        # ==================================================
        # 3. OSM CONTEXT
        # ==================================================

        if isinstance(
            osm_result,
            BaseException,
        ):

            osm_context = empty_osm_context(
                str(osm_result)
            )

        else:

            osm_context = osm_result


        land = osm_context.get(
            "landType",
            "Unknown",
        )


        # ==================================================
        # 4. PERSISTENCE
        # ==================================================

        if isinstance(
            persistence_result,
            BaseException,
        ):

            persistence = unavailable_persistence(
                str(
                    persistence_result
                )
            )

        else:

            persistence = {
                "available": True,
                **persistence_result,
            }


        # ==================================================
        # 5. HEURISTIC RISK
        # ==================================================
        #
        # IMPORTANT:
        #
        # This remains completely separate from
        # the XGBoost classification model.
        #
        # Persistence is not manually added to
        # this score.
        # ==================================================

        risk = score_fire(
            brightness=brightness,
            frp=frp,
            confidence=confidence,

            land_type=(
                land
                if land != "Unknown"
                else None
            ),

            vegetation=vegetation,

            nearby=nearby,
        )


        # ==================================================
        # 6. RECOMMENDATION
        # ==================================================

        rec = recommendation(
            land,
            risk["riskLevel"],
        )


        # ==================================================
        # 7. CLASSIFICATION PLACEHOLDER
        # ==================================================
        #
        # We still do not generate an ML result here.
        #
        # /prediction/classify will become the
        # authoritative model endpoint.
        # ==================================================

        classification = {
            "label": None,

            "confidence": None,

            "modelStatus": (
                "Use /prediction/classify "
                "for AI classification"
            ),
        }


        # ==================================================
        # 8. RESPONSE
        # ==================================================

        return {

            # ------------------------------------------------
            # Coordinates
            # ------------------------------------------------

            "lat": lat,

            "lng": lng,


            # ------------------------------------------------
            # Location
            # ------------------------------------------------

            "location": {

                "city":
                    location.city,

                "district":
                    location.district,

                "state":
                    location.state,

                "country":
                    location.country,

                "displayName":
                    location.display_name,
            },


            # Existing frontend compatibility

            "city":
                location.city,

            "district":
                location.district,

            "state":
                location.state,

            "country":
                location.country,


            # ------------------------------------------------
            # OSM CONTEXT
            # ------------------------------------------------

            "landType":
                land,

            "osm":
                osm_context,


            # ------------------------------------------------
            # CURRENT FIRMS OBSERVATION
            # ------------------------------------------------

            "firms": {

                "brightness":
                    brightness,

                "frp":
                    frp,

                "confidence":
                    confidence,

                "nearbyHotspots":
                    nearby,

                "referenceDate":
                    reference_date,
            },


            # ------------------------------------------------
            # HISTORICAL FIRMS
            # ------------------------------------------------

            "persistence":
                persistence,


            # ------------------------------------------------
            # HEURISTIC RISK
            # ------------------------------------------------

            **risk,


            "recommendation":
                rec,


            # ------------------------------------------------
            # AI PLACEHOLDER
            # ------------------------------------------------

            "classification":
                classification,


            # ------------------------------------------------
            # LEGACY FRONTEND COMPATIBILITY
            # ------------------------------------------------

            "fireType":
                "Unclassified thermal source",

            "modelStatus":
                "Classification endpoint not called",
        }


    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Analysis failed: {str(exc)}"
            ),
        ) from exc