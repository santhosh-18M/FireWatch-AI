from math import asin, cos, radians, sin, sqrt
from typing import Optional


EARTH_RADIUS_KM = 6371.0


# These values are only used AFTER real OSM land context exists.
LAND_WEIGHTS = {
    "Forest": 18,
    "Grassland": 15,
    "Scrub": 13,
    "Agriculture": 12,
    "Residential": 12,
    "Urban": 11,
    "Industrial": 15,
    "Commercial": 10,
    "Bare Land": 5,
    "Wetland": 2,
    "Water": 0,
}


def clamp(value, minimum, maximum):
    return max(minimum, min(maximum, value))


def scale(value, minimum, maximum):
    """
    Convert a value into the range 0.0 - 1.0.
    """

    if value is None:
        return 0.0

    if maximum == minimum:
        return 0.0

    return clamp(
        (value - minimum) / (maximum - minimum),
        0.0,
        1.0,
    )


def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Distance between two coordinates in kilometres.
    """

    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)

    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1))
        * cos(radians(lat2))
        * sin(dlon / 2) ** 2
    )

    # Protect against floating-point errors.
    a = clamp(a, 0.0, 1.0)

    return (
        EARTH_RADIUS_KM
        * 2
        * asin(sqrt(a))
    )


def nearby_count(
    lat,
    lng,
    points,
    radius_km=10,
):
    """
    Count other FIRMS detections within radius_km.

    We count all detections and subtract one for
    the current hotspot. This allows repeated detections
    at exactly the same coordinates to still contribute.
    """

    count = 0

    for point in points:

        distance = haversine_distance(
            lat,
            lng,
            point["latitude"],
            point["longitude"],
        )

        if distance <= radius_km:
            count += 1

    # Remove the current hotspot itself.
    return max(0, count - 1)


def classify_source(
    land_type: Optional[str],
    frp: Optional[float],
):
    """
    Temporary rule-based contextual description.

    IMPORTANT:
    This is NOT the ML fire classifier.
    """

    if land_type == "Industrial":
        return "Industrial-area thermal source"

    if land_type in [
        "Forest",
        "Grassland",
        "Scrub",
    ]:
        return "Vegetation-area thermal anomaly"

    if land_type == "Agriculture":
        return "Agricultural-area thermal anomaly"

    if land_type in [
        "Urban",
        "Residential",
        "Commercial",
    ]:
        return "Urban-area thermal anomaly"

    if land_type == "Water":
        return "Thermal anomaly requiring verification"

    if frp is not None and frp > 50:
        return "High-energy thermal anomaly"

    return "Unclassified thermal source"


def score_fire(
    brightness,
    frp,
    confidence,
    land_type: Optional[str] = None,
    vegetation: Optional[float] = None,
    nearby=0,
):
    """
    Produce a transparent heuristic risk index.

    This is NOT an ML prediction.

    Current reliable contributors:
    - FIRMS brightness
    - FIRMS FRP
    - normalized confidence
    - nearby FIRMS hotspot density

    Land and vegetation are added only when
    real values are available.
    """

    contributors = {}

    maximum_possible = 0.0

    # ---------------------------------------------------
    # FIRMS Brightness
    # ---------------------------------------------------

    brightness_points = (
        scale(
            brightness,
            295,
            390,
        )
        * 30
    )

    contributors["Brightness"] = round(
        brightness_points,
        1,
    )

    maximum_possible += 30

    # ---------------------------------------------------
    # Fire Radiative Power
    # ---------------------------------------------------

    frp_points = (
        scale(
            frp,
            0,
            120,
        )
        * 30
    )

    contributors[
        "Fire radiative power"
    ] = round(
        frp_points,
        1,
    )

    maximum_possible += 30

    # ---------------------------------------------------
    # FIRMS confidence
    # ---------------------------------------------------

    confidence_points = (
        clamp(
            confidence or 0,
            0,
            100,
        )
        / 100
        * 20
    )

    contributors[
        "Detection confidence"
    ] = round(
        confidence_points,
        1,
    )

    maximum_possible += 20

    # ---------------------------------------------------
    # Nearby FIRMS detections
    # ---------------------------------------------------

    nearby_points = (
        min(nearby, 10)
        / 10
        * 20
    )

    contributors[
        "Nearby hotspot density"
    ] = round(
        nearby_points,
        1,
    )

    maximum_possible += 20

    # ---------------------------------------------------
    # REAL OSM land context
    # Only include it once land type is actually known.
    # ---------------------------------------------------

    if (
        land_type
        and land_type != "Unknown"
        and land_type in LAND_WEIGHTS
    ):
        land_points = LAND_WEIGHTS[
            land_type
        ]

        contributors[
            "Land context"
        ] = float(land_points)

        maximum_possible += 18

    # ---------------------------------------------------
    # REAL Sentinel vegetation
    # Only include when actually calculated.
    # ---------------------------------------------------

    if vegetation is not None:

        vegetation = clamp(
            vegetation,
            0,
            1,
        )

        vegetation_points = (
            vegetation * 10
        )

        contributors[
            "Vegetation context"
        ] = round(
            vegetation_points,
            1,
        )

        maximum_possible += 10

    # ---------------------------------------------------
    # Normalize active contributors to 0-100
    # ---------------------------------------------------

    raw_points = sum(
        contributors.values()
    )

    if maximum_possible > 0:

        score = round(
            raw_points
            / maximum_possible
            * 100
        )

    else:
        score = 0

    score = int(
        clamp(
            score,
            0,
            100,
        )
    )

    # ---------------------------------------------------
    # Risk categories
    # ---------------------------------------------------

    if score >= 85:
        level = "Extreme"

    elif score >= 65:
        level = "High"

    elif score >= 40:
        level = "Moderate"

    else:
        level = "Low"

    return {
        "riskScore": score,

        "riskLevel": level,

        "riskMethod":
            "Heuristic FIRMS Risk Index",

        "riskExplanation": [
            f"{name}: {value:.1f} points"
            for name, value
            in contributors.items()
        ],

        "riskContributors":
            contributors,
    }


def recommendation(
    land_type: Optional[str],
    level,
):
    """
    Operational recommendation based on
    available context.

    This is rule-based and should not be
    presented as ML output.
    """

    # Until OSM gives us actual land type
    if (
        not land_type
        or land_type == "Unknown"
    ):

        return {
            "Extreme":
                "Very strong thermal activity detected. "
                "Prioritize verification using additional "
                "satellite and ground information.",

            "High":
                "Strong thermal anomaly detected. "
                "Verify the hotspot and surrounding area.",

            "Moderate":
                "Thermal anomaly detected. "
                "Continue monitoring and verify local conditions.",

            "Low":
                "Low-intensity thermal anomaly detected. "
                "Monitor for persistence or increasing activity.",
        }[level]

    if land_type == "Water":

        return (
            "Thermal anomaly detected near water. "
            "Verify using another satellite observation."
        )

    if land_type == "Forest":

        if level in [
            "High",
            "Extreme",
        ]:
            return (
                "High-intensity thermal anomaly "
                "detected in forest context. "
                "Prioritize wildfire verification."
            )

        return (
            "Thermal anomaly detected in "
            "forest context. Continue monitoring."
        )

    if land_type == "Agriculture":

        return (
            "Thermal anomaly detected in "
            "agricultural land. Verify possible "
            "crop-residue or field burning."
        )

    if land_type == "Industrial":

        return (
            "Thermal anomaly detected near "
            "industrial land. Compare with "
            "historical hotspot persistence and "
            "facility information."
        )

    if land_type in [
        "Urban",
        "Residential",
        "Commercial",
    ]:

        return (
            "Thermal anomaly detected in a "
            "built-up area. Verify nearby "
            "infrastructure and local reports."
        )

    return (
        "Thermal anomaly detected. "
        "Continue monitoring and gather "
        "additional location context."
    )