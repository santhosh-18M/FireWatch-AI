from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import joblib
import numpy as np


# =========================================================
# MODEL PATHS
# =========================================================

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_DIR = (
    BASE_DIR
    / "models"
    / "classification_model"
)

MODEL_PATH = (
    MODEL_DIR
    / "firewatch_xgb_v3_precision.joblib"
)

FEATURES_PATH = (
    MODEL_DIR
    / "feature_columns_v3_precision.json"
)

CLASSES_PATH = (
    MODEL_DIR
    / "label_classes_v3_precision.json"
)


# =========================================================
# MODEL INFORMATION
# =========================================================

MODEL_NAME = (
    "FireWatch XGBoost V3 Precision Deployment"
)

MODEL_VERSION = "v3-precision"


EXPECTED_FEATURES = [
    "brightness",
    "frp",
    "scan",
    "track",
    "hour",
    "month",
    "confidence_pct",
    "daynight_num",
    "detections_3d",
    "detections_7d",
    "detections_10d",
    "detections_30d",
    "distinct_active_days_30d",
    "industrial_within_1_5km",
    "natural_within_1_5km",
]


EXPECTED_CLASSES = {
    "industrial_fire_candidate",
    "natural_or_vegetation_fire",
    "other_uncertain",
    "persistent_industrial_thermal_source",
}


DISPLAY_LABELS = {

    "industrial_fire_candidate":
        "Industrial Fire Candidate",

    "natural_or_vegetation_fire":
        "Natural / Vegetation Fire",

    "other_uncertain":
        "Other / Uncertain",

    "persistent_industrial_thermal_source":
        "Persistent Industrial Thermal Source",
}


# =========================================================
# GLOBAL MODEL STATE
# =========================================================

_model = None

_feature_columns: list[str] = []

_label_classes: list[str] = []

_load_error: str | None = None


# =========================================================
# LOAD MODEL
# =========================================================

def _load_model() -> None:

    global _model
    global _feature_columns
    global _label_classes
    global _load_error

    try:

        # -------------------------------------------------
        # FILE CHECKS
        # -------------------------------------------------

        if not MODEL_PATH.exists():

            raise FileNotFoundError(
                f"Model file not found: {MODEL_PATH}"
            )

        if not FEATURES_PATH.exists():

            raise FileNotFoundError(
                f"Feature file not found: {FEATURES_PATH}"
            )

        if not CLASSES_PATH.exists():

            raise FileNotFoundError(
                f"Class file not found: {CLASSES_PATH}"
            )


        # -------------------------------------------------
        # LOAD XGBOOST MODEL
        # -------------------------------------------------

        _model = joblib.load(
            MODEL_PATH
        )


        # -------------------------------------------------
        # LOAD FEATURE LIST
        # -------------------------------------------------

        with open(
            FEATURES_PATH,
            "r",
            encoding="utf-8",
        ) as file:

            _feature_columns = json.load(
                file
            )


        # -------------------------------------------------
        # LOAD CLASS LIST
        # -------------------------------------------------

        with open(
            CLASSES_PATH,
            "r",
            encoding="utf-8",
        ) as file:

            _label_classes = json.load(
                file
            )


        # -------------------------------------------------
        # VALIDATE FEATURES
        # -------------------------------------------------

        if not isinstance(
            _feature_columns,
            list,
        ):

            raise ValueError(
                "Feature JSON must contain a list"
            )


        if len(
            _feature_columns
        ) != 15:

            raise ValueError(
                "Deployment model must contain "
                "exactly 15 features"
            )


        if (
            _feature_columns
            !=
            EXPECTED_FEATURES
        ):

            raise ValueError(
                "Deployment feature order does not "
                "match expected FireWatch V3 features"
            )


        # -------------------------------------------------
        # VALIDATE CLASSES
        # -------------------------------------------------

        if not isinstance(
            _label_classes,
            list,
        ):

            raise ValueError(
                "Class JSON must contain a list"
            )


        if (
            set(_label_classes)
            !=
            EXPECTED_CLASSES
        ):

            raise ValueError(
                "Deployment class labels do not "
                "match expected FireWatch classes"
            )


        _load_error = None


    except Exception as exc:

        _model = None

        _feature_columns = []

        _label_classes = []

        _load_error = str(exc)


# Load once when backend starts.
_load_model()


# =========================================================
# MODEL STATUS
# =========================================================

def get_model_status() -> dict[str, Any]:

    return {

        "available":
            _model is not None,

        "model":
            MODEL_NAME,

        "modelVersion":
            MODEL_VERSION,

        "featureCount":
            len(
                _feature_columns
            ),

        "classes":
            _label_classes,

        "error":
            _load_error,

        "labelType":
            "contextual_weak_labels",

        "note": (
            "The model uses live-reproducible FIRMS "
            "thermal, recent persistence and OSM "
            "contextual features. Industrial-fire output "
            "is an AI candidate requiring contextual or "
            "satellite verification."
        ),
    }


# =========================================================
# REQUIRED FEATURES
# =========================================================

def get_required_features() -> list[str]:

    return list(
        _feature_columns
    )


# =========================================================
# FEATURE VALIDATION
# =========================================================

def _validate_features(
    features: dict[str, Any],
) -> list[float]:

    if _model is None:

        raise RuntimeError(
            "Classification model is unavailable: "
            f"{_load_error}"
        )


    values: list[float] = []


    for feature_name in _feature_columns:

        if feature_name not in features:

            raise ValueError(
                f"Missing required feature: "
                f"{feature_name}"
            )


        raw_value = features[
            feature_name
        ]


        if raw_value is None:

            raise ValueError(
                f"Feature '{feature_name}' "
                "cannot be null"
            )


        try:

            numeric_value = float(
                raw_value
            )

        except (
            TypeError,
            ValueError,
        ) as exc:

            raise ValueError(
                f"Feature '{feature_name}' "
                "must be numeric"
            ) from exc


        if not math.isfinite(
            numeric_value
        ):

            raise ValueError(
                f"Feature '{feature_name}' "
                "must be finite"
            )


        values.append(
            numeric_value
        )


    return values


# =========================================================
# PREDICTION
# =========================================================

def predict_from_features(
    features: dict[str, Any],
) -> dict[str, Any]:

    values = _validate_features(
        features
    )


    matrix = np.array(
        [values],
        dtype=float,
    )


    predicted_raw = _model.predict(
        matrix
    )[0]


    probabilities = _model.predict_proba(
        matrix
    )[0]


    # XGBoost normally returns integer encoded class.
    try:

        predicted_index = int(
            predicted_raw
        )

    except (
        TypeError,
        ValueError,
    ) as exc:

        raise RuntimeError(
            "Model returned an invalid class index"
        ) from exc


    if not (
        0
        <=
        predicted_index
        <
        len(_label_classes)
    ):

        raise RuntimeError(
            "Model returned class index outside "
            "the configured label range"
        )


    label = _label_classes[
        predicted_index
    ]


    confidence = float(
        probabilities[
            predicted_index
        ]
    )


    probability_map: dict[
        str,
        float,
    ] = {}


    for index, probability in enumerate(
        probabilities
    ):

        if index >= len(
            _label_classes
        ):
            break

        class_name = _label_classes[
            index
        ]

        probability_map[
            class_name
        ] = round(
            float(
                probability
            ),
            6,
        )


    requires_verification = (
        label
        ==
        "industrial_fire_candidate"
    )


    return {

        "label":
            label,

        "displayLabel":
            DISPLAY_LABELS.get(
                label,
                label,
            ),

        "confidence":
            round(
                confidence,
                6,
            ),

        "confidencePercent":
            round(
                confidence
                *
                100,
                1,
            ),

        "probabilities":
            probability_map,

        "model":
            MODEL_NAME,

        "modelVersion":
            MODEL_VERSION,

        "labelType":
            "contextual_weak_labels",

        "requiresVerification":
            requires_verification,

        "note": (
            "Model confidence is relative to contextual "
            "weak-label classes and is not a calibrated "
            "real-world probability of an industrial fire."
        ),
    }