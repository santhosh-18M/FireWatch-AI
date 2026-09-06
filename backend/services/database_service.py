import hashlib
import sqlite3

from datetime import datetime, timedelta
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
from typing import Any

# =========================================================
# DATABASE LOCATION
# =========================================================

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

DATA_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

DB_PATH = DATA_DIR / "firewatch.db"


# =========================================================
# CONNECTION
# =========================================================

def get_connection():

    connection = sqlite3.connect(
        DB_PATH,
        timeout=30,
    )

    connection.row_factory = sqlite3.Row

    connection.execute(
        "PRAGMA journal_mode=WAL"
    )

    connection.execute(
        "PRAGMA foreign_keys=ON"
    )

    return connection


# =========================================================
# DATABASE MIGRATION HELPER
# =========================================================

def ensure_column(
    connection,
    table_name: str,
    column_name: str,
    definition: str,
):
    """
    Add a column only if it does not already exist.

    This allows us to upgrade an existing database
    without deleting previously stored observations.
    """

    columns = connection.execute(
        f"PRAGMA table_info({table_name})"
    ).fetchall()

    existing_columns = {
        row["name"]
        for row in columns
    }

    if column_name not in existing_columns:

        connection.execute(
            f"""
            ALTER TABLE {table_name}
            ADD COLUMN {column_name} {definition}
            """
        )


# =========================================================
# INITIALIZE DATABASE
# =========================================================

def init_database():

    with get_connection() as connection:

        # -------------------------------------------------
        # FIRMS OBSERVATIONS
        # -------------------------------------------------

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS firms_observations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,

                hotspot_id TEXT NOT NULL UNIQUE,

                source_product TEXT,

                satellite TEXT,

                latitude REAL NOT NULL,

                longitude REAL NOT NULL,

                brightness REAL,

                frp REAL,

                confidence REAL,

                nearby_hotspots INTEGER,

                risk_score REAL,

                risk_level TEXT,

                acquired_at TEXT NOT NULL,

                land_type TEXT,

                fire_type TEXT,

                first_seen_at TEXT
                    DEFAULT CURRENT_TIMESTAMP,

                last_seen_at TEXT
                    DEFAULT CURRENT_TIMESTAMP
            )
            """
        )


        # =================================================
        # SCHEMA UPGRADE
        # =================================================
        #
        # These fields are retained directly from NASA FIRMS
        # because they may later be useful to the ML model.
        # Existing records remain untouched.
        # =================================================

        ensure_column(
            connection,
            "firms_observations",
            "bright_ti5",
            "REAL",
        )

        ensure_column(
            connection,
            "firms_observations",
            "scan",
            "REAL",
        )

        ensure_column(
            connection,
            "firms_observations",
            "track",
            "REAL",
        )

        ensure_column(
            connection,
            "firms_observations",
            "instrument",
            "TEXT",
        )

        ensure_column(
            connection,
            "firms_observations",
            "daynight",
            "TEXT",
        )

        ensure_column(
            connection,
            "firms_observations",
            "version",
            "TEXT",
        )

        ensure_column(
            connection,
            "firms_observations",
            "raw_confidence",
            "TEXT",
        )


        # -------------------------------------------------
        # NORMAL INDEXES
        # -------------------------------------------------

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_firms_acquired_at
            ON firms_observations(acquired_at)
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_firms_risk_level
            ON firms_observations(risk_level)
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_firms_satellite
            ON firms_observations(satellite)
            """
        )


        # -------------------------------------------------
        # R-TREE SPATIAL INDEX
        # -------------------------------------------------

        try:

            connection.execute(
                """
                CREATE VIRTUAL TABLE
                IF NOT EXISTS firms_observations_rtree

                USING rtree(
                    id,
                    min_lng,
                    max_lng,
                    min_lat,
                    max_lat
                )
                """
            )

        except sqlite3.OperationalError:
            pass


        connection.commit()


# =========================================================
# SAVE FIRMS OBSERVATIONS
# =========================================================

def save_firms_observations(
    observations: list[dict[str, Any]],
    source_product: str,
    raw_rows: list[dict[str, Any]] | None = None,
):
    """
    Save normalized FireWatch observations while also
    preserving useful raw FIRMS fields.

    Existing rows are updated rather than duplicated.
    """

    if not observations:
        return 0


    if raw_rows is None:
        raw_rows = []


    saved = 0


    with get_connection() as connection:

        for index, hotspot in enumerate(
            observations
        ):

            hotspot_id = hotspot.get(
                "id"
            )

            if not hotspot_id:
                continue


            lat = float(
                hotspot["lat"]
            )

            lng = float(
                hotspot["lng"]
            )


            # ---------------------------------------------
            # MATCH RAW FIRMS ROW
            # ---------------------------------------------

            raw = {}

            if index < len(
                raw_rows
            ):
                raw = raw_rows[index]


            # ---------------------------------------------
            # RAW VALUES
            # ---------------------------------------------

            bright_ti5 = _optional_float(
                raw.get(
                    "bright_ti5"
                )
            )

            scan = _optional_float(
                raw.get(
                    "scan"
                )
            )

            track = _optional_float(
                raw.get(
                    "track"
                )
            )

            instrument = _optional_text(
                raw.get(
                    "instrument"
                )
            )

            daynight = _optional_text(
                raw.get(
                    "daynight"
                )
            )

            version = _optional_text(
                raw.get(
                    "version"
                )
            )

            raw_confidence = _optional_text(
                raw.get(
                    "confidence"
                )
            )


            # ---------------------------------------------
            # INSERT / UPDATE
            # ---------------------------------------------

            connection.execute(
                """
                INSERT INTO firms_observations (

                    hotspot_id,
                    source_product,
                    satellite,

                    latitude,
                    longitude,

                    brightness,
                    bright_ti5,

                    frp,

                    confidence,
                    raw_confidence,

                    scan,
                    track,

                    instrument,
                    daynight,
                    version,

                    nearby_hotspots,

                    risk_score,
                    risk_level,

                    acquired_at,

                    land_type,
                    fire_type

                )

                VALUES (
                    ?, ?, ?,
                    ?, ?,
                    ?, ?,
                    ?,
                    ?, ?,
                    ?, ?,
                    ?, ?, ?,
                    ?,
                    ?, ?,
                    ?,
                    ?, ?
                )

                ON CONFLICT(hotspot_id)
                DO UPDATE SET

                    source_product =
                        excluded.source_product,

                    satellite =
                        excluded.satellite,

                    latitude =
                        excluded.latitude,

                    longitude =
                        excluded.longitude,

                    brightness =
                        excluded.brightness,

                    bright_ti5 =
                        excluded.bright_ti5,

                    frp =
                        excluded.frp,

                    confidence =
                        excluded.confidence,

                    raw_confidence =
                        excluded.raw_confidence,

                    scan =
                        excluded.scan,

                    track =
                        excluded.track,

                    instrument =
                        excluded.instrument,

                    daynight =
                        excluded.daynight,

                    version =
                        excluded.version,

                    nearby_hotspots =
                        excluded.nearby_hotspots,

                    risk_score =
                        excluded.risk_score,

                    risk_level =
                        excluded.risk_level,

                    land_type =
                        excluded.land_type,

                    fire_type =
                        excluded.fire_type,

                    last_seen_at =
                        CURRENT_TIMESTAMP
                """,

                (
                    hotspot_id,

                    source_product,

                    hotspot.get(
                        "satellite"
                    ),

                    lat,

                    lng,

                    hotspot.get(
                        "brightness"
                    ),

                    bright_ti5,

                    hotspot.get(
                        "frp"
                    ),

                    hotspot.get(
                        "confidence"
                    ),

                    raw_confidence,

                    scan,

                    track,

                    instrument,

                    daynight,

                    version,

                    hotspot.get(
                        "nearbyHotspots",
                        0,
                    ),

                    hotspot.get(
                        "riskScore"
                    ),

                    hotspot.get(
                        "riskLevel"
                    ),

                    hotspot.get(
                        "acquiredAt"
                    ),

                    hotspot.get(
                        "landType"
                    ),

                    hotspot.get(
                        "fireType"
                    ),
                ),
            )


            # ---------------------------------------------
            # GET DATABASE ID
            # ---------------------------------------------

            row = connection.execute(
                """
                SELECT id

                FROM firms_observations

                WHERE hotspot_id = ?
                """,

                (
                    hotspot_id,
                ),
            ).fetchone()


            if not row:
                continue


            database_id = int(
                row["id"]
            )


            # ---------------------------------------------
            # SPATIAL INDEX
            # ---------------------------------------------

            try:

                connection.execute(
                    """
                    INSERT OR REPLACE
                    INTO firms_observations_rtree (

                        id,
                        min_lng,
                        max_lng,
                        min_lat,
                        max_lat

                    )

                    VALUES (?, ?, ?, ?, ?)
                    """,

                    (
                        database_id,

                        lng,
                        lng,

                        lat,
                        lat,
                    ),
                )

            except sqlite3.OperationalError:
                pass


            saved += 1


        connection.commit()


    return saved

# =========================================================
# SAVE RAW HISTORICAL FIRMS OBSERVATIONS
# =========================================================

def save_raw_firms_rows(
    raw_rows: list[dict[str, Any]],
    source_product: str,
):
    """
    Persist raw NASA FIRMS observations directly.

    This is used for historical FIRMS observations that
    have not gone through the normal FireWatch live-risk
    pipeline.

    Important:
    - No fake risk score is generated.
    - No fake risk level is generated.
    - No land/fire classification is generated.
    - Existing observations are deduplicated using the
      same stable hotspot ID format as the live feed.
    """

    if not raw_rows:
        return 0


    saved = 0


    with get_connection() as connection:

        for raw in raw_rows:

            # =================================================
            # REQUIRED COORDINATES
            # =================================================

            try:

                lat = float(
                    raw.get(
                        "latitude"
                    )
                )

                lng = float(
                    raw.get(
                        "longitude"
                    )
                )

            except (
                TypeError,
                ValueError,
            ):

                continue


            # =================================================
            # ACQUISITION DATE / TIME
            # =================================================

            acq_date = str(
                raw.get(
                    "acq_date",
                    "",
                )
            ).strip()


            if not acq_date:
                continue


            acq_time = str(
                raw.get(
                    "acq_time",
                    "",
                )
            ).strip().zfill(
                4
            )


            if not acq_time:
                continue


            acquired_at = (
                f"{acq_date}"
                f"T{acq_time[:2]}"
                f":{acq_time[2:]}"
                ":00Z"
            )


            # =================================================
            # SATELLITE
            # =================================================

            satellite = (
                _optional_text(
                    raw.get(
                        "satellite"
                    )
                )
                or
                source_product
            )


            # =================================================
            # STABLE HOTSPOT ID
            # =================================================

            hotspot_id = (
                f"{satellite}-"
                f"{acq_date}-"
                f"{acq_time}-"
                f"{lat:.4f}-"
                f"{lng:.4f}"
            )


            # =================================================
            # RAW FIRMS FEATURES
            # =================================================

            brightness = _optional_float(
                raw.get(
                    "bright_ti4"
                )
                or
                raw.get(
                    "brightness"
                )
            )


            bright_ti5 = _optional_float(
                raw.get(
                    "bright_ti5"
                )
            )


            frp = _optional_float(
                raw.get(
                    "frp"
                )
            )


            raw_confidence = _optional_text(
                raw.get(
                    "confidence"
                )
            )


            normalized_confidence = (
                _normalize_firms_confidence(
                    raw_confidence
                )
            )


            scan = _optional_float(
                raw.get(
                    "scan"
                )
            )


            track = _optional_float(
                raw.get(
                    "track"
                )
            )


            instrument = _optional_text(
                raw.get(
                    "instrument"
                )
            )


            daynight = _optional_text(
                raw.get(
                    "daynight"
                )
            )


            version = _optional_text(
                raw.get(
                    "version"
                )
            )


            # =================================================
            # INSERT
            # =================================================
            #
            # Historical observations are stored without
            # inventing FireWatch-derived values.
            #
            # If this observation already exists because the
            # live feed stored it earlier, the raw FIRMS fields
            # are refreshed while existing risk/context values
            # are preserved.
            # =================================================

            connection.execute(
                """
                INSERT INTO firms_observations (

                    hotspot_id,
                    source_product,
                    satellite,

                    latitude,
                    longitude,

                    brightness,
                    bright_ti5,

                    frp,

                    confidence,
                    raw_confidence,

                    scan,
                    track,

                    instrument,
                    daynight,
                    version,

                    nearby_hotspots,

                    risk_score,
                    risk_level,

                    acquired_at,

                    land_type,
                    fire_type

                )

                VALUES (
                    ?, ?, ?,
                    ?, ?,
                    ?, ?,
                    ?,
                    ?, ?,
                    ?, ?,
                    ?, ?, ?,
                    NULL,
                    NULL, NULL,
                    ?,
                    NULL, NULL
                )

                ON CONFLICT(hotspot_id)
                DO UPDATE SET

                    source_product =
                        excluded.source_product,

                    satellite =
                        excluded.satellite,

                    latitude =
                        excluded.latitude,

                    longitude =
                        excluded.longitude,

                    brightness =
                        COALESCE(
                            excluded.brightness,
                            firms_observations.brightness
                        ),

                    bright_ti5 =
                        COALESCE(
                            excluded.bright_ti5,
                            firms_observations.bright_ti5
                        ),

                    frp =
                        COALESCE(
                            excluded.frp,
                            firms_observations.frp
                        ),

                    confidence =
                        COALESCE(
                            excluded.confidence,
                            firms_observations.confidence
                        ),

                    raw_confidence =
                        COALESCE(
                            excluded.raw_confidence,
                            firms_observations.raw_confidence
                        ),

                    scan =
                        COALESCE(
                            excluded.scan,
                            firms_observations.scan
                        ),

                    track =
                        COALESCE(
                            excluded.track,
                            firms_observations.track
                        ),

                    instrument =
                        COALESCE(
                            excluded.instrument,
                            firms_observations.instrument
                        ),

                    daynight =
                        COALESCE(
                            excluded.daynight,
                            firms_observations.daynight
                        ),

                    version =
                        COALESCE(
                            excluded.version,
                            firms_observations.version
                        ),

                    acquired_at =
                        excluded.acquired_at,

                    last_seen_at =
                        CURRENT_TIMESTAMP
                """,

                (
                    hotspot_id,
                    source_product,
                    satellite,

                    lat,
                    lng,

                    brightness,
                    bright_ti5,

                    frp,

                    normalized_confidence,
                    raw_confidence,

                    scan,
                    track,

                    instrument,
                    daynight,
                    version,

                    acquired_at,
                ),
            )


            # =================================================
            # DATABASE ID
            # =================================================

            row = connection.execute(
                """
                SELECT id

                FROM firms_observations

                WHERE hotspot_id = ?
                """,
                (
                    hotspot_id,
                ),
            ).fetchone()


            if not row:
                continue


            database_id = int(
                row["id"]
            )


            # =================================================
            # R-TREE
            # =================================================

            try:

                connection.execute(
                    """
                    INSERT OR REPLACE
                    INTO firms_observations_rtree (

                        id,
                        min_lng,
                        max_lng,
                        min_lat,
                        max_lat

                    )

                    VALUES (?, ?, ?, ?, ?)
                    """,

                    (
                        database_id,

                        lng,
                        lng,

                        lat,
                        lat,
                    ),
                )

            except sqlite3.OperationalError:

                pass


            saved += 1


        connection.commit()


    return saved
# =========================================================
# HELPERS
# =========================================================

def _optional_float(
    value,
):

    if value is None:
        return None

    text = str(
        value
    ).strip()

    if not text:
        return None

    try:
        return float(
            text
        )

    except (
        TypeError,
        ValueError,
    ):
        return None


def _optional_text(
    value,
):

    if value is None:
        return None

    text = str(
        value
    ).strip()

    return text or None
def _normalize_firms_confidence(
    value,
):

    if value is None:
        return None


    text = str(
        value
    ).strip().lower()


    if not text:
        return None


    mapping = {

        "l": 30.0,
        "low": 30.0,

        "n": 70.0,
        "nominal": 70.0,

        "h": 95.0,
        "high": 95.0,
    }


    if text in mapping:

        return mapping[
            text
        ]


    try:

        return float(
            text
        )

    except ValueError:

        return None

# =========================================================
# DATABASE STATUS
# =========================================================

def get_database_status():

    with get_connection() as connection:

        total = connection.execute(
            """
            SELECT COUNT(*)
            AS count

            FROM firms_observations
            """
        ).fetchone()["count"]


        earliest = connection.execute(
            """
            SELECT MIN(acquired_at)
            AS value

            FROM firms_observations
            """
        ).fetchone()["value"]


        latest = connection.execute(
            """
            SELECT MAX(acquired_at)
            AS value

            FROM firms_observations
            """
        ).fetchone()["value"]


        risk_rows = connection.execute(
            """
            SELECT
                risk_level,
                COUNT(*) AS count

            FROM firms_observations

            GROUP BY risk_level
            """
        ).fetchall()


        risk_distribution = {

            row["risk_level"]:
                row["count"]

            for row in risk_rows

            if row["risk_level"]

        }


        # ---------------------------------------------
        # RAW FIRMS FEATURE COVERAGE
        # ---------------------------------------------

        raw_feature_rows = connection.execute(
            """
            SELECT

                COUNT(bright_ti5)
                    AS bright_ti5_count,

                COUNT(scan)
                    AS scan_count,

                COUNT(track)
                    AS track_count,

                COUNT(instrument)
                    AS instrument_count,

                COUNT(daynight)
                    AS daynight_count,

                COUNT(version)
                    AS version_count,

                COUNT(raw_confidence)
                    AS raw_confidence_count

            FROM firms_observations
            """
        ).fetchone()


        raw_feature_coverage = {

            "brightTi5":
                raw_feature_rows[
                    "bright_ti5_count"
                ],

            "scan":
                raw_feature_rows[
                    "scan_count"
                ],

            "track":
                raw_feature_rows[
                    "track_count"
                ],

            "instrument":
                raw_feature_rows[
                    "instrument_count"
                ],

            "dayNight":
                raw_feature_rows[
                    "daynight_count"
                ],

            "version":
                raw_feature_rows[
                    "version_count"
                ],

            "rawConfidence":
                raw_feature_rows[
                    "raw_confidence_count"
                ],
        }


        # ---------------------------------------------
        # SPATIAL INDEX STATUS
        # ---------------------------------------------

        try:

            spatial_count = (
                connection.execute(
                    """
                    SELECT COUNT(*)
                    AS count

                    FROM firms_observations_rtree
                    """
                )
                .fetchone()["count"]
            )

            spatial_index = True

        except sqlite3.OperationalError:

            spatial_count = 0
            spatial_index = False


    return {

        "database":
            str(DB_PATH),

        "persistentStorage":
            True,

        "spatialIndex":
            spatial_index,

        "totalObservations":
            total,

        "spatiallyIndexedObservations":
            spatial_count,

        "earliestObservation":
            earliest,

        "latestObservation":
            latest,

        "riskDistribution":
            risk_distribution,

        "rawFeatureCoverage":
            raw_feature_coverage,
    }


# =========================================================
# GIS BOUNDING BOX QUERY
# =========================================================

def get_hotspots_in_bbox(
    min_lat: float,
    max_lat: float,
    min_lng: float,
    max_lng: float,
    limit: int = 1000,
):

    if min_lat > max_lat:
        raise ValueError(
            "min_lat cannot be greater than max_lat"
        )

    if min_lng > max_lng:
        raise ValueError(
            "min_lng cannot be greater than max_lng"
        )


    limit = min(
        max(
            int(limit),
            1,
        ),
        5000,
    )


    with get_connection() as connection:

        try:

            rows = connection.execute(
                """
                SELECT

                    f.hotspot_id,
                    f.source_product,
                    f.satellite,

                    f.latitude,
                    f.longitude,

                    f.brightness,
                    f.bright_ti5,

                    f.frp,

                    f.confidence,
                    f.raw_confidence,

                    f.scan,
                    f.track,

                    f.instrument,
                    f.daynight,
                    f.version,

                    f.nearby_hotspots,

                    f.risk_score,
                    f.risk_level,

                    f.acquired_at,

                    f.land_type,
                    f.fire_type,

                    f.first_seen_at,
                    f.last_seen_at

                FROM firms_observations AS f

                INNER JOIN firms_observations_rtree AS r
                    ON f.id = r.id

                WHERE
                    r.max_lat >= ?
                    AND r.min_lat <= ?
                    AND r.max_lng >= ?
                    AND r.min_lng <= ?

                ORDER BY
                    f.acquired_at DESC

                LIMIT ?
                """,

                (
                    min_lat,
                    max_lat,
                    min_lng,
                    max_lng,
                    limit,
                ),
            ).fetchall()


            spatial_method = (
                "SQLite RTree"
            )


        except sqlite3.OperationalError:

            rows = connection.execute(
                """
                SELECT *

                FROM firms_observations

                WHERE
                    latitude BETWEEN ? AND ?
                    AND longitude BETWEEN ? AND ?

                ORDER BY
                    acquired_at DESC

                LIMIT ?
                """,

                (
                    min_lat,
                    max_lat,
                    min_lng,
                    max_lng,
                    limit,
                ),
            ).fetchall()


            spatial_method = (
                "Latitude/longitude fallback"
            )


    hotspots = []


    for row in rows:

        hotspots.append(
            {

                "id":
                    row["hotspot_id"],

                "sourceProduct":
                    row["source_product"],

                "satellite":
                    row["satellite"],

                "lat":
                    row["latitude"],

                "lng":
                    row["longitude"],

                "brightness":
                    row["brightness"],

                "brightTi5":
                    row["bright_ti5"],

                "frp":
                    row["frp"],

                "confidence":
                    row["confidence"],

                "rawConfidence":
                    row["raw_confidence"],

                "scan":
                    row["scan"],

                "track":
                    row["track"],

                "instrument":
                    row["instrument"],

                "dayNight":
                    row["daynight"],

                "version":
                    row["version"],

                "nearbyHotspots":
                    row["nearby_hotspots"],

                "riskScore":
                    row["risk_score"],

                "riskLevel":
                    row["risk_level"],

                "acquiredAt":
                    row["acquired_at"],

                "landType":
                    row["land_type"],

                "fireType":
                    row["fire_type"],

                "firstSeenAt":
                    row["first_seen_at"],

                "lastSeenAt":
                    row["last_seen_at"],
            }
        )


    return {

        "count":
            len(hotspots),

        "limit":
            limit,

        "bbox": {

            "minLat":
                min_lat,

            "maxLat":
                max_lat,

            "minLng":
                min_lng,

            "maxLng":
                max_lng,
        },

        "spatialMethod":
            spatial_method,

        "hotspots":
            hotspots,
    }

def get_historical_analytics():
    """
    Build analytics only from persisted FIRMS observations.

    Important:
    These statistics describe stored NASA FIRMS thermal
    detections. They are not confirmed industrial or
    natural fire classifications.
    """

    with get_connection() as connection:

        # =================================================
        # BASIC SUMMARY
        # =================================================

        summary = connection.execute(
            """
            SELECT

                COUNT(*)
                    AS total_observations,

                COUNT(
                    DISTINCT DATE(acquired_at)
                )
                    AS unique_dates,

                MIN(acquired_at)
                    AS earliest_observation,

                MAX(acquired_at)
                    AS latest_observation,

                AVG(brightness)
                    AS average_brightness,

                AVG(frp)
                    AS average_frp,

                AVG(risk_score)
                    AS average_risk_score

            FROM firms_observations
            """
        ).fetchone()


        # =================================================
        # RISK DISTRIBUTION
        # =================================================

        risk_rows = connection.execute(
            """
            SELECT

                risk_level,

                COUNT(*)
                    AS count

            FROM firms_observations

            GROUP BY
                risk_level

            ORDER BY
                CASE risk_level

                    WHEN 'Extreme'
                        THEN 1

                    WHEN 'High'
                        THEN 2

                    WHEN 'Moderate'
                        THEN 3

                    WHEN 'Low'
                        THEN 4

                    ELSE 5

                END
            """
        ).fetchall()


        risk_distribution = {

            row["risk_level"]:
                row["count"]

            for row in risk_rows

            if row["risk_level"]
        }


        # =================================================
        # RISK SCORE DISTRIBUTION
        # =================================================

        risk_score_rows = connection.execute(
            """
            SELECT

                CASE

                    WHEN risk_score >= 0
                    AND risk_score < 20
                        THEN '0-19'

                    WHEN risk_score >= 20
                    AND risk_score < 40
                        THEN '20-39'

                    WHEN risk_score >= 40
                    AND risk_score < 60
                        THEN '40-59'

                    WHEN risk_score >= 60
                    AND risk_score < 80
                        THEN '60-79'

                    WHEN risk_score >= 80
                    AND risk_score <= 100
                        THEN '80-100'

                    ELSE 'Unknown'

                END AS range_label,

                COUNT(*)
                    AS count

            FROM firms_observations

            WHERE
                risk_score IS NOT NULL

            GROUP BY
                range_label

            ORDER BY

                CASE range_label

                    WHEN '0-19'
                        THEN 1

                    WHEN '20-39'
                        THEN 2

                    WHEN '40-59'
                        THEN 3

                    WHEN '60-79'
                        THEN 4

                    WHEN '80-100'
                        THEN 5

                    ELSE 6

                END
            """
        ).fetchall()


        risk_score_distribution = [

            {
                "range":
                    row["range_label"],

                "count":
                    row["count"],
            }

            for row in risk_score_rows
        ]


        # =================================================
        # DAILY OBSERVATIONS
        # =================================================

        daily_rows = connection.execute(
            """
            SELECT

                DATE(acquired_at)
                    AS observation_date,

                COUNT(*)
                    AS count,

                AVG(brightness)
                    AS average_brightness,

                AVG(frp)
                    AS average_frp,

                AVG(risk_score)
                    AS average_risk_score

            FROM firms_observations

            GROUP BY
                DATE(acquired_at)

            ORDER BY
                observation_date ASC
            """
        ).fetchall()


        daily_observations = [

            {
                "date":
                    row["observation_date"],

                "count":
                    row["count"],

                "averageBrightness":
                    (
                        round(
                            row["average_brightness"],
                            2,
                        )
                        if row["average_brightness"]
                        is not None

                        else None
                    ),

                "averageFrp":
                    (
                        round(
                            row["average_frp"],
                            2,
                        )
                        if row["average_frp"]
                        is not None

                        else None
                    ),

                "averageRiskScore":
                    (
                        round(
                            row["average_risk_score"],
                            2,
                        )
                        if row["average_risk_score"]
                        is not None

                        else None
                    ),
            }

            for row in daily_rows
        ]


        # =================================================
        # SATELLITE DISTRIBUTION
        # =================================================

        satellite_rows = connection.execute(
            """
            SELECT

                satellite,

                COUNT(*)
                    AS count

            FROM firms_observations

            GROUP BY
                satellite

            ORDER BY
                count DESC
            """
        ).fetchall()


        satellite_distribution = [

            {
                "satellite":
                    row["satellite"]
                    or "Unknown",

                "count":
                    row["count"],
            }

            for row in satellite_rows
        ]


        # =================================================
        # DAY / NIGHT DISTRIBUTION
        # =================================================

        daynight_rows = connection.execute(
            """
            SELECT

                daynight,

                COUNT(*)
                    AS count

            FROM firms_observations

            GROUP BY
                daynight

            ORDER BY
                count DESC
            """
        ).fetchall()


        daynight_distribution = [

            {
                "period":
                    (
                        "Day"
                        if row["daynight"] == "D"

                        else
                        "Night"
                        if row["daynight"] == "N"

                        else
                        row["daynight"]
                        or "Unknown"
                    ),

                "code":
                    row["daynight"],

                "count":
                    row["count"],
            }

            for row in daynight_rows
        ]


        # =================================================
        # TOP 10 STORED RISK OBSERVATIONS
        # =================================================

        top_risk_rows = connection.execute(
            """
            SELECT

                hotspot_id,

                latitude,
                longitude,

                brightness,
                bright_ti5,

                frp,

                confidence,
                raw_confidence,

                risk_score,
                risk_level,

                acquired_at,

                satellite,

                instrument,
                daynight,

                source_product

            FROM firms_observations

            WHERE
                risk_score IS NOT NULL

            ORDER BY
                risk_score DESC,
                frp DESC

            LIMIT 10
            """
        ).fetchall()


        # =================================================
        # HIGHEST FRP OBSERVATION
        # =================================================

        highest_frp = connection.execute(
            """
            SELECT

                hotspot_id,

                latitude,
                longitude,

                brightness,
                bright_ti5,

                frp,

                confidence,
                raw_confidence,

                risk_score,
                risk_level,

                acquired_at,

                satellite,

                instrument,
                daynight,

                source_product

            FROM firms_observations

            WHERE
                frp IS NOT NULL

            ORDER BY
                frp DESC

            LIMIT 1
            """
        ).fetchone()


        # =================================================
        # HIGHEST RISK OBSERVATION
        # =================================================

        highest_risk = connection.execute(
            """
            SELECT

                hotspot_id,

                latitude,
                longitude,

                brightness,
                bright_ti5,

                frp,

                confidence,
                raw_confidence,

                risk_score,
                risk_level,

                acquired_at,

                satellite,

                instrument,
                daynight,

                source_product

            FROM firms_observations

            WHERE
                risk_score IS NOT NULL

            ORDER BY
                risk_score DESC,
                frp DESC

            LIMIT 1
            """
        ).fetchone()


    # =====================================================
    # SERIALIZATION HELPER
    # =====================================================

    def serialize_hotspot(row):

        if row is None:
            return None


        return {

            "id":
                row["hotspot_id"],

            "lat":
                row["latitude"],

            "lng":
                row["longitude"],

            "brightness":
                row["brightness"],

            "brightTi5":
                row["bright_ti5"],

            "frp":
                row["frp"],

            "confidence":
                row["confidence"],

            "rawConfidence":
                row["raw_confidence"],

            "riskScore":
                row["risk_score"],

            "riskLevel":
                row["risk_level"],

            "acquiredAt":
                row["acquired_at"],

            "satellite":
                row["satellite"],

            "instrument":
                row["instrument"],

            "dayNight":
                row["daynight"],

            "sourceProduct":
                row["source_product"],
        }


    # =====================================================
    # TOP RISK LIST
    # =====================================================

    top_risk_observations = [

        serialize_hotspot(
            row
        )

        for row in top_risk_rows
    ]


    # =====================================================
    # FINAL RESPONSE
    # =====================================================

    return {

        "source":
            "Persistent FireWatch GIS database",

        "dataType":
            "NASA FIRMS thermal detections",

        "totalObservations":
            summary["total_observations"],

        "uniqueObservationDates":
            summary["unique_dates"],

        "earliestObservation":
            summary["earliest_observation"],

        "latestObservation":
            summary["latest_observation"],


        "averages": {

            "brightness":
                (
                    round(
                        summary["average_brightness"],
                        2,
                    )

                    if summary["average_brightness"]
                    is not None

                    else None
                ),

            "frp":
                (
                    round(
                        summary["average_frp"],
                        2,
                    )

                    if summary["average_frp"]
                    is not None

                    else None
                ),

            "heuristicRiskScore":
                (
                    round(
                        summary["average_risk_score"],
                        2,
                    )

                    if summary["average_risk_score"]
                    is not None

                    else None
                ),
        },


        "riskDistribution":
            risk_distribution,


        "riskScoreDistribution":
            risk_score_distribution,


        "dailyObservations":
            daily_observations,


        "satelliteDistribution":
            satellite_distribution,


        "dayNightDistribution":
            daynight_distribution,


        "topRiskObservations":
            top_risk_observations,


        "highestFrpObservation":
            serialize_hotspot(
                highest_frp
            ),


        "highestRiskObservation":
            serialize_hotspot(
                highest_risk
            ),


        "note":
            (
                "These analytics describe stored NASA FIRMS "
                "thermal detections. They do not represent "
                "confirmed industrial or natural fires. "
                "The displayed risk score is the FireWatch "
                "Heuristic FIRMS Risk Index and is not an "
                "ML probability."
            ),
    }

    # =========================================================
# REPEATED THERMAL LOCATION HELPERS
# =========================================================

def _distance_km(
    lat1: float,
    lng1: float,
    lat2: float,
    lng2: float,
) -> float:
    """
    Haversine distance between two coordinates.

    Used only for spatial grouping of stored FIRMS
    observations.
    """

    dlat = radians(
        lat2 - lat1
    )

    dlng = radians(
        lng2 - lng1
    )

    a = (
        sin(dlat / 2) ** 2
        +
        cos(
            radians(lat1)
        )
        *
        cos(
            radians(lat2)
        )
        *
        sin(dlng / 2) ** 2
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
            sqrt(a)
        )
    )


def _parse_iso_datetime(
    value: str | None,
):

    if not value:
        return None

    text = str(
        value
    ).strip()

    if not text:
        return None

    try:

        return datetime.fromisoformat(
            text.replace(
                "Z",
                "+00:00",
            )
        )

    except ValueError:

        return None


def _mean(
    values: list[float],
):

    if not values:
        return None

    return (
        sum(values)
        /
        len(values)
    )


# =========================================================
# REPEATED THERMAL LOCATION DETECTION
# =========================================================

def get_repeated_thermal_locations(
    days: int = 30,
    radius_km: float = 1.0,
    min_active_days: int = 2,
    limit: int = 100,
):
    """
    Discover candidate repeated thermal locations from
    observations already stored in the FireWatch GIS DB.

    Important:

    - This does NOT classify a location as industrial.
    - This does NOT prove a persistent industrial source.
    - A result only means FIRMS thermal detections were
      observed near the same location on multiple dates.

    Spatial grouping uses a deterministic centroid-based
    grouping process.

    Temporal persistence is based on acquired_at, which is
    the real FIRMS acquisition timestamp.
    """

    # =====================================================
    # VALIDATION
    # =====================================================

    days = min(
        max(
            int(days),
            1,
        ),
        90,
    )

    radius_km = min(
        max(
            float(radius_km),
            0.1,
        ),
        5.0,
    )

    min_active_days = min(
        max(
            int(min_active_days),
            2,
        ),
        30,
    )

    limit = min(
        max(
            int(limit),
            1,
        ),
        500,
    )


    with get_connection() as connection:

        # =================================================
        # REFERENCE DATE
        # =================================================
        #
        # We intentionally use the latest FIRMS observation
        # in the database instead of the computer clock.
        #
        # This keeps historical analytics aligned with the
        # actual data currently stored by FireWatch.
        # =================================================

        latest_row = connection.execute(
            """
            SELECT
                MAX(acquired_at) AS latest

            FROM firms_observations
            """
        ).fetchone()


        latest_value = (
            latest_row["latest"]
            if latest_row
            else None
        )


        latest_datetime = _parse_iso_datetime(
            latest_value
        )


        if latest_datetime is None:

            return {

                "source":
                    "Persistent FireWatch GIS database",

                "dataType":
                    "NASA FIRMS thermal detections",

                "method":
                    (
                        "Spatial grouping of stored FIRMS "
                        "observations"
                    ),

                "requestedDays":
                    days,

                "referenceDate":
                    None,

                "windowStart":
                    None,

                "clusteringRadiusKm":
                    radius_km,

                "minimumDistinctActiveDays":
                    min_active_days,

                "observationsEvaluated":
                    0,

                "storedObservationDays":
                    0,

                "count":
                    0,

                "locations":
                    [],

                "note":
                    (
                        "No stored FIRMS observations are "
                        "available for repeated-location "
                        "analysis."
                    ),
            }


        reference_date = (
            latest_datetime.date()
        )


        window_start = (
            reference_date
            -
            timedelta(
                days=
                    days - 1
            )
        )


        # =================================================
        # LOAD OBSERVATIONS IN WINDOW
        # =================================================

        rows = connection.execute(
            """
            SELECT

                hotspot_id,

                source_product,
                satellite,

                latitude,
                longitude,

                brightness,
                bright_ti5,

                frp,

                confidence,
                raw_confidence,

                scan,
                track,

                instrument,
                daynight,

                risk_score,
                risk_level,

                acquired_at

            FROM firms_observations

            WHERE
                DATE(acquired_at)
                BETWEEN ? AND ?

            ORDER BY
                latitude ASC,
                longitude ASC,
                acquired_at ASC
            """,

            (
                window_start.isoformat(),
                reference_date.isoformat(),
            ),
        ).fetchall()


    # =====================================================
    # SERIALIZE DATABASE ROWS
    # =====================================================

    observations = []


    for row in rows:

        acquired = _parse_iso_datetime(
            row["acquired_at"]
        )


        if acquired is None:
            continue


        observations.append(
            {

                "id":
                    row["hotspot_id"],

                "sourceProduct":
                    row["source_product"],

                "satellite":
                    row["satellite"],

                "lat":
                    float(
                        row["latitude"]
                    ),

                "lng":
                    float(
                        row["longitude"]
                    ),

                "brightness":
                    row["brightness"],

                "brightTi5":
                    row["bright_ti5"],

                "frp":
                    row["frp"],

                "confidence":
                    row["confidence"],

                "rawConfidence":
                    row["raw_confidence"],

                "scan":
                    row["scan"],

                "track":
                    row["track"],

                "instrument":
                    row["instrument"],

                "dayNight":
                    row["daynight"],

                "riskScore":
                    row["risk_score"],

                "riskLevel":
                    row["risk_level"],

                "acquiredAt":
                    row["acquired_at"],

                "_datetime":
                    acquired,

                "_date":
                    acquired.date(),
            }
        )


    # =====================================================
    # DATABASE DATE COVERAGE
    # =====================================================

    stored_dates = sorted(
        {
            observation["_date"]

            for observation
            in observations
        }
    )


    # =====================================================
    # SPATIAL GROUPING
    # =====================================================
    #
    # Each observation is assigned to the nearest existing
    # cluster centroid if that centroid is within radius_km.
    #
    # This avoids a simple rounding/grid approximation.
    # =====================================================

    clusters: list[
        dict[str, Any]
    ] = []


    for observation in observations:

        best_cluster = None
        best_distance = None


        for cluster in clusters:

            distance = _distance_km(

                observation["lat"],
                observation["lng"],

                cluster["centroidLat"],
                cluster["centroidLng"],
            )


            if distance > radius_km:
                continue


            if (
                best_distance is None
                or
                distance < best_distance
            ):

                best_distance = distance
                best_cluster = cluster


        # =================================================
        # CREATE NEW CLUSTER
        # =================================================

        if best_cluster is None:

            clusters.append(
                {

                    "centroidLat":
                        observation["lat"],

                    "centroidLng":
                        observation["lng"],

                    "observations":
                        [
                            observation
                        ],
                }
            )

            continue


        # =================================================
        # ADD TO EXISTING CLUSTER
        # =================================================

        best_cluster[
            "observations"
        ].append(
            observation
        )


        members = (
            best_cluster[
                "observations"
            ]
        )


        best_cluster[
            "centroidLat"
        ] = (
            sum(
                member["lat"]
                for member
                in members
            )
            /
            len(members)
        )


        best_cluster[
            "centroidLng"
        ] = (
            sum(
                member["lng"]
                for member
                in members
            )
            /
            len(members)
        )


    # =====================================================
    # BUILD REPEATED LOCATION CANDIDATES
    # =====================================================

    locations = []


    for cluster in clusters:

        members = (
            cluster[
                "observations"
            ]
        )


        active_dates = sorted(
            {
                member["_date"]

                for member
                in members
            }
        )


        distinct_active_days = len(
            active_dates
        )


        # -------------------------------------------------
        # A repeated location requires detections on
        # multiple distinct dates.
        # -------------------------------------------------

        if (
            distinct_active_days
            <
            min_active_days
        ):

            continue


        first_date = (
            active_dates[0]
        )


        latest_date = (
            active_dates[-1]
        )


        observation_span_days = (
            latest_date
            -
            first_date
        ).days + 1


        centroid_lat = (
            cluster[
                "centroidLat"
            ]
        )


        centroid_lng = (
            cluster[
                "centroidLng"
            ]
        )


        # =================================================
        # SPATIAL CONSISTENCY
        # =================================================

        distances_m = [

            _distance_km(

                centroid_lat,
                centroid_lng,

                member["lat"],
                member["lng"],
            )
            *
            1000

            for member
            in members
        ]


        mean_distance_m = (
            round(
                _mean(
                    distances_m
                ),
                1,
            )
            if distances_m
            else None
        )


        max_distance_m = (
            round(
                max(
                    distances_m
                ),
                1,
            )
            if distances_m
            else None
        )


        # =================================================
        # TEMPORAL GAP ANALYSIS
        # =================================================

        gaps = []


        for index in range(
            1,
            len(active_dates),
        ):

            gaps.append(
                (
                    active_dates[index]
                    -
                    active_dates[index - 1]
                ).days
            )


        mean_gap_days = (
            round(
                _mean(
                    [
                        float(value)
                        for value
                        in gaps
                    ]
                ),
                2,
            )
            if gaps
            else None
        )


        min_gap_days = (
            min(gaps)
            if gaps
            else None
        )


        max_gap_days = (
            max(gaps)
            if gaps
            else None
        )


        # =================================================
        # FIRMS STATISTICS
        # =================================================

        frp_values = [

            float(
                member["frp"]
            )

            for member
            in members

            if member["frp"]
            is not None
        ]


        brightness_values = [

            float(
                member["brightness"]
            )

            for member
            in members

            if member["brightness"]
            is not None
        ]


        confidence_values = [

            float(
                member["confidence"]
            )

            for member
            in members

            if member["confidence"]
            is not None
        ]


        # =================================================
        # DAY / NIGHT
        # =================================================

        day_detections = sum(

            1

            for member
            in members

            if member[
                "dayNight"
            ] == "D"
        )


        night_detections = sum(

            1

            for member
            in members

            if member[
                "dayNight"
            ] == "N"
        )


        # =================================================
        # SATELLITE SOURCES
        # =================================================

        satellites = sorted(
            {
                member["satellite"]

                for member
                in members

                if member[
                    "satellite"
                ]
            }
        )


        # =================================================
        # EXISTING HEURISTIC RISK COVERAGE
        # =================================================
        #
        # Some historical observations intentionally have
        # no heuristic risk score.
        # =================================================

        assessed_risk_scores = [

            float(
                member["riskScore"]
            )

            for member
            in members

            if member[
                "riskScore"
            ] is not None
        ]


        highest_risk_score = (
            round(
                max(
                    assessed_risk_scores
                ),
                2,
            )

            if assessed_risk_scores

            else None
        )


        # =================================================
        # STABLE DERIVED LOCATION ID
        # =================================================
        #
        # We derive the registry ID from the earliest stable
        # FIRMS observation ID.
        # =================================================

        anchor_member = min(

            members,

            key=lambda member:
                member[
                    "_datetime"
                ],
        )


        identifier_hash = (
            hashlib.sha1(
                anchor_member[
                    "id"
                ].encode(
                    "utf-8"
                )
            )
            .hexdigest()[
                :10
            ]
            .upper()
        )


        location_id = (
            f"RTL-{identifier_hash}"
        )


        # =================================================
        # RESULT LOCATION
        # =================================================

        locations.append(
            {

                "id":
                    location_id,


                "status":
                    "Repeated thermal activity",


                "repeatActivity":
                    True,


                "lat":
                    round(
                        centroid_lat,
                        6,
                    ),


                "lng":
                    round(
                        centroid_lng,
                        6,
                    ),


                "detections":
                    len(
                        members
                    ),


                "distinctActiveDays":
                    distinct_active_days,


                "observationSpanDays":
                    observation_span_days,


                "activeDayFraction":
                    round(
                        distinct_active_days
                        /
                        days,
                        4,
                    ),


                "firstObserved":
                    first_date.isoformat(),


                "latestObserved":
                    latest_date.isoformat(),


                "firstAcquiredAt":
                    min(
                        member[
                            "acquiredAt"
                        ]

                        for member
                        in members
                    ),


                "latestAcquiredAt":
                    max(
                        member[
                            "acquiredAt"
                        ]

                        for member
                        in members
                    ),


                "meanDetectionDistanceM":
                    mean_distance_m,


                "maxDetectionDistanceM":
                    max_distance_m,


                "meanGapDays":
                    mean_gap_days,


                "minGapDays":
                    min_gap_days,


                "maxGapDays":
                    max_gap_days,


                "averageFrp":
                    (
                        round(
                            _mean(
                                frp_values
                            ),
                            2,
                        )

                        if frp_values

                        else None
                    ),


                "maximumFrp":
                    (
                        round(
                            max(
                                frp_values
                            ),
                            2,
                        )

                        if frp_values

                        else None
                    ),


                "averageBrightness":
                    (
                        round(
                            _mean(
                                brightness_values
                            ),
                            2,
                        )

                        if brightness_values

                        else None
                    ),


                "maximumBrightness":
                    (
                        round(
                            max(
                                brightness_values
                            ),
                            2,
                        )

                        if brightness_values

                        else None
                    ),


                "averageConfidence":
                    (
                        round(
                            _mean(
                                confidence_values
                            ),
                            2,
                        )

                        if confidence_values

                        else None
                    ),


                "dayDetections":
                    day_detections,


                "nightDetections":
                    night_detections,


                "satellites":
                    satellites,


                "riskAssessedObservations":
                    len(
                        assessed_risk_scores
                    ),


                "highestHeuristicRiskScore":
                    highest_risk_score,


                "latestObservationId":
                    max(

                        members,

                        key=lambda member:
                            member[
                                "_datetime"
                            ],

                    )[
                        "id"
                    ],


                # =========================================
                # ML CLASSIFICATION PLACEHOLDER
                # =========================================
                #
                # This is deliberately null until the real
                # FireWatch classifier is integrated.
                # =========================================

                "classification": {

                    "label":
                        None,

                    "confidence":
                        None,

                    "modelStatus":
                        "Pending ML model",
                },
            }
        )


    # =====================================================
    # SORT MOST SIGNIFICANT REPEATED ACTIVITY FIRST
    # =====================================================
    #
    # This is NOT a risk ranking.
    #
    # We sort factually by:
    # 1. distinct observation dates
    # 2. detection count
    # 3. maximum FRP
    # =====================================================

    locations.sort(

        key=lambda location: (

            location[
                "distinctActiveDays"
            ],

            location[
                "detections"
            ],

            location[
                "maximumFrp"
            ]
            or
            0,

        ),

        reverse=True,
    )


    locations = (
        locations[
            :limit
        ]
    )


    # =====================================================
    # FINAL RESPONSE
    # =====================================================

    return {

        "source":
            "Persistent FireWatch GIS database",


        "dataType":
            "NASA FIRMS thermal detections",


        "method":
            (
                "Spatial grouping of stored FIRMS thermal "
                "detections followed by distinct-date "
                "persistence analysis"
            ),


        "requestedDays":
            days,


        "referenceDate":
            reference_date.isoformat(),


        "windowStart":
            window_start.isoformat(),


        "clusteringRadiusKm":
            radius_km,


        "minimumDistinctActiveDays":
            min_active_days,


        "observationsEvaluated":
            len(
                observations
            ),


        "storedObservationDays":
            len(
                stored_dates
            ),


        "earliestStoredDate":
            (
                stored_dates[
                    0
                ].isoformat()

                if stored_dates

                else None
            ),


        "latestStoredDate":
            (
                stored_dates[
                    -1
                ].isoformat()

                if stored_dates

                else None
            ),


        "count":
            len(
                locations
            ),


        "locations":
            locations,


        "note":
            (
                "Repeated thermal locations indicate NASA "
                "FIRMS detections observed near the same "
                "location on multiple distinct dates. "
                "Persistence alone does not prove that a "
                "location is an industrial thermal source "
                "or a confirmed fire."
            ),
    }