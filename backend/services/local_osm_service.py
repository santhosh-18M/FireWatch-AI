from __future__ import annotations

import logging
import math
import os
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.neighbors import BallTree


logger = logging.getLogger(__name__)


# =========================================================
# CONFIGURATION
# =========================================================

SEARCH_RADIUS_KM = 1.5

EARTH_RADIUS_KM = 6371.0088


DEFAULT_OSM_FILE = Path(
    r"D:\FireWatch_ML\data\processed\osm_context_features.parquet"
)


OSM_FILE = Path(
    os.getenv(
        "FIREWATCH_LOCAL_OSM_FILE",
        str(DEFAULT_OSM_FILE),
    )
)


# =========================================================
# INTERNAL STATE
# =========================================================

_loaded = False

_load_error: str | None = None


_industrial_df: pd.DataFrame | None = None

_natural_df: pd.DataFrame | None = None


_industrial_tree: BallTree | None = None

_natural_tree: BallTree | None = None


# =========================================================
# HAVERSINE
# =========================================================

def haversine_distance_km(
    lat1: float,
    lng1: float,
    lat2: float,
    lng2: float,
) -> float:

    lat1_r = math.radians(lat1)
    lng1_r = math.radians(lng1)

    lat2_r = math.radians(lat2)
    lng2_r = math.radians(lng2)


    dlat = lat2_r - lat1_r
    dlng = lng2_r - lng1_r


    a = (
        math.sin(dlat / 2.0) ** 2
        +
        math.cos(lat1_r)
        *
        math.cos(lat2_r)
        *
        math.sin(dlng / 2.0) ** 2
    )


    a = min(
        1.0,
        max(
            0.0,
            a,
        ),
    )


    return (
        2.0
        *
        EARTH_RADIUS_KM
        *
        math.asin(
            math.sqrt(a)
        )
    )


# =========================================================
# LOAD LOCAL OSM
# =========================================================

def _load_local_osm() -> None:

    global _loaded
    global _load_error

    global _industrial_df
    global _natural_df

    global _industrial_tree
    global _natural_tree


    if _loaded:

        return


    logger.info(
        "Loading local FireWatch OSM context from %s",
        OSM_FILE,
    )


    if not OSM_FILE.exists():

        _load_error = (
            f"Local OSM context file not found: "
            f"{OSM_FILE}"
        )

        logger.error(
            _load_error
        )

        _loaded = True

        return


    try:

        columns = [
            "osm_type",
            "osm_id",
            "latitude",
            "longitude",
            "context_class",
            "feature_type",
            "name",
        ]


        df = pd.read_parquet(
            OSM_FILE,
            columns=columns,
        )


        # =================================================
        # CLEAN COORDINATES
        # =================================================

        df["latitude"] = pd.to_numeric(
            df["latitude"],
            errors="coerce",
        )

        df["longitude"] = pd.to_numeric(
            df["longitude"],
            errors="coerce",
        )


        df = df.dropna(
            subset=[
                "latitude",
                "longitude",
                "context_class",
            ]
        ).copy()


        df = df[
            df["latitude"].between(
                -90,
                90,
            )
            &
            df["longitude"].between(
                -180,
                180,
            )
        ].copy()


        df["context_class"] = (
            df["context_class"]
            .astype(str)
            .str.strip()
            .str.lower()
        )


        # =================================================
        # INDUSTRIAL / NATURAL SPLIT
        # =================================================

        _industrial_df = (
            df[
                df["context_class"]
                ==
                "industrial"
            ]
            .reset_index(
                drop=True
            )
        )


        _natural_df = (
            df[
                df["context_class"]
                ==
                "natural"
            ]
            .reset_index(
                drop=True
            )
        )


        if _industrial_df.empty:

            raise RuntimeError(
                "Local OSM dataset contains "
                "no industrial features"
            )


        if _natural_df.empty:

            raise RuntimeError(
                "Local OSM dataset contains "
                "no natural features"
            )


        # =================================================
        # BALLTREE INPUT
        # =================================================
        #
        # BallTree haversine expects:
        # [latitude radians, longitude radians]
        # =================================================

        industrial_coordinates = np.radians(

            _industrial_df[
                [
                    "latitude",
                    "longitude",
                ]
            ].to_numpy(
                dtype=float
            )

        )


        natural_coordinates = np.radians(

            _natural_df[
                [
                    "latitude",
                    "longitude",
                ]
            ].to_numpy(
                dtype=float
            )

        )


        # =================================================
        # CREATE INDEX
        # =================================================

        _industrial_tree = BallTree(
            industrial_coordinates,
            metric="haversine",
        )


        _natural_tree = BallTree(
            natural_coordinates,
            metric="haversine",
        )


        _load_error = None

        _loaded = True


        logger.info(
            "Local OSM loaded: "
            "%s industrial features, "
            "%s natural features",
            len(
                _industrial_df
            ),
            len(
                _natural_df
            ),
        )


    except Exception as exc:

        _load_error = (
            f"Failed to load local OSM context: "
            f"{exc}"
        )


        logger.exception(
            _load_error
        )


        _loaded = True


# =========================================================
# NEAREST FEATURE
# =========================================================

def _nearest_feature(
    tree: BallTree,
    dataframe: pd.DataFrame,
    lat: float,
    lng: float,
) -> dict[str, Any]:

    point = np.radians(
        np.array(
            [
                [
                    lat,
                    lng,
                ]
            ],
            dtype=float,
        )
    )


    distances_rad, indices = tree.query(
        point,
        k=1,
    )


    distance_km = (
        float(
            distances_rad[
                0,
                0,
            ]
        )
        *
        EARTH_RADIUS_KM
    )


    row_index = int(
        indices[
            0,
            0,
        ]
    )


    row = dataframe.iloc[
        row_index
    ]


    name = row.get(
        "name"
    )


    if pd.isna(
        name
    ):

        name = None


    return {
        "distanceKm":
            round(
                distance_km,
                3,
            ),

        "featureType":
            (
                None
                if pd.isna(
                    row.get(
                        "feature_type"
                    )
                )
                else str(
                    row.get(
                        "feature_type"
                    )
                )
            ),

        "name":
            (
                None
                if name is None
                else str(
                    name
                )
            ),

        "osmType":
            (
                None
                if pd.isna(
                    row.get(
                        "osm_type"
                    )
                )
                else str(
                    row.get(
                        "osm_type"
                    )
                )
            ),

        "osmId":
            (
                None
                if pd.isna(
                    row.get(
                        "osm_id"
                    )
                )
                else str(
                    row.get(
                        "osm_id"
                    )
                )
            ),

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


# =========================================================
# PUBLIC STATUS
# =========================================================

def get_local_osm_status() -> dict[str, Any]:

    _load_local_osm()


    return {
        "available":
            (
                _load_error
                is None
            ),

        "source":
            str(
                OSM_FILE
            ),

        "searchRadiusKm":
            SEARCH_RADIUS_KM,

        "industrialFeatureCount":
            (
                0
                if _industrial_df is None
                else len(
                    _industrial_df
                )
            ),

        "naturalFeatureCount":
            (
                0
                if _natural_df is None
                else len(
                    _natural_df
                )
            ),

        "error":
            _load_error,
    }


# =========================================================
# PUBLIC LOOKUP
# =========================================================

def get_local_osm_context(
    lat: float,
    lng: float,
) -> dict[str, Any]:

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


    _load_local_osm()


    if (
        _load_error is not None
        or
        _industrial_tree is None
        or
        _natural_tree is None
        or
        _industrial_df is None
        or
        _natural_df is None
    ):

        return {
            "available":
                False,

            "lookupStatus":
                "unavailable",

            "lookupMessage":
                _load_error,

            "source":
                "Local OSM parquet",

            "industrialWithin1_5Km":
                None,

            "naturalWithin1_5Km":
                None,

            "nearestIndustrialKm":
                None,

            "nearestNaturalKm":
                None,

            "nearestIndustrialFeature":
                None,

            "nearestNaturalFeature":
                None,
        }


    industrial = _nearest_feature(

        tree=_industrial_tree,

        dataframe=_industrial_df,

        lat=lat,

        lng=lng,
    )


    natural = _nearest_feature(

        tree=_natural_tree,

        dataframe=_natural_df,

        lat=lat,

        lng=lng,
    )


    industrial_distance = float(
        industrial[
            "distanceKm"
        ]
    )


    natural_distance = float(
        natural[
            "distanceKm"
        ]
    )


    return {
        "available":
            True,

        "lookupStatus":
            "success",

        "lookupMessage":
            None,

        "source":
            "Local OSM parquet",

        "searchRadiusKm":
            SEARCH_RADIUS_KM,

        "nearestIndustrialKm":
            industrial_distance,

        "nearestNaturalKm":
            natural_distance,

        "industrialWithin1_5Km":
            (
                industrial_distance
                <=
                SEARCH_RADIUS_KM
            ),

        "naturalWithin1_5Km":
            (
                natural_distance
                <=
                SEARCH_RADIUS_KM
            ),

        "nearestIndustrialFeature":
            industrial,

        "nearestNaturalFeature":
            natural,
    }