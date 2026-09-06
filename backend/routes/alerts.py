import httpx

from fastapi import (
    APIRouter,
    HTTPException,
)

from services.firms_service import (
    get_india_hotspots,
)


router = APIRouter(
    prefix="/alerts",
    tags=["Alerts"],
)


def build_alert(
    hotspot: dict,
) -> dict | None:
    """
    Build an alert only for High or Extreme
    FIRMS heuristic risk detections.

    This is rule-based.
    This is NOT ML classification.
    """

    risk_level = hotspot.get(
        "riskLevel",
        "Low",
    )

    if risk_level not in {
        "High",
        "Extreme",
    }:
        return None


    brightness = float(
        hotspot.get(
            "brightness"
        )
        or 0
    )

    frp = float(
        hotspot.get(
            "frp"
        )
        or 0
    )

    nearby = int(
        hotspot.get(
            "nearbyHotspots"
        )
        or 0
    )

    risk_score = int(
        hotspot.get(
            "riskScore"
        )
        or 0
    )


    # =====================================================
    # ALERT CONTENT
    # =====================================================

    if risk_level == "Extreme":

        title = (
            "Extreme-risk thermal anomaly"
        )

        priority = (
            "Critical"
        )

        message = (
            "This FIRMS thermal detection has "
            "an Extreme Heuristic FIRMS Risk Index."
        )

    else:

        title = (
            "High-risk thermal anomaly"
        )

        priority = (
            "High"
        )

        message = (
            "This FIRMS thermal detection has "
            "a High Heuristic FIRMS Risk Index."
        )


    # =====================================================
    # LOCATION
    # =====================================================

    state = hotspot.get(
        "state"
    )

    if (
        state
        and state != "Unresolved"
    ):

        location = state

    else:

        location = (
            f"{hotspot['lat']:.4f}, "
            f"{hotspot['lng']:.4f}"
        )


    # =====================================================
    # RESPONSE
    # =====================================================

    return {

        "id":
            f"alert-{hotspot['id']}",

        "hotspotId":
            hotspot["id"],

        "title":
            title,

        "message":
            message,

        "severity":
            risk_level,

        "priority":
            priority,

        "status":
            "Active",

        "location":
            location,

        "lat":
            hotspot["lat"],

        "lng":
            hotspot["lng"],

        "brightness":
            brightness,

        "frp":
            frp,

        "confidence":
            hotspot.get(
                "confidence"
            ),

        "nearbyHotspots":
            nearby,

        "riskScore":
            risk_score,

        "riskLevel":
            risk_level,

        "riskMethod":
            hotspot.get(
                "riskMethod",
                "Heuristic FIRMS Risk Index",
            ),

        "riskExplanation":
            hotspot.get(
                "riskExplanation",
                [],
            ),

        "recommendation":
            hotspot.get(
                "recommendation"
            ),

        "timestamp":
            hotspot.get(
                "acquiredAt"
            ),
    }


@router.get("")
@router.get("/")
async def get_alerts():
    """
    Return current High and Extreme
    FIRMS risk alerts.
    """

    try:

        hotspots = (
            await get_india_hotspots()
        )

        alerts = []

        for hotspot in hotspots:

            alert = build_alert(
                hotspot
            )

            if alert is not None:

                alerts.append(
                    alert
                )


        # =================================================
        # SORT: Highest risk first
        # =================================================

        alerts.sort(
            key=lambda item: (
                item.get(
                    "riskScore"
                )
                or 0,
                item.get(
                    "frp"
                )
                or 0,
            ),
            reverse=True,
        )


        return alerts


    except RuntimeError as exc:

        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc


    except httpx.HTTPError as exc:

        raise HTTPException(
            status_code=502,
            detail=(
                "NASA FIRMS is temporarily unavailable"
            ),
        ) from exc


    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to generate alerts: "
                f"{str(exc)}"
            ),
        ) from exc