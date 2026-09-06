from __future__ import annotations

import asyncio
import math
from datetime import datetime, timezone
from typing import Any

from fastapi import (
    APIRouter,
    HTTPException,
)

from pydantic import BaseModel

from services.osm_service import (
    get_osm_context,
)

from services.local_osm_service import (
    get_local_osm_context,
    get_local_osm_status,
)

from services.persistence_service import (
    get_persistence_analysis,
)

from services.prediction_service import (
    get_model_status,
    get_required_features,
    predict_from_features,
)


router = APIRouter(
    prefix="/prediction",
    tags=["AI Classification"],
)


# =========================================================
# REQUEST MODEL
# =========================================================

class ClassificationRequest(BaseModel):
    """
    Real NASA FIRMS observation.
    """

    hotspotId: str | None = None
    hotspotName: str | None = None

    lat: float
    lng: float

    brightness: float | None = None
    frp: float | None = None

    scan: float | None = None
    track: float | None = None

    rawConfidence: str | float | int | None = None

    dayNight: str | None = None

    acquiredAt: str


# =========================================================
# BATCH REQUEST
# =========================================================

class BatchClassificationRequest(BaseModel):
    """
    Development candidate scanner.

    Uses only real FIRMS observations supplied
    by the frontend.
    """

    hotspots: list[ClassificationRequest]


# =========================================================
# MODEL STATUS
# =========================================================

@router.get("/status")
def prediction_status():

    return get_model_status()


# =========================================================
# MODEL FEATURES
# =========================================================

@router.get("/features")
def prediction_features():

    return {
        "features":
            get_required_features()
    }


# =========================================================
# FINITE NUMBER VALIDATION
# =========================================================

def require_finite_number(
    value: Any,
    field_name: str,
) -> float:

    if value is None:

        raise ValueError(
            f"{field_name} is unavailable "
            "for this FIRMS observation"
        )


    try:

        numeric = float(
            value
        )

    except (
        TypeError,
        ValueError,
    ) as exc:

        raise ValueError(
            f"{field_name} must be numeric"
        ) from exc


    if not math.isfinite(
        numeric
    ):

        raise ValueError(
            f"{field_name} must be finite"
        )


    return numeric


# =========================================================
# ACQUISITION TIMESTAMP
# =========================================================

def parse_acquired_at(
    value: str,
) -> datetime:

    if not value:

        raise ValueError(
            "acquiredAt is required"
        )


    text = value.strip()


    if not text:

        raise ValueError(
            "acquiredAt is required"
        )


    try:

        parsed = datetime.fromisoformat(
            text.replace(
                "Z",
                "+00:00",
            )
        )

    except ValueError as exc:

        raise ValueError(
            "acquiredAt must be a valid ISO timestamp"
        ) from exc


    if parsed.tzinfo is None:

        parsed = parsed.replace(
            tzinfo=timezone.utc
        )


    return parsed.astimezone(
        timezone.utc
    )


# =========================================================
# FIRMS CONFIDENCE
# =========================================================

def convert_confidence(
    value: Any,
) -> float:

    if value is None:

        raise ValueError(
            "rawConfidence is unavailable "
            "for this FIRMS observation"
        )


    if isinstance(
        value,
        str,
    ):

        text = value.strip().lower()


        mapping = {

            "l":
                30.0,

            "low":
                30.0,

            "n":
                70.0,

            "nominal":
                70.0,

            "h":
                95.0,

            "high":
                95.0,
        }


        if text in mapping:

            return mapping[
                text
            ]


        try:

            numeric = float(
                text
            )

        except ValueError as exc:

            raise ValueError(
                "Unsupported FIRMS rawConfidence value"
            ) from exc


    else:

        try:

            numeric = float(
                value
            )

        except (
            TypeError,
            ValueError,
        ) as exc:

            raise ValueError(
                "Unsupported FIRMS rawConfidence value"
            ) from exc


    if not math.isfinite(
        numeric
    ):

        raise ValueError(
            "rawConfidence must be finite"
        )


    if not (
        0
        <=
        numeric
        <=
        100
    ):

        raise ValueError(
            "rawConfidence must be between 0 and 100"
        )


    return numeric


# =========================================================
# DAY / NIGHT
# =========================================================

def convert_daynight(
    value: str | None,
) -> float:

    if value is None:

        raise ValueError(
            "dayNight is unavailable "
            "for this FIRMS observation"
        )


    text = value.strip().upper()


    if text == "D":

        return 1.0


    if text == "N":

        return 0.0


    raise ValueError(
        "dayNight must be D or N"
    )


# =========================================================
# PERSISTENCE FEATURE
# =========================================================

def get_persistence_feature(
    features: dict[str, Any],
    name: str,
) -> float:

    value = features.get(
        name
    )


    if value is None:

        raise ValueError(
            f"Persistence feature '{name}' "
            "is unavailable"
        )


    try:

        numeric = float(
            value
        )

    except (
        TypeError,
        ValueError,
    ) as exc:

        raise ValueError(
            f"Persistence feature '{name}' "
            "is invalid"
        ) from exc


    if not math.isfinite(
        numeric
    ):

        raise ValueError(
            f"Persistence feature '{name}' "
            "is invalid"
        )


    return numeric


# =========================================================
# COMMON FIRMS FEATURE EXTRACTION
# =========================================================

def extract_current_firms_features(
    request: ClassificationRequest,
) -> dict[str, Any]:

    try:

        brightness = require_finite_number(
            request.brightness,
            "brightness",
        )

        frp = require_finite_number(
            request.frp,
            "frp",
        )

        scan = require_finite_number(
            request.scan,
            "scan",
        )

        track = require_finite_number(
            request.track,
            "track",
        )

        confidence_pct = convert_confidence(
            request.rawConfidence
        )

        daynight_num = convert_daynight(
            request.dayNight
        )

        acquired_at = parse_acquired_at(
            request.acquiredAt
        )


    except ValueError as exc:

        raise HTTPException(
            status_code=422,
            detail={
                "message":
                    "AI classification cannot be "
                    "performed because required real "
                    "FIRMS data is unavailable.",

                "reason":
                    str(
                        exc
                    ),
            },
        ) from exc


    return {

        "brightness":
            brightness,

        "frp":
            frp,

        "scan":
            scan,

        "track":
            track,

        "confidence_pct":
            confidence_pct,

        "daynight_num":
            daynight_num,

        "acquired_at":
            acquired_at,
    }


# =========================================================
# COORDINATE VALIDATION
# =========================================================

def validate_coordinates(
    request: ClassificationRequest,
) -> None:

    if not (
        -90
        <=
        request.lat
        <=
        90
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid latitude",
        )


    if not (
        -180
        <=
        request.lng
        <=
        180
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid longitude",
        )


# =========================================================
# MODEL AVAILABILITY
# =========================================================

def validate_model_available() -> dict[str, Any]:

    model_status = get_model_status()


    if not model_status.get(
        "available"
    ):

        raise HTTPException(
            status_code=503,
            detail={
                "message":
                    "AI classification model "
                    "is unavailable",

                "modelStatus":
                    model_status,
            },
        )


    return model_status


# =========================================================
# BUILD EXACT V3 FEATURES
# =========================================================

def build_v3_features(
    current: dict[str, Any],
    persistence_features: dict[str, Any],
    industrial_within: float,
    natural_within: float,
) -> dict[str, float]:

    acquired_at = current[
        "acquired_at"
    ]


    try:

        return {

            "brightness":
                current[
                    "brightness"
                ],

            "frp":
                current[
                    "frp"
                ],

            "scan":
                current[
                    "scan"
                ],

            "track":
                current[
                    "track"
                ],

            "hour":
                float(
                    acquired_at.hour
                ),

            "month":
                float(
                    acquired_at.month
                ),

            "confidence_pct":
                current[
                    "confidence_pct"
                ],

            "daynight_num":
                current[
                    "daynight_num"
                ],

            "detections_3d":
                get_persistence_feature(
                    persistence_features,
                    "detections3d",
                ),

            "detections_7d":
                get_persistence_feature(
                    persistence_features,
                    "detections7d",
                ),

            "detections_10d":
                get_persistence_feature(
                    persistence_features,
                    "detections10d",
                ),

            "detections_30d":
                get_persistence_feature(
                    persistence_features,
                    "detections30d",
                ),

            "distinct_active_days_30d":
                get_persistence_feature(
                    persistence_features,
                    "distinctActiveDays30d",
                ),

            "industrial_within_1_5km":
                industrial_within,

            "natural_within_1_5km":
                natural_within,
        }


    except ValueError as exc:

        raise HTTPException(
            status_code=503,
            detail={
                "message":
                    "AI classification is unavailable "
                    "because one or more contextual "
                    "features could not be calculated.",

                "reason":
                    str(
                        exc
                    ),
            },
        ) from exc


# =========================================================
# NORMAL LIVE CLASSIFICATION
# =========================================================

async def run_hotspot_classification(
    request: ClassificationRequest,
) -> dict[str, Any]:
    """
    Normal FireWatch classification.

    Uses:
        real live FIRMS observation
        live Overpass OSM context
        real prior FIRMS persistence
        FireWatch XGBoost V3
    """

    # =====================================================
    # 1. MODEL
    # =====================================================

    validate_model_available()


    # =====================================================
    # 2. COORDINATES
    # =====================================================

    validate_coordinates(
        request
    )


    # =====================================================
    # 3. CURRENT FIRMS
    # =====================================================

    current = extract_current_firms_features(
        request
    )


    # =====================================================
    # 4. LIVE OSM + PERSISTENCE
    # =====================================================

    (
        osm_result,
        persistence_result,
    ) = await asyncio.gather(

        get_osm_context(
            request.lat,
            request.lng,
        ),

        get_persistence_analysis(
            lat=request.lat,
            lng=request.lng,
            reference_date=request.acquiredAt,
        ),

        return_exceptions=True,
    )


    # =====================================================
    # 5. LIVE OSM VALIDATION
    # =====================================================

    if isinstance(
        osm_result,
        BaseException,
    ):

        raise HTTPException(
            status_code=503,
            detail={
                "message":
                    "AI classification is unavailable "
                    "because OSM context lookup failed.",

                "reason":
                    str(
                        osm_result
                    ),
            },
        )


    osm_context = osm_result


    if (
        osm_context.get(
            "lookupStatus"
        )
        !=
        "success"
    ):

        raise HTTPException(
            status_code=503,
            detail={
                "message":
                    "AI classification is unavailable "
                    "because OSM context could not "
                    "be verified.",

                "reason":
                    osm_context.get(
                        "lookupMessage"
                    ),
            },
        )


    industrial_within = (
        1.0
        if osm_context.get(
            "industrialWithin1_5Km"
        )
        is True
        else
        0.0
    )


    natural_within = (
        1.0
        if osm_context.get(
            "naturalWithin1_5Km"
        )
        is True
        else
        0.0
    )


    # =====================================================
    # 6. PERSISTENCE VALIDATION
    # =====================================================

    if isinstance(
        persistence_result,
        BaseException,
    ):

        raise HTTPException(
            status_code=503,
            detail={
                "message":
                    "AI classification is unavailable "
                    "because historical FIRMS "
                    "persistence analysis failed.",

                "reason":
                    str(
                        persistence_result
                    ),
            },
        )


    persistence = persistence_result


    persistence_features = persistence.get(
        "features"
    )


    if not isinstance(
        persistence_features,
        dict,
    ):

        raise HTTPException(
            status_code=503,
            detail={
                "message":
                    "AI classification is unavailable "
                    "because persistence features "
                    "could not be calculated."
            },
        )


    # =====================================================
    # 7. EXACT V3 FEATURES
    # =====================================================

    model_features = build_v3_features(

        current=current,

        persistence_features=
            persistence_features,

        industrial_within=
            industrial_within,

        natural_within=
            natural_within,
    )


    # =====================================================
    # 8. MODEL
    # =====================================================

    try:

        prediction = predict_from_features(
            model_features
        )


    except ValueError as exc:

        raise HTTPException(
            status_code=422,
            detail={
                "message":
                    "Model input validation failed.",

                "reason":
                    str(
                        exc
                    ),
            },
        ) from exc


    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail={
                "message":
                    "AI classification failed.",

                "reason":
                    str(
                        exc
                    ),
            },
        ) from exc


    # =====================================================
    # 9. RESPONSE
    # =====================================================

    acquired_at = current[
        "acquired_at"
    ]


    return {

        "available":
            True,

        "hotspotId":
            request.hotspotId,

        "hotspotName":
            request.hotspotName,


        "coordinates": {

            "lat":
                request.lat,

            "lng":
                request.lng,
        },


        "acquiredAt":
            request.acquiredAt,


        "classification":
            prediction,


        "evidence": {

            "firms": {

                "brightness":
                    current[
                        "brightness"
                    ],

                "frp":
                    current[
                        "frp"
                    ],

                "scan":
                    current[
                        "scan"
                    ],

                "track":
                    current[
                        "track"
                    ],

                "rawConfidence":
                    request.rawConfidence,

                "confidencePercent":
                    current[
                        "confidence_pct"
                    ],

                "dayNight":
                    request.dayNight,

                "hour":
                    acquired_at.hour,

                "month":
                    acquired_at.month,
            },


            "persistence": {

                "currentObservationExcluded":
                    persistence.get(
                        "currentObservationExcluded"
                    ),

                "detections3d":
                    model_features[
                        "detections_3d"
                    ],

                "detections7d":
                    model_features[
                        "detections_7d"
                    ],

                "detections10d":
                    model_features[
                        "detections_10d"
                    ],

                "detections30d":
                    model_features[
                        "detections_30d"
                    ],

                "distinctActiveDays30d":
                    model_features[
                        "distinct_active_days_30d"
                    ],

                "summary":
                    persistence.get(
                        "summary"
                    ),
            },


            "osm": {

                "landType":
                    osm_context.get(
                        "landType"
                    ),

                "nearestIndustrialKm":
                    osm_context.get(
                        "nearestIndustrialKm"
                    ),

                "nearestNaturalKm":
                    osm_context.get(
                        "nearestNaturalKm"
                    ),

                "industrialWithin1_5Km":
                    bool(
                        industrial_within
                    ),

                "naturalWithin1_5Km":
                    bool(
                        natural_within
                    ),

                "lookupStatus":
                    osm_context.get(
                        "lookupStatus"
                    ),
            },
        },


        "modelFeatures":
            model_features,


        "interpretation": (
            "This is an AI contextual classification "
            "based on NASA FIRMS thermal observations, "
            "recent prior thermal activity and "
            "OpenStreetMap context. It is not a "
            "ground-truth incident confirmation."
        ),
    }


# =========================================================
# SINGLE HOTSPOT ENDPOINT
# =========================================================

@router.post("/classify")
async def classify_hotspot(
    request: ClassificationRequest,
):

    return await run_hotspot_classification(
        request
    )


# =========================================================
# LOCAL SCANNER CLASSIFICATION
# =========================================================

async def run_local_scan_classification(
    request: ClassificationRequest,
) -> dict[str, Any]:
    """
    Candidate scanner classification.

    Uses:
        real FIRMS observation
        local India OSM parquet
        real prior FIRMS persistence
        FireWatch XGBoost V3

    Public Overpass is not called.
    """

    # =====================================================
    # 1. MODEL
    # =====================================================

    validate_model_available()


    # =====================================================
    # 2. COORDINATES
    # =====================================================

    validate_coordinates(
        request
    )


    # =====================================================
    # 3. CURRENT FIRMS
    # =====================================================

    current = extract_current_firms_features(
        request
    )


    # =====================================================
    # 4. LOCAL OSM
    # =====================================================

    try:

        osm_context = get_local_osm_context(
            request.lat,
            request.lng,
        )


    except Exception as exc:

        raise HTTPException(
            status_code=503,
            detail={
                "message":
                    "Local OSM context lookup failed.",

                "reason":
                    str(
                        exc
                    ),
            },
        ) from exc


    if (
        osm_context.get(
            "lookupStatus"
        )
        !=
        "success"
    ):

        raise HTTPException(
            status_code=503,
            detail={
                "message":
                    "Local OSM context is unavailable.",

                "reason":
                    osm_context.get(
                        "lookupMessage"
                    ),
            },
        )


    industrial_within = (
        1.0
        if osm_context.get(
            "industrialWithin1_5Km"
        )
        is True
        else
        0.0
    )


    natural_within = (
        1.0
        if osm_context.get(
            "naturalWithin1_5Km"
        )
        is True
        else
        0.0
    )


    # =====================================================
    # 5. REAL FIRMS PERSISTENCE
    # =====================================================

    try:

        persistence = await get_persistence_analysis(

            lat=request.lat,

            lng=request.lng,

            reference_date=
                request.acquiredAt,
        )


    except Exception as exc:

        raise HTTPException(
            status_code=503,
            detail={
                "message":
                    "Historical FIRMS persistence "
                    "analysis failed.",

                "reason":
                    str(
                        exc
                    ),
            },
        ) from exc


    persistence_features = persistence.get(
        "features"
    )


    if not isinstance(
        persistence_features,
        dict,
    ):

        raise HTTPException(
            status_code=503,
            detail=(
                "Persistence features could not "
                "be calculated."
            ),
        )


    # =====================================================
    # 6. EXACT V3 FEATURES
    # =====================================================

    model_features = build_v3_features(

        current=current,

        persistence_features=
            persistence_features,

        industrial_within=
            industrial_within,

        natural_within=
            natural_within,
    )


    # =====================================================
    # 7. MODEL
    # =====================================================

    try:

        prediction = predict_from_features(
            model_features
        )


    except ValueError as exc:

        raise HTTPException(
            status_code=422,
            detail={
                "message":
                    "Model input validation failed.",

                "reason":
                    str(
                        exc
                    ),
            },
        ) from exc


    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail={
                "message":
                    "AI classification failed.",

                "reason":
                    str(
                        exc
                    ),
            },
        ) from exc


    # =====================================================
    # 8. RETURN SCAN EVIDENCE
    # =====================================================

    return {

        "classification":
            prediction,


        "modelFeatures":
            model_features,


        "osm": {

            "source":
                osm_context.get(
                    "source"
                ),

            "nearestIndustrialKm":
                osm_context.get(
                    "nearestIndustrialKm"
                ),

            "nearestNaturalKm":
                osm_context.get(
                    "nearestNaturalKm"
                ),

            "industrialWithin1_5Km":
                bool(
                    industrial_within
                ),

            "naturalWithin1_5Km":
                bool(
                    natural_within
                ),

            "nearestIndustrialFeature":
                osm_context.get(
                    "nearestIndustrialFeature"
                ),

            "nearestNaturalFeature":
                osm_context.get(
                    "nearestNaturalFeature"
                ),
        },


        "persistence": {

            "currentObservationExcluded":
                persistence.get(
                    "currentObservationExcluded"
                ),

            "detections3d":
                model_features[
                    "detections_3d"
                ],

            "detections7d":
                model_features[
                    "detections_7d"
                ],

            "detections10d":
                model_features[
                    "detections_10d"
                ],

            "detections30d":
                model_features[
                    "detections_30d"
                ],

            "distinctActiveDays30d":
                model_features[
                    "distinct_active_days_30d"
                ],
        },
    }


# =========================================================
# DEVELOPMENT BATCH SCANNER
# =========================================================

@router.post("/scan")
async def scan_hotspots(
    request: BatchClassificationRequest,
):
    """
    Fast development candidate scanner.

    OSM:
        local India OpenStreetMap-derived dataset.

    FIRMS:
        real NASA FIRMS observation.

    Persistence:
        real prior NASA FIRMS observations.

    Model:
        FireWatch XGBoost V3.

    This endpoint does not modify model labels.
    """

    # =====================================================
    # REQUEST VALIDATION
    # =====================================================

    if not request.hotspots:

        raise HTTPException(
            status_code=400,
            detail="No hotspots supplied",
        )


    if len(
        request.hotspots
    ) > 100:

        raise HTTPException(
            status_code=400,
            detail=(
                "Maximum 100 hotspots can be scanned "
                "in one request."
            ),
        )


    # =====================================================
    # LOCAL OSM STATUS
    # =====================================================

    local_osm_status = get_local_osm_status()


    if not local_osm_status.get(
        "available"
    ):

        raise HTTPException(
            status_code=503,
            detail={
                "message":
                    "Local OSM scanner is unavailable.",

                "status":
                    local_osm_status,
            },
        )


    results: list[
        dict[str, Any]
    ] = []


    # =====================================================
    # PROCESS
    # =====================================================
    #
    # OSM is local, therefore no Overpass sleep/retry.
    #
    # Persistence still performs real FIRMS historical
    # analysis.
    # =====================================================

    for index, hotspot in enumerate(
        request.hotspots,
        start=1,
    ):

        try:

            result = await run_local_scan_classification(
                hotspot
            )


            classification = (
                result.get(
                    "classification"
                )
                or
                {}
            )


            osm = (
                result.get(
                    "osm"
                )
                or
                {}
            )


            persistence = (
                result.get(
                    "persistence"
                )
                or
                {}
            )


            results.append(
                {

                    "index":
                        index,

                    "success":
                        True,


                    # =====================================
                    # HOTSPOT
                    # =====================================

                    "hotspotId":
                        hotspot.hotspotId,

                    "hotspotName":
                        hotspot.hotspotName,

                    "lat":
                        hotspot.lat,

                    "lng":
                        hotspot.lng,

                    "acquiredAt":
                        hotspot.acquiredAt,


                    # =====================================
                    # CLASSIFICATION
                    # =====================================

                    "label":
                        classification.get(
                            "label"
                        ),

                    "displayLabel":
                        classification.get(
                            "displayLabel"
                        ),

                    "confidence":
                        classification.get(
                            "confidence"
                        ),

                    "confidencePercent":
                        classification.get(
                            "confidencePercent"
                        ),

                    "requiresVerification":
                        classification.get(
                            "requiresVerification"
                        ),


                    # =====================================
                    # OSM
                    # =====================================

                    "osmSource":
                        osm.get(
                            "source"
                        ),

                    "nearestIndustrialKm":
                        osm.get(
                            "nearestIndustrialKm"
                        ),

                    "nearestNaturalKm":
                        osm.get(
                            "nearestNaturalKm"
                        ),

                    "industrialWithin1_5Km":
                        osm.get(
                            "industrialWithin1_5Km"
                        ),

                    "naturalWithin1_5Km":
                        osm.get(
                            "naturalWithin1_5Km"
                        ),

                    "nearestIndustrialFeature":
                        osm.get(
                            "nearestIndustrialFeature"
                        ),

                    "nearestNaturalFeature":
                        osm.get(
                            "nearestNaturalFeature"
                        ),


                    # =====================================
                    # PERSISTENCE
                    # =====================================

                    "detections30d":
                        persistence.get(
                            "detections30d"
                        ),

                    "distinctActiveDays30d":
                        persistence.get(
                            "distinctActiveDays30d"
                        ),

                    "currentObservationExcluded":
                        persistence.get(
                            "currentObservationExcluded"
                        ),
                }
            )


        except HTTPException as exc:

            results.append(
                {

                    "index":
                        index,

                    "success":
                        False,

                    "hotspotId":
                        hotspot.hotspotId,

                    "hotspotName":
                        hotspot.hotspotName,

                    "lat":
                        hotspot.lat,

                    "lng":
                        hotspot.lng,

                    "errorStatus":
                        exc.status_code,

                    "error":
                        exc.detail,
                }
            )


        except Exception as exc:

            results.append(
                {

                    "index":
                        index,

                    "success":
                        False,

                    "hotspotId":
                        hotspot.hotspotId,

                    "hotspotName":
                        hotspot.hotspotName,

                    "lat":
                        hotspot.lat,

                    "lng":
                        hotspot.lng,

                    "errorStatus":
                        500,

                    "error":
                        str(
                            exc
                        ),
                }
            )


    # =====================================================
    # SUCCESS / FAILURE
    # =====================================================

    successful = [

        item

        for item in results

        if item.get(
            "success"
        )
    ]


    failed = [

        item

        for item in results

        if not item.get(
            "success"
        )
    ]


    # =====================================================
    # CLASS GROUPS
    # =====================================================

    groups = {

        "industrial_fire_candidate":
            [],

        "natural_or_vegetation_fire":
            [],

        "persistent_industrial_thermal_source":
            [],

        "other_uncertain":
            [],
    }


    for item in successful:

        label = item.get(
            "label"
        )


        if label in groups:

            groups[
                label
            ].append(
                item
            )


    # =====================================================
    # SORT CONFIDENCE
    # =====================================================

    for label in groups:

        groups[
            label
        ].sort(

            key=lambda item:
                float(
                    item.get(
                        "confidence"
                    )
                    or
                    0
                ),

            reverse=True,
        )


    # =====================================================
    # TARGET CANDIDATES
    # =====================================================

    target_candidates = (

        groups[
            "industrial_fire_candidate"
        ]

        +

        groups[
            "persistent_industrial_thermal_source"
        ]
    )


    target_candidates.sort(

        key=lambda item:
            float(
                item.get(
                    "confidence"
                )
                or
                0
            ),

        reverse=True,
    )


    # =====================================================
    # RESPONSE
    # =====================================================

    return {

        "scanType":
            "Local OSM FireWatch V3 candidate scan",

        "osmMode":
            "local",

        "osmDataset":
            local_osm_status.get(
                "source"
            ),

        "osmSearchRadiusKm":
            1.5,


        "totalRequested":
            len(
                request.hotspots
            ),

        "successful":
            len(
                successful
            ),

        "failed":
            len(
                failed
            ),


        "classCounts": {

            label:
                len(
                    items
                )

            for label, items
            in groups.items()
        },


        "targetFound":
            (
                len(
                    target_candidates
                )
                >
                0
            ),


        "targetCandidates":
            target_candidates,


        "groups":
            groups,


        "failures":
            failed,


        "note": (
            "Development candidate scan using real "
            "NASA FIRMS observations, prior FIRMS "
            "persistence, local OpenStreetMap-derived "
            "context and the FireWatch XGBoost V3 model. "
            "Industrial-fire outputs are candidates "
            "requiring additional verification."
        ),
    }