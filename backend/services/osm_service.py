from __future__ import annotations

import asyncio
import logging
import time

from dataclasses import dataclass
from math import asin, cos, radians, sin, sqrt
from typing import Any

import httpx


logger = logging.getLogger(__name__)


# =========================================================
# CONFIGURATION
# =========================================================

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


# Compatibility for other services.
OVERPASS_URL = OVERPASS_ENDPOINTS[0]


# IMPORTANT:
# Must remain aligned with FireWatch V3 deployment model.
SEARCH_RADIUS_METERS = 1500


# Successful OSM lookups are cached for 24 hours.
CACHE_TTL = 86400


# Individual HTTP request timeout.
REQUEST_TIMEOUT = 45.0


# Number of attempts PER endpoint.
MAX_RETRIES_PER_ENDPOINT = 2


# Delay after successful external Overpass request.
# Helps avoid immediately sending another heavy request.
OVERPASS_SUCCESS_COOLDOWN_SECONDS = 1.0


# Base retry delay.
RETRY_BASE_DELAY_SECONDS = 2.0


# Retry these server-side statuses.
RETRYABLE_STATUS_CODES = {
    429,
    500,
    502,
    503,
    504,
}


# =========================================================
# CACHE
# =========================================================

@dataclass
class CacheEntry:
    value: dict[str, Any]
    expires: float


_cache: dict[
    tuple[float, float],
    CacheEntry,
] = {}


_locks: dict[
    tuple[float, float],
    asyncio.Lock,
] = {}


# =========================================================
# GLOBAL OVERPASS LOCK
# =========================================================
#
# Only ONE uncached Overpass lookup may run at a time.
#
# This prevents:
#   batch scanner
#   analysis panel
#   classifier
#
# from simultaneously hammering public Overpass servers.
# =========================================================

_overpass_lock = asyncio.Lock()


# =========================================================
# DISTANCE
# =========================================================

def haversine_distance_km(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> float:

    dlat = radians(
        lat2 - lat1
    )

    dlon = radians(
        lon2 - lon1
    )


    a = (
        sin(
            dlat / 2
        ) ** 2
        +
        cos(
            radians(
                lat1
            )
        )
        *
        cos(
            radians(
                lat2
            )
        )
        *
        sin(
            dlon / 2
        ) ** 2
    )


    a = max(
        0.0,
        min(
            1.0,
            a,
        ),
    )


    return (
        6371.0
        *
        2
        *
        asin(
            sqrt(
                a
            )
        )
    )


# =========================================================
# ELEMENT COORDINATES
# =========================================================

def get_element_coordinates(
    element: dict[str, Any],
) -> tuple[float, float] | None:

    # -----------------------------------------------------
    # NODE
    # -----------------------------------------------------

    if (
        "lat" in element
        and
        "lon" in element
    ):

        try:

            return (
                float(
                    element[
                        "lat"
                    ]
                ),
                float(
                    element[
                        "lon"
                    ]
                ),
            )

        except (
            TypeError,
            ValueError,
        ):

            return None


    # -----------------------------------------------------
    # WAY / RELATION CENTER
    # -----------------------------------------------------

    center = element.get(
        "center"
    )


    if (
        isinstance(
            center,
            dict,
        )
        and
        "lat" in center
        and
        "lon" in center
    ):

        try:

            return (
                float(
                    center[
                        "lat"
                    ]
                ),
                float(
                    center[
                        "lon"
                    ]
                ),
            )

        except (
            TypeError,
            ValueError,
        ):

            return None


    return None


# =========================================================
# INDUSTRIAL CATEGORY HELPERS
# =========================================================

INDUSTRIAL_VALUES = {
    "factory",
    "refinery",
    "oil",
    "gas",
    "chemical",
    "steel",
    "cement",
    "mining",
    "mine",
    "manufacturing",
}


INDUSTRIAL_MAN_MADE = {
    "works",
    "petroleum_well",
    "storage_tank",
    "silo",
    "kiln",
    "chimney",
}


INDUSTRIAL_POWER = {
    "plant",
    "generator",
    "substation",
}


# =========================================================
# CLASSIFY OSM FEATURE
# =========================================================

def classify_osm_feature(
    tags: dict[str, Any],
) -> str | None:

    landuse = str(
        tags.get(
            "landuse",
            "",
        )
    ).lower()


    natural = str(
        tags.get(
            "natural",
            "",
        )
    ).lower()


    industrial = str(
        tags.get(
            "industrial",
            "",
        )
    ).lower()


    man_made = str(
        tags.get(
            "man_made",
            "",
        )
    ).lower()


    power = str(
        tags.get(
            "power",
            "",
        )
    ).lower()


    amenity = str(
        tags.get(
            "amenity",
            "",
        )
    ).lower()


    # =====================================================
    # SPECIFIC INDUSTRIAL FEATURES
    # =====================================================

    if industrial == "refinery":

        return "Refinery"


    if power == "plant":

        return "Power Plant"


    if power == "generator":

        return "Power Generator"


    if power == "substation":

        return "Power Substation"


    if man_made == "works":

        return "Factory"


    if man_made == "storage_tank":

        return "Storage Tank"


    if man_made == "petroleum_well":

        return "Petroleum Well"


    if man_made == "silo":

        return "Silo"


    if man_made == "kiln":

        return "Kiln"


    if man_made == "chimney":

        return "Chimney"


    if amenity == "fuel":

        return "Fuel Facility"


    # =====================================================
    # GENERIC INDUSTRIAL
    # =====================================================

    if landuse == "industrial":

        return "Industrial"


    # Any industrial=* tag counts as industrial context.
    if industrial:

        return "Industrial"


    if (
        landuse
        in
        INDUSTRIAL_VALUES
    ):

        return "Industrial"


    # =====================================================
    # NATURAL / VEGETATION CONTEXT
    # =====================================================

    if landuse == "forest":

        return "Forest"


    if natural == "wood":

        return "Forest"


    if landuse in {
        "farmland",
        "farmyard",
        "orchard",
        "vineyard",
    }:

        return "Agriculture"


    if landuse in {
        "meadow",
        "grass",
    }:

        return "Grassland"


    if natural in {
        "grass",
        "grassland",
    }:

        return "Grassland"


    if natural in {
        "scrub",
        "heath",
    }:

        return "Scrub"


    # =====================================================
    # OTHER CONTEXT
    # =====================================================

    if landuse == "residential":

        return "Residential"


    if landuse in {
        "commercial",
        "retail",
    }:

        return "Commercial"


    if natural == "water":

        return "Water"


    if natural == "wetland":

        return "Wetland"


    if natural in {
        "sand",
        "bare_rock",
        "scree",
    }:

        return "Bare Land"


    return None


# =========================================================
# COMPACT OVERPASS QUERY
# =========================================================

def build_overpass_query(
    lat: float,
    lng: float,
) -> str:
    """
    Query the same FireWatch contextual categories using
    compact nwr + regex selectors.

    nwr = node + way + relation.

    This significantly reduces query size compared with
    separately listing node/way/relation for every tag.
    """

    radius = SEARCH_RADIUS_METERS


    return f"""
[out:json][timeout:30];

(

  /* =====================================================
     INDUSTRIAL LAND
     ===================================================== */

  nwr(around:{radius},{lat},{lng})
    ["landuse"="industrial"];


  /* =====================================================
     ANY industrial=* TAG
     ===================================================== */

  nwr(around:{radius},{lat},{lng})
    ["industrial"];


  /* =====================================================
     INDUSTRIAL INFRASTRUCTURE
     ===================================================== */

  nwr(around:{radius},{lat},{lng})
    ["man_made"~"^(works|storage_tank|petroleum_well|silo|kiln|chimney)$"];


  /* =====================================================
     POWER INFRASTRUCTURE
     ===================================================== */

  nwr(around:{radius},{lat},{lng})
    ["power"~"^(plant|generator|substation)$"];


  /* =====================================================
     FUEL FACILITIES
     ===================================================== */

  nwr(around:{radius},{lat},{lng})
    ["amenity"="fuel"];


  /* =====================================================
     NATURAL / VEGETATION LANDUSE
     ===================================================== */

  nwr(around:{radius},{lat},{lng})
    ["landuse"~"^(forest|farmland|farmyard|orchard|vineyard|meadow|grass)$"];


  /* =====================================================
     NATURAL FEATURES
     ===================================================== */

  nwr(around:{radius},{lat},{lng})
    ["natural"~"^(wood|grass|grassland|scrub|heath)$"];


  /* =====================================================
     OTHER LAND CONTEXT
     ===================================================== */

  nwr(around:{radius},{lat},{lng})
    ["landuse"~"^(residential|commercial|retail)$"];


  /* =====================================================
     WATER / WETLAND / BARE CONTEXT
     ===================================================== */

  nwr(around:{radius},{lat},{lng})
    ["natural"~"^(water|wetland|sand|bare_rock|scree)$"];

);

out center tags;
"""


# =========================================================
# EMPTY CONTEXT
# =========================================================

def empty_context() -> dict[str, Any]:

    return {

        "landType":
            "Unknown",


        # =================================================
        # EXISTING FRONTEND FIELDS
        # =================================================

        "nearestIndustrialKm":
            None,

        "nearestFactoryKm":
            None,

        "nearestRefineryKm":
            None,

        "nearestPowerPlantKm":
            None,

        "nearestForestKm":
            None,

        "nearestAgricultureKm":
            None,


        # =================================================
        # GENERIC NATURAL DISTANCE
        # =================================================

        "nearestNaturalKm":
            None,


        # =================================================
        # V3 MODEL CONTEXT
        # =================================================

        "industrialWithin1_5Km":
            False,

        "naturalWithin1_5Km":
            False,


        # =================================================
        # NEAREST FEATURE
        # =================================================

        "nearestFeature":
            None,

        "nearestFeatureName":
            None,

        "nearestFeatureDistanceKm":
            None,


        "osmFeaturesFound":
            0,


        "lookupStatus":
            "success",

        "lookupMessage":
            None,
    }


# =========================================================
# PROCESS OSM ELEMENTS
# =========================================================

def process_osm_elements(
    lat: float,
    lng: float,
    elements: list[dict[str, Any]],
) -> dict[str, Any]:

    context = empty_context()


    nearest: dict[
        str,
        tuple[
            float,
            dict[str, Any],
        ],
    ] = {}


    matched_feature_count = 0


    # =====================================================
    # FIND NEAREST FEATURE PER CATEGORY
    # =====================================================

    for element in elements:

        tags = element.get(
            "tags",
            {},
        )


        if not isinstance(
            tags,
            dict,
        ):

            continue


        category = classify_osm_feature(
            tags
        )


        if not category:

            continue


        coordinates = get_element_coordinates(
            element
        )


        if not coordinates:

            continue


        element_lat, element_lng = (
            coordinates
        )


        distance = haversine_distance_km(
            lat,
            lng,
            element_lat,
            element_lng,
        )


        # Overpass around normally restricts this already,
        # but retain a real distance check.
        if (
            distance
            >
            (
                SEARCH_RADIUS_METERS
                /
                1000.0
            )
            +
            0.1
        ):

            continue


        matched_feature_count += 1


        current = nearest.get(
            category
        )


        if (
            current is None
            or
            distance
            <
            current[0]
        ):

            nearest[
                category
            ] = (
                distance,
                tags,
            )


    context[
        "osmFeaturesFound"
    ] = matched_feature_count


    # =====================================================
    # DISTANCE HELPER
    # =====================================================

    def distance_for(
        category: str,
    ) -> float | None:

        item = nearest.get(
            category
        )


        if not item:

            return None


        return round(
            item[0],
            3,
        )


    # =====================================================
    # SPECIFIC DISTANCES
    # =====================================================

    factory_distance = distance_for(
        "Factory"
    )


    refinery_distance = distance_for(
        "Refinery"
    )


    powerplant_distance = distance_for(
        "Power Plant"
    )


    forest_distance = distance_for(
        "Forest"
    )


    agriculture_distance = distance_for(
        "Agriculture"
    )


    context[
        "nearestFactoryKm"
    ] = factory_distance


    context[
        "nearestRefineryKm"
    ] = refinery_distance


    context[
        "nearestPowerPlantKm"
    ] = powerplant_distance


    context[
        "nearestForestKm"
    ] = forest_distance


    context[
        "nearestAgricultureKm"
    ] = agriculture_distance


    # =====================================================
    # INDUSTRIAL DISTANCE
    # =====================================================

    industrial_categories = [

        "Industrial",

        "Factory",

        "Refinery",

        "Power Plant",

        "Power Generator",

        "Power Substation",

        "Storage Tank",

        "Petroleum Well",

        "Silo",

        "Kiln",

        "Chimney",

        "Fuel Facility",
    ]


    industrial_distances = [

        nearest[
            category
        ][0]

        for category
        in industrial_categories

        if category
        in nearest
    ]


    if industrial_distances:

        nearest_industrial = min(
            industrial_distances
        )


        context[
            "nearestIndustrialKm"
        ] = round(
            nearest_industrial,
            3,
        )


        context[
            "industrialWithin1_5Km"
        ] = (
            nearest_industrial
            <=
            1.5
        )


    # =====================================================
    # NATURAL DISTANCE
    # =====================================================

    natural_categories = [

        "Forest",

        "Agriculture",

        "Grassland",

        "Scrub",
    ]


    natural_distances = [

        nearest[
            category
        ][0]

        for category
        in natural_categories

        if category
        in nearest
    ]


    if natural_distances:

        nearest_natural = min(
            natural_distances
        )


        context[
            "nearestNaturalKm"
        ] = round(
            nearest_natural,
            3,
        )


        context[
            "naturalWithin1_5Km"
        ] = (
            nearest_natural
            <=
            1.5
        )


    # =====================================================
    # NEAREST OVERALL FEATURE
    # =====================================================

    if nearest:

        category, item = min(
            nearest.items(),
            key=lambda pair:
                pair[1][0],
        )


        distance = item[0]

        tags = item[1]


        context[
            "nearestFeature"
        ] = category


        context[
            "nearestFeatureDistanceKm"
        ] = round(
            distance,
            3,
        )


        context[
            "nearestFeatureName"
        ] = (

            tags.get(
                "name"
            )

            or

            tags.get(
                "operator"
            )

            or

            tags.get(
                "brand"
            )
        )


    # =====================================================
    # PROXIMITY-DERIVED LAND TYPE
    # =====================================================
    #
    # This is NOT point-in-polygon containment.
    # =====================================================

    land_categories = [

        "Industrial",

        "Forest",

        "Agriculture",

        "Residential",

        "Commercial",

        "Grassland",

        "Scrub",

        "Water",

        "Wetland",

        "Bare Land",
    ]


    candidates: list[
        tuple[
            float,
            str,
        ]
    ] = []


    for category in land_categories:

        item = nearest.get(
            category
        )


        if item:

            candidates.append(
                (
                    item[0],
                    category,
                )
            )


    if candidates:

        distance, category = min(
            candidates,
            key=lambda item:
                item[0],
        )


        if distance <= 0.75:

            context[
                "landType"
            ] = category


    # =====================================================
    # INDUSTRIAL INFRASTRUCTURE OVERRIDE
    # =====================================================

    if (
        context[
            "landType"
        ]
        ==
        "Unknown"

        and

        context[
            "nearestIndustrialKm"
        ]
        is not None

        and

        context[
            "nearestIndustrialKm"
        ]
        <=
        0.5
    ):

        context[
            "landType"
        ] = "Industrial"


    return context


# =========================================================
# RETRY DELAY
# =========================================================

def retry_delay_seconds(
    attempt: int,
) -> float:

    return (
        RETRY_BASE_DELAY_SECONDS
        *
        attempt
    )


# =========================================================
# FETCH ONE OVERPASS ENDPOINT
# =========================================================

async def fetch_from_endpoint(
    client: httpx.AsyncClient,
    endpoint: str,
    query: str,
) -> list[dict[str, Any]]:

    last_error: Exception | None = None


    for attempt in range(
        1,
        MAX_RETRIES_PER_ENDPOINT + 1,
    ):

        try:

            logger.info(
                "Calling Overpass %s attempt %s/%s",
                endpoint,
                attempt,
                MAX_RETRIES_PER_ENDPOINT,
            )


            response = await client.post(

                endpoint,

                data={
                    "data":
                        query
                },
            )


            logger.info(
                "Overpass status %s from %s",
                response.status_code,
                endpoint,
            )


            # =================================================
            # RETRYABLE SERVER / RATE-LIMIT RESPONSE
            # =================================================

            if (
                response.status_code
                in
                RETRYABLE_STATUS_CODES
            ):

                last_error = RuntimeError(
                    f"Overpass returned "
                    f"{response.status_code}"
                )


                logger.warning(
                    "Retryable Overpass response %s "
                    "from %s",
                    response.status_code,
                    endpoint,
                )


                if (
                    attempt
                    <
                    MAX_RETRIES_PER_ENDPOINT
                ):

                    await asyncio.sleep(
                        retry_delay_seconds(
                            attempt
                        )
                    )


                continue


            response.raise_for_status()


            payload = response.json()


            elements = payload.get(
                "elements",
                [],
            )


            if not isinstance(
                elements,
                list,
            ):

                raise ValueError(
                    "Overpass response did not "
                    "contain an elements list"
                )


            logger.info(
                "Overpass returned %s elements from %s",
                len(
                    elements
                ),
                endpoint,
            )


            return elements


        except httpx.TimeoutException as exc:

            last_error = exc


            logger.warning(
                "Overpass timeout from %s "
                "attempt %s/%s",
                endpoint,
                attempt,
                MAX_RETRIES_PER_ENDPOINT,
            )


        except httpx.HTTPStatusError as exc:

            last_error = exc


            logger.warning(
                "Overpass HTTP error %s from %s",
                exc.response.status_code,
                endpoint,
            )


            # Non-retryable HTTP status.
            if (
                exc.response.status_code
                not in
                RETRYABLE_STATUS_CODES
            ):

                break


        except httpx.HTTPError as exc:

            last_error = exc


            logger.warning(
                "Overpass network error from %s: %s",
                endpoint,
                type(
                    exc
                ).__name__,
            )


        except ValueError as exc:

            last_error = exc


            logger.warning(
                "Invalid Overpass response from %s",
                endpoint,
            )


        # =================================================
        # RETRY WAIT FOR EXCEPTIONS
        # =================================================

        if (
            attempt
            <
            MAX_RETRIES_PER_ENDPOINT
        ):

            await asyncio.sleep(
                retry_delay_seconds(
                    attempt
                )
            )


    if last_error:

        raise RuntimeError(
            f"Overpass endpoint failed: {endpoint}"
        ) from last_error


    raise RuntimeError(
        f"Overpass endpoint failed: {endpoint}"
    )


# =========================================================
# FETCH OVERPASS
# =========================================================

async def fetch_overpass(
    query: str,
) -> list[dict[str, Any]]:
    """
    Try configured Overpass endpoints in order.

    A global lock ensures only one uncached FireWatch
    Overpass request is active at a time.
    """

    last_error: Exception | None = None


    async with _overpass_lock:

        async with httpx.AsyncClient(

            timeout=httpx.Timeout(
                REQUEST_TIMEOUT,
                connect=10.0,
            ),

            follow_redirects=True,

            headers={
                "User-Agent":
                    "FireWatchAI/1.0"
            },

        ) as client:


            for endpoint in OVERPASS_ENDPOINTS:

                try:

                    elements = await fetch_from_endpoint(

                        client=client,

                        endpoint=endpoint,

                        query=query,
                    )


                    # Small cooldown before another uncached
                    # location can acquire the global lock.
                    await asyncio.sleep(
                        OVERPASS_SUCCESS_COOLDOWN_SECONDS
                    )


                    return elements


                except RuntimeError as exc:

                    last_error = exc


                    logger.warning(
                        "Moving to next Overpass endpoint "
                        "after failure: %s",
                        endpoint,
                    )


                    # Brief pause before moving to mirror.
                    await asyncio.sleep(
                        1.0
                    )


    if last_error:

        raise RuntimeError(
            "OpenStreetMap context lookup "
            "is temporarily unavailable"
        ) from last_error


    raise RuntimeError(
        "No Overpass endpoint available"
    )


# =========================================================
# MAIN PUBLIC SERVICE
# =========================================================

async def get_osm_context(
    lat: float,
    lng: float,
) -> dict[str, Any]:

    # =====================================================
    # VALIDATE COORDINATES
    # =====================================================

    if not (
        -90
        <=
        lat
        <=
        90

        and

        -180
        <=
        lng
        <=
        180
    ):

        raise ValueError(
            "Invalid coordinates"
        )


    key = (
        round(
            lat,
            4,
        ),

        round(
            lng,
            4,
        ),
    )


    # =====================================================
    # CACHE CHECK
    # =====================================================

    cached = _cache.get(
        key
    )


    if (
        cached
        and
        cached.expires
        >
        time.monotonic()
    ):

        logger.info(
            "Using cached OSM context for %s",
            key,
        )


        return cached.value


    # =====================================================
    # PER-LOCATION LOCK
    # =====================================================

    lock = _locks.setdefault(
        key,
        asyncio.Lock(),
    )


    async with lock:

        # Re-check cache after acquiring lock.

        cached = _cache.get(
            key
        )


        if (
            cached
            and
            cached.expires
            >
            time.monotonic()
        ):

            return cached.value


        query = build_overpass_query(
            lat,
            lng,
        )


        try:

            elements = await fetch_overpass(
                query
            )


            context = process_osm_elements(
                lat,
                lng,
                elements,
            )


            logger.info(
                "Processed OSM context for %s: %s",
                key,
                context,
            )


            # =================================================
            # CACHE SUCCESS ONLY
            # =================================================

            _cache[
                key
            ] = CacheEntry(

                value=
                    context,

                expires=(
                    time.monotonic()
                    +
                    CACHE_TTL
                ),
            )


            return context


        except RuntimeError as exc:

            logger.warning(
                "OSM context unavailable for %.4f, %.4f",
                lat,
                lng,
            )


            # =================================================
            # DO NOT CACHE FAILURE
            # =================================================
            #
            # False context flags here mean "not available",
            # NOT verified absence. prediction.py checks
            # lookupStatus before using these values.
            # =================================================

            context = empty_context()


            context[
                "lookupStatus"
            ] = "unavailable"


            context[
                "lookupMessage"
            ] = str(
                exc
            )


            return context


# =========================================================
# COMPATIBILITY FUNCTION
# =========================================================

async def get_land_type(
    lat: float,
    lng: float,
) -> str:

    context = await get_osm_context(
        lat,
        lng,
    )


    return context.get(
        "landType",
        "Unknown",
    )