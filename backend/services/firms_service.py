import csv
import os
import time

from io import StringIO

import httpx

from services.database_service import (
    save_firms_observations,
)

from services.risk_service import (
    nearby_count,
    recommendation,
    score_fire,
)


_cache = None


# =========================================================
# HELPERS
# =========================================================

def optional_float(value):

    if (
        value is None
        or
        str(value).strip() == ""
    ):
        return None

    try:
        return float(value)

    except (
        TypeError,
        ValueError,
    ):
        return None


# =========================================================
# CONFIDENCE
# =========================================================

def confidence(value):

    mapping = {

        "l": 30,
        "n": 70,
        "h": 95,

        "low": 30,
        "nominal": 70,
        "high": 95,
    }


    try:

        return float(
            value
        )

    except (
        TypeError,
        ValueError,
    ):

        return mapping.get(
            str(value).lower(),
            70,
        )


# =========================================================
# FIRMS HOTSPOTS
# =========================================================

async def get_india_hotspots():

    global _cache


    # =====================================================
    # CACHE
    # =====================================================

    if (
        _cache
        and
        _cache[0] > time.monotonic()
    ):

        return _cache[1]


    # =====================================================
    # FIRMS CONFIG
    # =====================================================

    key = (
        os.getenv(
            "NASA_FIRMS_API_KEY"
        )
        or
        os.getenv(
            "FIRMS_API_KEY"
        )
    )


    if not key:

        raise RuntimeError(
            "NASA_FIRMS_API_KEY is not configured"
        )


    source = os.getenv(
        "FIRMS_SOURCE",
        "VIIRS_NOAA21_NRT",
    )


    days = min(
        max(
            int(
                os.getenv(
                    "FIRMS_DAYS",
                    "2",
                )
            ),
            1,
        ),
        10,
    )


    # =====================================================
    # REGIONAL FIRMS BOUNDING BOX
    # =====================================================

    url = (
        "https://firms.modaps.eosdis.nasa.gov"
        f"/api/area/csv/{key}/{source}"
        f"/68,6,98,38/{days}"
    )


    # =====================================================
    # FIRMS REQUEST
    # =====================================================

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(
            35,
            connect=10,
        )
    ) as client:

        response = await client.get(
            url
        )

        response.raise_for_status()


    rows = list(
        csv.DictReader(
            StringIO(
                response.text
            )
        )
    )


    # =====================================================
    # POINTS FOR NEARBY CALCULATION
    # =====================================================

    points = [

        {
            "latitude":
                float(
                    row[
                        "latitude"
                    ]
                ),

            "longitude":
                float(
                    row[
                        "longitude"
                    ]
                ),
        }

        for row in rows

    ]


    result = []

    storage_rows = []


    # =====================================================
    # BUILD HOTSPOTS
    # =====================================================

    for i, row in enumerate(
        rows[:500]
    ):

        lat = float(
            row[
                "latitude"
            ]
        )


        lng = float(
            row[
                "longitude"
            ]
        )


        # =================================================
        # FIRMS THERMAL VALUES
        # =================================================

        brightness_raw = (
            row.get(
                "bright_ti4"
            )
            or
            row.get(
                "brightness"
            )
        )


        brightness = optional_float(
            brightness_raw
        )


        frp = optional_float(
            row.get(
                "frp"
            )
        )


        scan = optional_float(
            row.get(
                "scan"
            )
        )


        track = optional_float(
            row.get(
                "track"
            )
        )


        raw_confidence = row.get(
            "confidence"
        )


        conf = confidence(
            raw_confidence
        )


        daynight = (
            row.get(
                "daynight"
            )
            or
            row.get(
                "dayNight"
            )
        )


        # =================================================
        # EXISTING HEURISTIC RISK
        # =================================================
        #
        # Risk calculation needs numeric thermal values.
        # These fallbacks belong only to the existing
        # heuristic risk calculation.
        #
        # They are NOT used as ML feature substitutions.
        # =================================================

        risk_brightness = (
            brightness
            if brightness is not None
            else 300.0
        )


        risk_frp = (
            frp
            if frp is not None
            else 0.0
        )


        nearby = nearby_count(
            lat,
            lng,
            points,
        )


        risk = score_fire(
            risk_brightness,
            risk_frp,
            conf,
            nearby=nearby,
        )


        # =================================================
        # ACQUISITION TIME
        # =================================================

        acq_time = str(
            row.get(
                "acq_time",
                "",
            )
        ).zfill(
            4
        )


        acquired_at = (
            f"{row.get('acq_date', '')}"
            f"T{acq_time[:2]}"
            f":{acq_time[2:]}"
            ":00Z"
        )


        satellite = (
            row.get(
                "satellite"
            )
            or
            source
        )


        # =================================================
        # HOTSPOT OBJECT
        # =================================================

        hotspot = {

            "id":
                (
                    f"{satellite}-"
                    f"{row.get('acq_date', '')}-"
                    f"{acq_time}-"
                    f"{lat:.4f}-"
                    f"{lng:.4f}"
                ),

            "name":
                f"Thermal hotspot {i + 1}",

            "state":
                "Unresolved",

            "lat":
                lat,

            "lng":
                lng,

            "satellite":
                satellite,

            # =============================================
            # FIRMS THERMAL DATA
            # =============================================

            "brightness":
                brightness,

            "frp":
                frp,

            "confidence":
                conf,

            # =============================================
            # RAW FIRMS VALUES REQUIRED BY ML V3
            # =============================================

            "scan":
                scan,

            "track":
                track,

            "dayNight":
                daynight,

            "rawConfidence":
                raw_confidence,

            # =============================================
            # EXISTING APPLICATION FIELDS
            # =============================================

            "landType":
                "Unknown",

            "fireType":
                "Unclassified thermal source",

            "vegetation":
                None,

            "nearbyHotspots":
                nearby,

            **risk,

            "recommendation":
                recommendation(
                    "Unknown",
                    risk[
                        "riskLevel"
                    ],
                ),

            "acquiredAt":
                acquired_at,
        }


        result.append(
            hotspot
        )


        # =================================================
        # ORIGINAL RAW NASA FIRMS ROW FOR DATABASE
        # =================================================

        storage_rows.append(
            row
        )


    # =====================================================
    # PERSIST OBSERVATIONS
    # =====================================================

    if result:

        save_firms_observations(
            observations=result,
            source_product=source,
            raw_rows=storage_rows,
        )


    # =====================================================
    # CACHE
    # =====================================================

    ttl = int(
        os.getenv(
            "FIRMS_CACHE_TTL_SECONDS",
            "300",
        )
    )


    _cache = (
        time.monotonic()
        +
        ttl,

        result,
    )


    return result