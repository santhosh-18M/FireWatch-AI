from __future__ import annotations

import asyncio
import csv
import io
import logging
import os
import time

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt
from typing import Any

import httpx

from services.database_service import (
    save_raw_firms_rows,
)


logger = logging.getLogger(__name__)


# =========================================================
# CONFIGURATION
# =========================================================

FIRMS_BASE_URL = (
    "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
)

FIRMS_SOURCE = os.getenv(
    "FIRMS_SOURCE",
    "VIIRS_NOAA21_NRT",
)

HISTORY_DAYS = 30

MAX_DAYS_PER_REQUEST = 5

MATCH_RADIUS_KM = 1.0

BBOX_PADDING_DEGREES = 0.03

REQUEST_TIMEOUT = 35.0

CACHE_TTL_SECONDS = (
    6 * 60 * 60
)


# =========================================================
# CACHE
# =========================================================

@dataclass
class CacheEntry:
    value: dict[str, Any]
    expires_at: float


_cache: dict[
    tuple[
        float,
        float,
        str,
    ],
    CacheEntry,
] = {}


_locks: dict[
    tuple[
        float,
        float,
        str,
    ],
    asyncio.Lock,
] = {}


# =========================================================
# FIRMS API KEY
# =========================================================

def get_map_key() -> str:

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
            "FIRMS_API_KEY is not configured"
        )

    return key


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
# REFERENCE DATETIME
# =========================================================

def parse_reference_datetime(
    value: str | date | datetime | None,
) -> datetime:
    """
    Return timezone-aware UTC datetime.

    Exact timestamps are preserved so the selected FIRMS
    observation is not counted as its own prior history.
    """

    if value is None:

        return datetime.now(
            timezone.utc
        )

    if isinstance(
        value,
        datetime,
    ):

        if value.tzinfo is None:

            return value.replace(
                tzinfo=timezone.utc
            )

        return value.astimezone(
            timezone.utc
        )

    if isinstance(
        value,
        date,
    ):

        return datetime(
            value.year,
            value.month,
            value.day,
            23,
            59,
            59,
            999999,
            tzinfo=timezone.utc,
        )

    text = str(
        value
    ).strip()

    if not text:

        raise ValueError(
            "reference_date cannot be empty"
        )

    # -----------------------------------------------------
    # ISO TIMESTAMP
    # -----------------------------------------------------

    if "T" in text:

        normalized = text.replace(
            "Z",
            "+00:00",
        )

        try:

            parsed = datetime.fromisoformat(
                normalized
            )

        except ValueError as exc:

            raise ValueError(
                "reference_date must be YYYY-MM-DD "
                "or an ISO timestamp"
            ) from exc

        if parsed.tzinfo is None:

            parsed = parsed.replace(
                tzinfo=timezone.utc
            )

        return parsed.astimezone(
            timezone.utc
        )

    # -----------------------------------------------------
    # DATE ONLY
    # -----------------------------------------------------

    try:

        parsed_date = datetime.strptime(
            text,
            "%Y-%m-%d",
        ).date()

    except ValueError as exc:

        raise ValueError(
            "reference_date must be YYYY-MM-DD "
            "or an ISO timestamp"
        ) from exc

    return datetime(
        parsed_date.year,
        parsed_date.month,
        parsed_date.day,
        23,
        59,
        59,
        999999,
        tzinfo=timezone.utc,
    )


# =========================================================
# FIRMS ROW DATETIME
# =========================================================

def parse_firms_timestamp(
    row: dict[str, Any],
) -> datetime | None:
    """
    FIRMS:
        acq_date = 2026-09-05
        acq_time = 737

    becomes:
        2026-09-05T07:37:00Z
    """

    acq_date = str(
        row.get(
            "acq_date"
        )
        or
        ""
    ).strip()

    if not acq_date:

        return None

    raw_time = str(
        row.get(
            "acq_time"
        )
        or
        ""
    ).strip()

    digits = "".join(
        character
        for character in raw_time
        if character.isdigit()
    )

    digits = digits.zfill(
        4
    )

    if len(
        digits
    ) > 4:

        digits = digits[
            -4:
        ]

    try:

        hour = int(
            digits[
                :2
            ]
        )

        minute = int(
            digits[
                2:
            ]
        )

        parsed_date = datetime.strptime(
            acq_date,
            "%Y-%m-%d",
        ).date()

        if not (
            0 <= hour <= 23
            and
            0 <= minute <= 59
        ):

            return None

        return datetime(
            parsed_date.year,
            parsed_date.month,
            parsed_date.day,
            hour,
            minute,
            tzinfo=timezone.utc,
        )

    except (
        TypeError,
        ValueError,
    ):

        return None


# =========================================================
# FIRMS BOUNDING BOX
# =========================================================

def build_bbox(
    lat: float,
    lng: float,
) -> str:

    west = (
        lng
        -
        BBOX_PADDING_DEGREES
    )

    south = (
        lat
        -
        BBOX_PADDING_DEGREES
    )

    east = (
        lng
        +
        BBOX_PADDING_DEGREES
    )

    north = (
        lat
        +
        BBOX_PADDING_DEGREES
    )

    return (
        f"{west:.5f},"
        f"{south:.5f},"
        f"{east:.5f},"
        f"{north:.5f}"
    )


# =========================================================
# HISTORICAL REQUEST CHUNKS
# =========================================================

def build_date_chunks(
    reference_date: date,
) -> list[
    tuple[
        date,
        int,
    ]
]:

    start_date = (
        reference_date
        -
        timedelta(
            days=
                HISTORY_DAYS
                -
                1
        )
    )

    chunks: list[
        tuple[
            date,
            int,
        ]
    ] = []

    consumed = 0

    while consumed < HISTORY_DAYS:

        remaining = (
            HISTORY_DAYS
            -
            consumed
        )

        chunk_size = min(
            MAX_DAYS_PER_REQUEST,
            remaining,
        )

        chunk_start = (
            start_date
            +
            timedelta(
                days=
                    consumed
            )
        )

        chunks.append(
            (
                chunk_start,
                chunk_size,
            )
        )

        consumed += (
            chunk_size
        )

    return chunks


# =========================================================
# CSV PARSING
# =========================================================

def parse_firms_csv(
    csv_text: str,
) -> list[
    dict[
        str,
        Any,
    ]
]:

    if not csv_text.strip():

        return []

    reader = csv.DictReader(
        io.StringIO(
            csv_text
        )
    )

    rows: list[
        dict[
            str,
            Any,
        ]
    ] = []

    for row in reader:

        try:

            latitude = float(
                row.get(
                    "latitude",
                    "",
                )
            )

            longitude = float(
                row.get(
                    "longitude",
                    "",
                )
            )

        except (
            TypeError,
            ValueError,
        ):

            continue

        acq_date = (
            row.get(
                "acq_date"
            )
            or
            ""
        ).strip()

        if not acq_date:

            continue

        rows.append(
            {
                **row,

                "latitude":
                    latitude,

                "longitude":
                    longitude,
            }
        )

    return rows


# =========================================================
# FETCH ONE FIRMS CHUNK
# =========================================================

async def fetch_firms_chunk(
    client: httpx.AsyncClient,
    map_key: str,
    bbox: str,
    start_date: date,
    day_range: int,
) -> list[
    dict[
        str,
        Any,
    ]
]:

    url = (
        f"{FIRMS_BASE_URL}/"
        f"{map_key}/"
        f"{FIRMS_SOURCE}/"
        f"{bbox}/"
        f"{day_range}/"
        f"{start_date.isoformat()}"
    )

    logger.info(
        "FIRMS persistence request: %s (%s days)",
        start_date.isoformat(),
        day_range,
    )

    response = await client.get(
        url
    )

    response.raise_for_status()

    return parse_firms_csv(
        response.text
    )


# =========================================================
# FETCH HISTORICAL FIRMS
# =========================================================

async def fetch_historical_firms(
    lat: float,
    lng: float,
    reference_date: date,
) -> list[
    dict[
        str,
        Any,
    ]
]:

    map_key = get_map_key()

    bbox = build_bbox(
        lat,
        lng,
    )

    chunks = build_date_chunks(
        reference_date
    )

    all_rows: list[
        dict[
            str,
            Any,
        ]
    ] = []

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

        for (
            chunk_start,
            chunk_days,
        ) in chunks:

            rows = await fetch_firms_chunk(

                client=client,

                map_key=map_key,

                bbox=bbox,

                start_date=
                    chunk_start,

                day_range=
                    chunk_days,
            )

            all_rows.extend(
                rows
            )

    return all_rows


# =========================================================
# SPATIAL + TEMPORAL MATCHING
# =========================================================

def match_nearby_detections(

    rows: list[
        dict[
            str,
            Any,
        ]
    ],

    target_lat: float,

    target_lng: float,

    reference_datetime: datetime,

) -> list[
    dict[
        str,
        Any,
    ]
]:
    """
    Match observations within 1 km and strictly BEFORE
    the selected hotspot acquisition timestamp.
    """

    window_start = (
        reference_datetime
        -
        timedelta(
            days=
                HISTORY_DAYS
        )
    )

    matched: list[
        dict[
            str,
            Any,
        ]
    ] = []

    for row in rows:

        row_datetime = parse_firms_timestamp(
            row
        )

        if row_datetime is None:

            continue

        # -------------------------------------------------
        # IMPORTANT:
        #
        # current timestamp is excluded
        # future observations are excluded
        # -------------------------------------------------

        if not (
            window_start
            <=
            row_datetime
            <
            reference_datetime
        ):

            continue

        distance = haversine_distance_km(

            target_lat,

            target_lng,

            float(
                row[
                    "latitude"
                ]
            ),

            float(
                row[
                    "longitude"
                ]
            ),
        )

        if (
            distance
            >
            MATCH_RADIUS_KM
        ):

            continue

        matched.append(
            {
                **row,

                "_datetime":
                    row_datetime,

                "_date":
                    row_datetime.date(),

                "_distance_km":
                    distance,
            }
        )

    return matched


# =========================================================
# WINDOW COUNTS
# =========================================================

def count_since(

    matched: list[
        dict[
            str,
            Any,
        ]
    ],

    reference_datetime: datetime,

    days: int,

) -> int:

    start = (
        reference_datetime
        -
        timedelta(
            days=
                days
        )
    )

    return sum(

        1

        for row in matched

        if (
            start
            <=
            row[
                "_datetime"
            ]
            <
            reference_datetime
        )
    )


# =========================================================

def distinct_days_since(

    matched: list[
        dict[
            str,
            Any,
        ]
    ],

    reference_datetime: datetime,

    days: int,

) -> int:

    start = (
        reference_datetime
        -
        timedelta(
            days=
                days
        )
    )

    active_dates = {

        row[
            "_datetime"
        ].date()

        for row in matched

        if (
            start
            <=
            row[
                "_datetime"
            ]
            <
            reference_datetime
        )
    }

    return len(
        active_dates
    )


# =========================================================
# ACTIVE DATE GAP ANALYSIS
# =========================================================

def calculate_date_gaps(
    active_dates: list[
        date
    ],
) -> dict[
    str,
    Any,
]:

    if (
        len(
            active_dates
        )
        <
        2
    ):

        return {
            "meanGapDays":
                None,

            "maxGapDays":
                None,

            "minGapDays":
                None,
        }

    gaps: list[
        int
    ] = []

    for i in range(
        1,
        len(
            active_dates
        ),
    ):

        gap = (
            active_dates[
                i
            ]
            -
            active_dates[
                i - 1
            ]
        ).days

        gaps.append(
            gap
        )

    return {
        "meanGapDays":
            round(
                sum(
                    gaps
                )
                /
                len(
                    gaps
                ),
                2,
            ),

        "maxGapDays":
            max(
                gaps
            ),

        "minGapDays":
            min(
                gaps
            ),
    }


# =========================================================
# ACTIVITY TYPE
# =========================================================

def determine_activity_type(
    distinct_active_days: int,
) -> tuple[
    str,
    str,
    bool,
]:

    if (
        distinct_active_days
        ==
        0
    ):

        return (
            "none",
            "No prior thermal activity found",
            False,
        )

    if (
        distinct_active_days
        ==
        1
    ):

        return (
            "single",
            "Single-date prior thermal activity",
            False,
        )

    return (
        "repeated",
        "Repeated prior thermal activity",
        True,
    )


# =========================================================
# PERSISTENCE FEATURE ENGINEERING
# =========================================================

def calculate_persistence(

    matched: list[
        dict[
            str,
            Any,
        ]
    ],

    reference_datetime: datetime,

) -> dict[
    str,
    Any,
]:

    # =====================================================
    # DETECTION COUNTS
    # =====================================================

    detections_3d = count_since(
        matched,
        reference_datetime,
        3,
    )

    detections_7d = count_since(
        matched,
        reference_datetime,
        7,
    )

    detections_10d = count_since(
        matched,
        reference_datetime,
        10,
    )

    detections_30d = count_since(
        matched,
        reference_datetime,
        30,
    )


    # =====================================================
    # DISTINCT ACTIVE DAYS
    # =====================================================

    active_days_3d = distinct_days_since(
        matched,
        reference_datetime,
        3,
    )

    active_days_7d = distinct_days_since(
        matched,
        reference_datetime,
        7,
    )

    active_days_10d = distinct_days_since(
        matched,
        reference_datetime,
        10,
    )

    active_days_30d = distinct_days_since(
        matched,
        reference_datetime,
        30,
    )


    # =====================================================
    # UNIQUE ACTIVE DATES
    # =====================================================

    active_dates = sorted(
        {
            row[
                "_date"
            ]
            for row in matched
        }
    )


    first_observed = (
        active_dates[
            0
        ]
        if active_dates
        else None
    )


    latest_observed = (
        active_dates[
            -1
        ]
        if active_dates
        else None
    )


    # =====================================================
    # OBSERVATION SPAN
    # =====================================================

    if (
        first_observed
        and
        latest_observed
    ):

        observation_span_days = (
            latest_observed
            -
            first_observed
        ).days + 1

    else:

        observation_span_days = 0


    # =====================================================
    # ACTIVE DAY FRACTION
    # =====================================================

    active_day_fraction_30d = (
        active_days_30d
        /
        HISTORY_DAYS
    )


    # =====================================================
    # GEOGRAPHIC CONSISTENCY
    # =====================================================

    distances = [

        float(
            row[
                "_distance_km"
            ]
        )

        for row in matched
    ]


    mean_distance_m = (

        round(

            (
                sum(
                    distances
                )
                /
                len(
                    distances
                )
            )
            *
            1000,

            1,
        )

        if distances

        else None
    )


    max_distance_m = (

        round(
            max(
                distances
            )
            *
            1000,
            1,
        )

        if distances

        else None
    )


    # =====================================================
    # TEMPORAL GAPS
    # =====================================================

    gap_stats = calculate_date_gaps(
        active_dates
    )


    # =====================================================
    # ACTIVITY TYPE
    # =====================================================

    (
        activity_type,
        activity_status,
        repeat_activity,
    ) = determine_activity_type(
        active_days_30d
    )


    # =====================================================
    # HUMAN READABLE SUMMARY
    # =====================================================

    if (
        activity_type
        ==
        "repeated"
    ):

        message = (
            f"Prior thermal activity was observed on "
            f"{active_days_30d} distinct dates "
            f"across a "
            f"{observation_span_days}-day period."
        )

    elif (
        activity_type
        ==
        "single"
    ):

        message = (
            "One prior matching FIRMS thermal observation "
            "was found before the selected hotspot."
        )

    else:

        message = (
            "No prior matching FIRMS thermal observations "
            "were found before the selected hotspot "
            "within the 30-day search window."
        )


    # =====================================================
    # RESULT
    # =====================================================

    return {

        "features": {

            "detections3d":
                detections_3d,

            "detections7d":
                detections_7d,

            "detections10d":
                detections_10d,

            "detections30d":
                detections_30d,


            "distinctActiveDays3d":
                active_days_3d,

            "distinctActiveDays7d":
                active_days_7d,

            "distinctActiveDays10d":
                active_days_10d,

            "distinctActiveDays30d":
                active_days_30d,


            "observationSpanDays":
                observation_span_days,


            "activeDayFraction30d":
                round(
                    active_day_fraction_30d,
                    4,
                ),


            "meanDetectionDistanceM":
                mean_distance_m,


            "maxDetectionDistanceM":
                max_distance_m,


            "meanGapDays":
                gap_stats[
                    "meanGapDays"
                ],


            "maxGapDays":
                gap_stats[
                    "maxGapDays"
                ],


            "minGapDays":
                gap_stats[
                    "minGapDays"
                ],
        },


        "summary": {

            "activityType":
                activity_type,


            "repeatActivity":
                repeat_activity,


            "status":
                activity_status,


            "distinctActiveDays":
                active_days_30d,


            "observationSpanDays":
                observation_span_days,


            "firstObserved":
                (
                    first_observed.isoformat()

                    if first_observed

                    else None
                ),


            "latestObserved":
                (
                    latest_observed.isoformat()

                    if latest_observed

                    else None
                ),


            "message":
                message,
        },
    }


# =========================================================
# MAIN SERVICE
# =========================================================

async def get_persistence_analysis(

    lat: float,

    lng: float,

    reference_date:
        str
        |
        date
        |
        datetime
        |
        None
        =
        None,

) -> dict[
    str,
    Any,
]:

    # =====================================================
    # VALIDATION
    # =====================================================

    if not (
        -90
        <=
        lat
        <=
        90
    ):

        raise ValueError(
            "Invalid latitude"
        )


    if not (
        -180
        <=
        lng
        <=
        180
    ):

        raise ValueError(
            "Invalid longitude"
        )


    # =====================================================
    # EXACT REFERENCE TIMESTAMP
    # =====================================================

    ref_datetime = parse_reference_datetime(
        reference_date
    )

    ref_date = (
        ref_datetime.date()
    )


    # =====================================================
    # CACHE KEY
    # =====================================================
    #
    # Exact time matters.
    #
    # Two observations at the same location on the same
    # date may have different prior-history counts.
    # =====================================================

    cache_key = (

        round(
            lat,
            4,
        ),

        round(
            lng,
            4,
        ),

        ref_datetime.isoformat(),
    )


    # =====================================================
    # CACHE CHECK
    # =====================================================

    cached = _cache.get(
        cache_key
    )

    if (
        cached
        and
        cached.expires_at
        >
        time.monotonic()
    ):

        return cached.value


    # =====================================================
    # REQUEST LOCK
    # =====================================================

    lock = _locks.setdefault(
        cache_key,
        asyncio.Lock(),
    )


    async with lock:

        cached = _cache.get(
            cache_key
        )

        if (
            cached
            and
            cached.expires_at
            >
            time.monotonic()
        ):

            return cached.value


        # =================================================
        # REAL NASA FIRMS HISTORY
        # =================================================

        raw_rows = (
            await fetch_historical_firms(

                lat=lat,

                lng=lng,

                reference_date=
                    ref_date,
            )
        )


        # =================================================
        # STORE ALL REAL DOWNLOADED FIRMS ROWS
        # =================================================
        #
        # Storage remains complete.
        #
        # Only the ML/history feature calculation is
        # filtered to observations before the selected
        # hotspot timestamp.
        # =================================================

        historical_rows_stored = (
            save_raw_firms_rows(

                raw_rows=
                    raw_rows,

                source_product=
                    FIRMS_SOURCE,
            )
        )


        # =================================================
        # PRIOR OBSERVATIONS ONLY
        # =================================================

        matched = match_nearby_detections(

            rows=
                raw_rows,

            target_lat=
                lat,

            target_lng=
                lng,

            reference_datetime=
                ref_datetime,
        )


        # =================================================
        # PRIOR-ONLY FEATURE ENGINEERING
        # =================================================

        persistence = calculate_persistence(

            matched,

            ref_datetime,
        )


        # =================================================
        # REQUEST WINDOW
        # =================================================

        requested_start = (
            ref_date
            -
            timedelta(
                days=
                    HISTORY_DAYS
                    -
                    1
            )
        )


        # =================================================
        # RESULT
        # =================================================

        result = {

            "lat":
                lat,


            "lng":
                lng,


            "referenceDate":
                (
                    ref_datetime
                    .isoformat()
                    .replace(
                        "+00:00",
                        "Z",
                    )
                ),


            "requestedHistoryDays":
                HISTORY_DAYS,


            "requestedFrom":
                requested_start.isoformat(),


            "requestedTo":
                ref_date.isoformat(),


            "matchRadiusKm":
                MATCH_RADIUS_KM,


            "source":
                "NASA FIRMS",


            "firmsProduct":
                FIRMS_SOURCE,


            "method":
                (
                    "Historical NASA FIRMS "
                    "spatial-temporal matching using "
                    "prior observations only"
                ),


            "historicalRecordsDownloaded":
                len(
                    raw_rows
                ),


            "historicalRecordsStored":
                historical_rows_stored,


            "matchingDetections":
                len(
                    matched
                ),


            # Explicit signal used by the classifier/UI.
            "currentObservationExcluded":
                True,


            **persistence,
        }


        # =================================================
        # CACHE SUCCESSFUL RESULT
        # =================================================

        _cache[
            cache_key
        ] = CacheEntry(

            value=
                result,

            expires_at=(
                time.monotonic()
                +
                CACHE_TTL_SECONDS
            ),
        )


        return result