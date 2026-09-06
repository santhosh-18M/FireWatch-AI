from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass

import httpx


logger = logging.getLogger(__name__)

CACHE_TTL = 86400


@dataclass
class LocationInfo:
    state: str | None
    district: str | None
    city: str | None
    country: str | None
    display_name: str | None


@dataclass
class CacheEntry:
    value: LocationInfo
    expires: float


_cache: dict[
    tuple[float, float],
    CacheEntry
] = {}

_locks: dict[
    tuple[float, float],
    asyncio.Lock
] = {}


def extract_location(payload: dict) -> LocationInfo:
    """
    Extract readable location information
    from an OSM Nominatim reverse-geocode response.
    """

    address = payload.get("address", {})

    city = (
        address.get("city")
        or address.get("town")
        or address.get("village")
        or address.get("municipality")
        or address.get("suburb")
    )

    district = (
        address.get("state_district")
        or address.get("county")
        or address.get("district")
    )

    return LocationInfo(
        state=address.get("state"),
        district=district,
        city=city,
        country=address.get("country"),
        display_name=payload.get("display_name"),
    )


async def reverse_geocode(
    lat: float,
    lng: float,
) -> LocationInfo:
    """
    Reverse geocode latitude/longitude using
    OpenStreetMap Nominatim.

    Returns:
    - state
    - district
    - city
    - country
    - display name
    """

    if not (
        -90 <= lat <= 90
        and -180 <= lng <= 180
    ):
        raise ValueError("Invalid coordinates")

    key = (
        round(lat, 4),
        round(lng, 4),
    )

    # Check cache first
    cached = _cache.get(key)

    if (
        cached
        and cached.expires > time.monotonic()
    ):
        return cached.value

    # Prevent duplicate simultaneous requests
    lock = _locks.setdefault(
        key,
        asyncio.Lock()
    )

    async with lock:

        cached = _cache.get(key)

        if (
            cached
            and cached.expires > time.monotonic()
        ):
            return cached.value

        try:
            async with httpx.AsyncClient(
                timeout=15,
                follow_redirects=True,
                headers={
                    "User-Agent":
                        "FireWatchAI/1.0"
                },
            ) as client:

                response = await client.get(
                    "https://nominatim.openstreetmap.org/reverse",
                    params={
                        "lat": lat,
                        "lon": lng,
                        "format": "jsonv2",
                        "addressdetails": 1,
                    },
                )

                response.raise_for_status()

                payload = response.json()

                location = extract_location(
                    payload
                )

                _cache[key] = CacheEntry(
                    value=location,
                    expires=(
                        time.monotonic()
                        + CACHE_TTL
                    ),
                )

                logger.info(
                    "Reverse geocode %s -> %s",
                    key,
                    location.display_name,
                )

                return location

        except Exception as exc:

            logger.warning(
                "Reverse geocode failed for %s,%s: %s",
                lat,
                lng,
                exc,
            )

            return LocationInfo(
                state=None,
                district=None,
                city=None,
                country=None,
                display_name=None,
            )