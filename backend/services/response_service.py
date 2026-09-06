import asyncio
import logging
import time
from typing import Any

import httpx

from services.osm_service import (
    get_element_coordinates,
    haversine_distance_km,
)


logger = logging.getLogger(__name__)


# ==========================================================
# CONFIGURATION
# ==========================================================

# Emergency-response search radius.
# 40 km is used so rural hotspots are not too easily left
# without a mapped response point.
SEARCH_RADIUS_METERS = 40000

CACHE_TTL = 3600

REQUEST_TIMEOUT = 40.0


# Try another Overpass server if the main one is unavailable.
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


# ==========================================================
# CACHE
# ==========================================================

_response_cache: dict[
    str,
    tuple[float, dict[str, Any]]
] = {}

_response_locks: dict[
    str,
    asyncio.Lock
] = {}


def _cache_key(
    lat: float,
    lng: float,
) -> str:
    return f"{lat:.4f},{lng:.4f}"


# ==========================================================
# BASE RESPONSE
# ==========================================================

def empty_response(
    lat: float,
    lng: float,
) -> dict[str, Any]:

    return {
        "lat": lat,
        "lng": lng,

        "nearestFireStation": None,
        "nearestPoliceStation": None,
        "nearestHospital": None,

        "suggestedResponsePoint": None,

        "navigation": {
            "destinationLat": lat,
            "destinationLng": lng,
            "googleMapsUrl": (
                "https://www.google.com/maps/search/"
                f"?api=1&query={lat},{lng}"
            ),
        },

        "source": "OpenStreetMap",

        "searchRadiusKm": (
            SEARCH_RADIUS_METERS / 1000
        ),

        "facilitiesFound": 0,

        # Important:
        # success      = OSM responded correctly
        # unavailable  = OSM request failed
        "lookupStatus": "success",

        "lookupMessage": None,
    }


# ==========================================================
# OVERPASS QUERY
# ==========================================================

def build_query(
    lat: float,
    lng: float,
) -> str:

    radius = SEARCH_RADIUS_METERS

    return f"""
[out:json][timeout:35];

(
  node["amenity"="fire_station"]
    (around:{radius},{lat},{lng});

  way["amenity"="fire_station"]
    (around:{radius},{lat},{lng});

  relation["amenity"="fire_station"]
    (around:{radius},{lat},{lng});


  node["amenity"="police"]
    (around:{radius},{lat},{lng});

  way["amenity"="police"]
    (around:{radius},{lat},{lng});

  relation["amenity"="police"]
    (around:{radius},{lat},{lng});


  node["amenity"="hospital"]
    (around:{radius},{lat},{lng});

  way["amenity"="hospital"]
    (around:{radius},{lat},{lng});

  relation["amenity"="hospital"]
    (around:{radius},{lat},{lng});
);

out center tags;
"""


# ==========================================================
# FACILITY CLASSIFICATION
# ==========================================================

def classify_facility(
    tags: dict[str, Any],
) -> str | None:

    amenity = str(
        tags.get(
            "amenity",
            "",
        )
    ).lower()

    if amenity == "fire_station":
        return "Fire Station"

    if amenity == "police":
        return "Police Station"

    if amenity == "hospital":
        return "Hospital"

    return None


# ==========================================================
# FACILITY NAME
# ==========================================================

def get_facility_name(
    tags: dict[str, Any],
    facility_type: str,
) -> str:

    name = (
        tags.get("name")
        or tags.get("name:en")
        or tags.get("operator")
        or tags.get("brand")
    )

    if name:
        return str(name)

    return f"Unnamed mapped {facility_type.lower()}"


# ==========================================================
# CREATE FACILITY
# ==========================================================

def create_facility(
    element: dict[str, Any],
    facility_type: str,
    hotspot_lat: float,
    hotspot_lng: float,
) -> dict[str, Any] | None:

    coordinates = get_element_coordinates(
        element
    )

    if coordinates is None:
        return None

    facility_lat, facility_lng = (
        coordinates
    )

    distance = haversine_distance_km(
        hotspot_lat,
        hotspot_lng,
        facility_lat,
        facility_lng,
    )

    tags = element.get(
        "tags",
        {},
    )

    return {
        "name": get_facility_name(
            tags,
            facility_type,
        ),

        "type": facility_type,

        "distanceKm": round(
            distance,
            2,
        ),

        "lat": facility_lat,
        "lng": facility_lng,

        "osmId": element.get("id"),
        "osmType": element.get("type"),

        "phone": (
            tags.get("phone")
            or tags.get("contact:phone")
        ),

        "emergencyPhone": (
            tags.get("emergency:phone")
        ),

        "website": (
            tags.get("website")
            or tags.get("contact:website")
        ),

        "source": "OpenStreetMap",
    }


# ==========================================================
# PROCESS RESULTS
# ==========================================================

def process_elements(
    elements: list[dict[str, Any]],
    lat: float,
    lng: float,
) -> dict[str, Any]:

    fire_stations: list[
        dict[str, Any]
    ] = []

    police_stations: list[
        dict[str, Any]
    ] = []

    hospitals: list[
        dict[str, Any]
    ] = []


    for element in elements:

        tags = element.get(
            "tags",
            {},
        )

        facility_type = (
            classify_facility(
                tags
            )
        )

        if facility_type is None:
            continue

        facility = create_facility(
            element,
            facility_type,
            lat,
            lng,
        )

        if facility is None:
            continue

        if (
            facility_type
            == "Fire Station"
        ):
            fire_stations.append(
                facility
            )

        elif (
            facility_type
            == "Police Station"
        ):
            police_stations.append(
                facility
            )

        elif (
            facility_type
            == "Hospital"
        ):
            hospitals.append(
                facility
            )


    # ======================================================
    # SORT BY STRAIGHT-LINE DISTANCE
    # ======================================================

    fire_stations.sort(
        key=lambda item:
            item["distanceKm"]
    )

    police_stations.sort(
        key=lambda item:
            item["distanceKm"]
    )

    hospitals.sort(
        key=lambda item:
            item["distanceKm"]
    )


    nearest_fire_station = (
        fire_stations[0]
        if fire_stations
        else None
    )

    nearest_police_station = (
        police_stations[0]
        if police_stations
        else None
    )

    nearest_hospital = (
        hospitals[0]
        if hospitals
        else None
    )


    # ======================================================
    # RESPONSE PRIORITY
    #
    # 1. Fire Station
    # 2. Police Station
    # 3. Hospital
    # ======================================================

    suggested_response_point = (
        nearest_fire_station
        or nearest_police_station
        or nearest_hospital
    )


    result = empty_response(
        lat,
        lng,
    )


    result["nearestFireStation"] = (
        nearest_fire_station
    )

    result["nearestPoliceStation"] = (
        nearest_police_station
    )

    result["nearestHospital"] = (
        nearest_hospital
    )

    result[
        "suggestedResponsePoint"
    ] = suggested_response_point


    result["facilitiesFound"] = (
        len(fire_stations)
        + len(police_stations)
        + len(hospitals)
    )


    # ======================================================
    # GOOGLE MAPS ROUTING
    #
    # Origin:
    # selected response facility
    #
    # Destination:
    # exact FIRMS hotspot coordinate
    # ======================================================

    if suggested_response_point:

        origin_lat = (
            suggested_response_point[
                "lat"
            ]
        )

        origin_lng = (
            suggested_response_point[
                "lng"
            ]
        )


        result[
            "navigation"
        ] = {
            "originLat": origin_lat,

            "originLng": origin_lng,

            "destinationLat": lat,

            "destinationLng": lng,

            "googleMapsUrl": (
                "https://www.google.com/maps/dir/"
                "?api=1"
                f"&origin={origin_lat},{origin_lng}"
                f"&destination={lat},{lng}"
                "&travelmode=driving"
            ),
        }


    return result


# ==========================================================
# CALL OVERPASS
# ==========================================================

async def fetch_overpass(
    query: str,
) -> list[dict[str, Any]]:

    last_error: Exception | None = None


    for endpoint in OVERPASS_ENDPOINTS:

        try:

            logger.info(
                "Response lookup using %s",
                endpoint,
            )


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

                response = await client.post(
                    endpoint,
                    data={
                        "data": query
                    },
                )


                logger.info(
                    "Overpass response status: %s",
                    response.status_code,
                )


                response.raise_for_status()


                payload = (
                    response.json()
                )


                elements = (
                    payload.get(
                        "elements",
                        [],
                    )
                )


                logger.info(
                    "Emergency facility lookup "
                    "returned %s elements",
                    len(elements),
                )


                return elements


        except (
            httpx.TimeoutException,
            httpx.HTTPError,
            ValueError,
        ) as exc:

            last_error = exc

            logger.warning(
                "Overpass endpoint failed: %s",
                endpoint,
            )


    if last_error:
        raise RuntimeError(
            "OpenStreetMap emergency "
            "facility lookup is temporarily unavailable"
        ) from last_error


    raise RuntimeError(
        "No Overpass endpoint available"
    )


# ==========================================================
# MAIN PUBLIC FUNCTION
# ==========================================================

async def get_incident_response(
    lat: float,
    lng: float,
) -> dict[str, Any]:

    if not -90 <= lat <= 90:
        raise ValueError(
            "Invalid latitude"
        )

    if not -180 <= lng <= 180:
        raise ValueError(
            "Invalid longitude"
        )


    key = _cache_key(
        lat,
        lng,
    )


    # ======================================================
    # CACHE CHECK
    # ======================================================

    cached = (
        _response_cache.get(
            key
        )
    )


    if cached:

        cached_time, cached_data = (
            cached
        )

        if (
            time.time()
            - cached_time
            < CACHE_TTL
        ):
            return cached_data


    lock = (
        _response_locks.setdefault(
            key,
            asyncio.Lock(),
        )
    )


    async with lock:

        # Re-check after lock
        cached = (
            _response_cache.get(
                key
            )
        )


        if cached:

            cached_time, cached_data = (
                cached
            )

            if (
                time.time()
                - cached_time
                < CACHE_TTL
            ):
                return cached_data


        query = build_query(
            lat,
            lng,
        )


        try:

            elements = (
                await fetch_overpass(
                    query
                )
            )


            result = (
                process_elements(
                    elements,
                    lat,
                    lng,
                )
            )


            # =================================================
            # IMPORTANT
            #
            # Cache only a SUCCESSFUL OSM response.
            #
            # Even if zero facilities were returned,
            # the query itself successfully completed.
            # =================================================

            _response_cache[
                key
            ] = (
                time.time(),
                result,
            )


            return result


        except RuntimeError as exc:

            logger.warning(
                "Emergency facility lookup "
                "unavailable for %.4f, %.4f",
                lat,
                lng,
            )


            # =================================================
            # DO NOT CACHE THIS FAILURE
            # =================================================

            result = empty_response(
                lat,
                lng,
            )

            result[
                "lookupStatus"
            ] = "unavailable"

            result[
                "lookupMessage"
            ] = str(exc)

            return result