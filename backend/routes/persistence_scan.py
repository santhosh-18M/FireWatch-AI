import asyncio

from fastapi import (
    APIRouter,
    HTTPException,
    Query,
)

from services.firms_service import (
    get_india_hotspots,
)

from services.persistence_service import (
    get_persistence_analysis,
)


router = APIRouter(
    prefix="/dev/persistence-scan",
    tags=["Development"],
)


# Keep concurrency small so that we do not
# unnecessarily overload NASA FIRMS.
MAX_CONCURRENT_ANALYSES = 2


@router.get("")
@router.get("/")
async def scan_persistence(
    limit: int = Query(
        default=10,
        ge=1,
        le=20,
    ),
):
    """
    DEVELOPMENT / VERIFICATION ENDPOINT.

    Checks a limited number of current FIRMS hotspots
    and searches for real repeated historical activity.

    This endpoint is NOT intended for normal frontend use.
    """

    try:
        hotspots = await get_india_hotspots()

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Unable to load current NASA FIRMS hotspots",
        ) from exc


    selected = hotspots[:limit]

    semaphore = asyncio.Semaphore(
        MAX_CONCURRENT_ANALYSES
    )


    async def analyze_one(hotspot):

        async with semaphore:

            try:

                result = await get_persistence_analysis(
                    lat=hotspot["lat"],
                    lng=hotspot["lng"],

                    # VERY IMPORTANT:
                    # use the hotspot's acquisition date
                    # instead of blindly using today's date
                    reference_date=hotspot.get(
                        "acquiredAt"
                    ),
                )

                summary = result.get(
                    "summary",
                    {},
                )

                features = result.get(
                    "features",
                    {},
                )

                return {
                    "id":
                        hotspot.get("id"),

                    "name":
                        hotspot.get("name"),

                    "lat":
                        hotspot["lat"],

                    "lng":
                        hotspot["lng"],

                    "acquiredAt":
                        hotspot.get(
                            "acquiredAt"
                        ),

                    "activityType":
                        summary.get(
                            "activityType"
                        ),

                    "repeatActivity":
                        summary.get(
                            "repeatActivity"
                        ),

                    "distinctActiveDays":
                        summary.get(
                            "distinctActiveDays"
                        ),

                    "observationSpanDays":
                        summary.get(
                            "observationSpanDays"
                        ),

                    "firstObserved":
                        summary.get(
                            "firstObserved"
                        ),

                    "latestObserved":
                        summary.get(
                            "latestObserved"
                        ),

                    "detections30d":
                        features.get(
                            "detections30d"
                        ),

                    "meanGapDays":
                        features.get(
                            "meanGapDays"
                        ),

                    "matchingDetections":
                        result.get(
                            "matchingDetections"
                        ),

                    "status":
                        summary.get(
                            "status"
                        ),
                }


            except Exception as exc:

                return {
                    "id":
                        hotspot.get("id"),

                    "name":
                        hotspot.get("name"),

                    "lat":
                        hotspot.get("lat"),

                    "lng":
                        hotspot.get("lng"),

                    "error":
                        str(exc),
                }


    # Analyze selected current hotspots.
    results = await asyncio.gather(
        *[
            analyze_one(hotspot)
            for hotspot in selected
        ]
    )


    # =====================================================
    # SEPARATE RESULTS
    # =====================================================

    successful = [
        item
        for item in results
        if "error" not in item
    ]

    failed = [
        item
        for item in results
        if "error" in item
    ]


    repeated = [
        item
        for item in successful
        if item.get(
            "repeatActivity"
        )
    ]


    single = [
        item
        for item in successful
        if item.get(
            "activityType"
        ) == "single"
    ]


    none_found = [
        item
        for item in successful
        if item.get(
            "activityType"
        ) == "none"
    ]


    # =====================================================
    # SORT REPEATED SOURCES
    # =====================================================
    #
    # We are NOT assigning a persistence score.
    #
    # We simply place locations with more distinct
    # active dates first for easier verification.
    # =====================================================

    repeated.sort(
        key=lambda item: (
            item.get(
                "distinctActiveDays"
            )
            or 0
        ),
        reverse=True,
    )


    return {

        "purpose":
            (
                "Development verification of real "
                "NASA FIRMS repeated thermal activity"
            ),

        "scannedHotspots":
            len(selected),

        "successfulAnalyses":
            len(successful),

        "failedAnalyses":
            len(failed),

        "repeatedLocationsFound":
            len(repeated),

        "singleDateLocations":
            len(single),

        "noHistoricalLocations":
            len(none_found),

        "repeatedCandidates":
            repeated,

        "singleCandidates":
            single,

        "failed":
            failed,
    }