import asyncio
import os

from datetime import (
    datetime,
    timedelta,
    timezone,
)

from typing import Optional

import httpx

from dotenv import load_dotenv


load_dotenv()


# ========================================================
# COPERNICUS ENDPOINTS
# ========================================================

TOKEN_URL = (
    "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/"
    "protocol/openid-connect/token"
)

STAC_SEARCH_URL = (
    "https://stac.dataspace.copernicus.eu/v1/search"
)

STATISTICS_URL = (
    "https://sh.dataspace.copernicus.eu/statistics/v1"
)

PROCESS_URL = (
    "https://sh.dataspace.copernicus.eu/process/v1"
)


COLLECTION = "sentinel-2-l2a"

SEARCH_DAYS = 7


# Around 1 km x 1 km local area around FIRMS hotspot.
LOCAL_PADDING = 0.005


# ========================================================
# RETRY SETTINGS
# ========================================================

MAX_RETRIES = 3

RETRY_STATUS_CODES = {
    429,
    500,
    502,
    503,
    504,
}


# ========================================================
# HTTP POST WITH RETRY
# ========================================================

async def post_with_retry(
    url: str,
    *,
    headers=None,
    data=None,
    json=None,
    timeout: int = 40,
) -> httpx.Response:

    last_error = None


    for attempt in range(
        1,
        MAX_RETRIES + 1,
    ):

        try:

            async with httpx.AsyncClient(
                timeout=timeout
            ) as client:

                response = await client.post(
                    url,
                    headers=headers,
                    data=data,
                    json=json,
                )


            # --------------------------------------------
            # TEMPORARY HTTP FAILURE
            # --------------------------------------------

            if (
                response.status_code
                in RETRY_STATUS_CODES
            ):

                if attempt < MAX_RETRIES:

                    wait_seconds = (
                        1.5 * attempt
                    )


                    print(
                        "[Sentinel] Temporary "
                        f"HTTP {response.status_code} "
                        f"from {url}. "
                        f"Retry {attempt}/{MAX_RETRIES} "
                        f"in {wait_seconds:.1f}s"
                    )


                    await asyncio.sleep(
                        wait_seconds
                    )


                    continue


            # 400 / 401 / 403 etc. are not
            # automatically retried.
            response.raise_for_status()


            return response


        except (
            httpx.ConnectError,
            httpx.ReadTimeout,
            httpx.ConnectTimeout,
            httpx.WriteTimeout,
            httpx.PoolTimeout,
            httpx.RemoteProtocolError,
        ) as exc:

            last_error = exc


            if attempt < MAX_RETRIES:

                wait_seconds = (
                    1.5 * attempt
                )


                print(
                    "[Sentinel] Temporary "
                    f"network error: "
                    f"{type(exc).__name__}. "
                    f"Retry {attempt}/{MAX_RETRIES} "
                    f"in {wait_seconds:.1f}s"
                )


                await asyncio.sleep(
                    wait_seconds
                )


                continue


            raise


        except httpx.HTTPStatusError as exc:

            last_error = exc


            status_code = (
                exc.response.status_code
            )


            if (
                status_code
                in RETRY_STATUS_CODES
                and attempt < MAX_RETRIES
            ):

                wait_seconds = (
                    1.5 * attempt
                )


                print(
                    "[Sentinel] Temporary "
                    f"HTTP {status_code}. "
                    f"Retry {attempt}/{MAX_RETRIES} "
                    f"in {wait_seconds:.1f}s"
                )


                await asyncio.sleep(
                    wait_seconds
                )


                continue


            raise


    if last_error:

        raise last_error


    raise RuntimeError(
        "Copernicus request failed"
    )


# ========================================================
# DATE PARSING
# ========================================================

def parse_reference_date(
    reference_date: Optional[str],
) -> datetime:

    if not reference_date:

        return datetime.now(
            timezone.utc
        )


    value = (
        reference_date.strip()
    )


    if value.endswith("Z"):

        value = (
            value[:-1]
            +
            "+00:00"
        )


    try:

        dt = datetime.fromisoformat(
            value
        )


        if dt.tzinfo is None:

            dt = dt.replace(
                tzinfo=timezone.utc
            )


        return dt.astimezone(
            timezone.utc
        )


    except ValueError:

        try:

            return datetime.strptime(
                reference_date,
                "%Y-%m-%d",
            ).replace(
                tzinfo=timezone.utc
            )


        except ValueError as exc:

            raise ValueError(
                "reference_date must be YYYY-MM-DD "
                "or an ISO timestamp"
            ) from exc


# ========================================================
# ACCESS TOKEN
# ========================================================

async def get_access_token() -> str:

    client_id = os.getenv(
        "COPERNICUS_CLIENT_ID"
    )

    client_secret = os.getenv(
        "COPERNICUS_CLIENT_SECRET"
    )


    if (
        not client_id
        or not client_secret
    ):

        raise RuntimeError(
            "Copernicus credentials are missing"
        )


    response = await post_with_retry(
        TOKEN_URL,
        data={
            "grant_type":
                "client_credentials",

            "client_id":
                client_id,

            "client_secret":
                client_secret,
        },
        timeout=30,
    )


    token = (
        response
        .json()
        .get("access_token")
    )


    if not token:

        raise RuntimeError(
            "Copernicus access token "
            "was not returned"
        )


    return token


# ========================================================
# SEARCH SENTINEL-2
# ========================================================

async def search_sentinel2(
    lat: float,
    lng: float,
    reference_date: Optional[str] = None,
    search_days: int = SEARCH_DAYS,
):

    reference_dt = (
        parse_reference_date(
            reference_date
        )
    )


    start_dt = (
        reference_dt
        -
        timedelta(
            days=search_days
        )
    )


    end_dt = (
        reference_dt
        +
        timedelta(
            days=search_days
        )
    )


    padding = 0.01


    bbox = [
        lng - padding,
        lat - padding,
        lng + padding,
        lat + padding,
    ]


    payload = {

        "collections": [
            COLLECTION
        ],

        "bbox":
            bbox,

        "datetime": (
            f"{start_dt.isoformat().replace('+00:00', 'Z')}/"
            f"{end_dt.isoformat().replace('+00:00', 'Z')}"
        ),

        "limit":
            20,
    }


    response = await post_with_retry(
        STAC_SEARCH_URL,
        json=payload,
        timeout=40,
    )


    data = response.json()


    results = []


    for feature in data.get(
        "features",
        [],
    ):

        properties = (
            feature.get(
                "properties",
                {},
            )
        )


        scene_datetime = (
            properties.get(
                "datetime"
            )
        )


        if not scene_datetime:

            continue


        try:

            scene_dt = (
                parse_reference_date(
                    scene_datetime
                )
            )


            difference_days = abs(
                (
                    scene_dt.date()
                    -
                    reference_dt.date()
                ).days
            )


        except ValueError:

            difference_days = 999


        cloud_cover = (
            properties.get(
                "eo:cloud_cover"
            )
        )


        results.append(
            {
                "id":
                    feature.get("id"),

                "datetime":
                    scene_datetime,

                "cloudCover":
                    cloud_cover,

                "platform":
                    properties.get(
                        "platform"
                    ),

                "constellation":
                    properties.get(
                        "constellation"
                    ),

                "differenceDays":
                    difference_days,

                "geometry":
                    feature.get(
                        "geometry"
                    ),

                "bbox":
                    feature.get(
                        "bbox"
                    ),
            }
        )


    return {

        "available":
            len(results) > 0,

        "referenceDate":
            reference_dt,

        "results":
            results,
    }


# ========================================================
# NDVI STATISTICS
# ========================================================

async def get_ndvi_statistics(
    lat: float,
    lng: float,
    acquisition_date: str,
):

    token = await get_access_token()


    bbox = [
        lng - LOCAL_PADDING,
        lat - LOCAL_PADDING,
        lng + LOCAL_PADDING,
        lat + LOCAL_PADDING,
    ]


    date_value = (
        acquisition_date[:10]
    )


    start_dt = datetime.strptime(
        date_value,
        "%Y-%m-%d",
    ).replace(
        tzinfo=timezone.utc
    )


    end_dt = (
        start_dt
        +
        timedelta(
            days=1
        )
    )


    start_iso = (
        start_dt
        .isoformat()
        .replace(
            "+00:00",
            "Z",
        )
    )


    end_iso = (
        end_dt
        .isoformat()
        .replace(
            "+00:00",
            "Z",
        )
    )


    evalscript = """
    //VERSION=3

    function setup() {
        return {
            input: [{
                bands: [
                    "B04",
                    "B08",
                    "SCL",
                    "dataMask"
                ]
            }],
            output: [
                {
                    id: "ndvi",
                    bands: 1,
                    sampleType: "FLOAT32"
                },
                {
                    id: "dataMask",
                    bands: 1
                }
            ]
        };
    }

    function evaluatePixel(sample) {

        let denominator =
            sample.B08 + sample.B04;

        let validNDVI =
            denominator !== 0;

        let ndvi = validNDVI
            ? (sample.B08 - sample.B04)
                / denominator
            : 0;

        let clearPixel =
            sample.SCL !== 0 &&
            sample.SCL !== 1 &&
            sample.SCL !== 3 &&
            sample.SCL !== 8 &&
            sample.SCL !== 9 &&
            sample.SCL !== 10 &&
            sample.SCL !== 11;

        let valid =
            sample.dataMask === 1 &&
            validNDVI &&
            clearPixel;

        return {
            ndvi: [ndvi],
            dataMask: [valid ? 1 : 0]
        };
    }
    """


    payload = {

        "input": {

            "bounds": {

                "bbox":
                    bbox,

                "properties": {

                    "crs":
                        "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
                },
            },


            "data": [
                {
                    "type":
                        "sentinel-2-l2a",

                    "dataFilter": {

                        "timeRange": {

                            "from":
                                start_iso,

                            "to":
                                end_iso,
                        },

                        "mosaickingOrder":
                            "leastCC",
                    },
                }
            ],
        },


        "aggregation": {

            "timeRange": {

                "from":
                    start_iso,

                "to":
                    end_iso,
            },


            "aggregationInterval": {

                "of":
                    "P1D"
            },


            "evalscript":
                evalscript,


            "resx":
                0.0001,

            "resy":
                0.0001,
        },
    }


    headers = {

        "Authorization":
            f"Bearer {token}",

        "Content-Type":
            "application/json",

        "Accept":
            "application/json",
    }


    response = await post_with_retry(
        STATISTICS_URL,
        headers=headers,
        json=payload,
        timeout=45,
    )


    data = response.json()


    intervals = data.get(
        "data",
        [],
    )


    if not intervals:

        return {

            "available":
                False,

            "meanNdvi":
                None,

            "validPixels":
                0,

            "sampleCount":
                0,

            "excludedPixels":
                0,

            "usablePixelPercentage":
                0.0,

            "message":
                "No Sentinel-2 statistics were returned.",
        }


    try:

        stats = (
            intervals[0]
            ["outputs"]
            ["ndvi"]
            ["bands"]
            ["B0"]
            ["stats"]
        )


        sample_count = int(
            stats.get(
                "sampleCount",
                0,
            )
        )


        no_data_count = int(
            stats.get(
                "noDataCount",
                0,
            )
        )


        valid_pixels = max(
            sample_count
            -
            no_data_count,
            0,
        )


        usable_percentage = (

            (
                valid_pixels
                /
                sample_count
            )
            *
            100

            if sample_count > 0

            else 0
        )


        if valid_pixels == 0:

            return {

                "available":
                    False,

                "meanNdvi":
                    None,

                "validPixels":
                    0,

                "sampleCount":
                    sample_count,

                "excludedPixels":
                    no_data_count,

                "usablePixelPercentage":
                    0.0,

                "message":
                    "No clear usable pixels were available.",
            }


        mean_ndvi = (
            stats.get(
                "mean"
            )
        )


        return {

            "available":
                True,


            "meanNdvi": (

                round(
                    float(mean_ndvi),
                    3,
                )

                if mean_ndvi is not None

                else None
            ),


            "minimumNdvi": (

                round(
                    float(
                        stats["min"]
                    ),
                    3,
                )

                if stats.get(
                    "min"
                ) is not None

                else None
            ),


            "maximumNdvi": (

                round(
                    float(
                        stats["max"]
                    ),
                    3,
                )

                if stats.get(
                    "max"
                ) is not None

                else None
            ),


            "validPixels":
                valid_pixels,

            "sampleCount":
                sample_count,

            "excludedPixels":
                no_data_count,


            "usablePixelPercentage":
                round(
                    usable_percentage,
                    1,
                ),


            "areaBbox":
                bbox,
        }


    except (
        KeyError,
        IndexError,
        TypeError,
        ValueError,
    ):

        return {

            "available":
                False,

            "meanNdvi":
                None,

            "validPixels":
                0,

            "sampleCount":
                0,

            "excludedPixels":
                0,

            "usablePixelPercentage":
                0.0,

            "message":
                "Sentinel statistics "
                "could not be interpreted.",
        }


# ========================================================
# VEGETATION CONTEXT
# ========================================================

def vegetation_context(
    mean_ndvi: Optional[float],
) -> str:

    if mean_ndvi is None:

        return "Unavailable"


    if mean_ndvi < 0:

        return (
            "Very low vegetation / "
            "non-vegetated surface"
        )


    if mean_ndvi < 0.2:

        return "Low vegetation"


    if mean_ndvi < 0.4:

        return (
            "Low-to-moderate vegetation"
        )


    if mean_ndvi < 0.6:

        return "Moderate vegetation"


    return "Dense vegetation"


# ========================================================
# SATELLITE EVIDENCE
# ========================================================

async def get_satellite_evidence(
    lat: float,
    lng: float,
    reference_date: Optional[str],
):

    search = await search_sentinel2(
        lat=lat,
        lng=lng,
        reference_date=reference_date,
    )


    reference_dt = (
        search["referenceDate"]
    )


    scenes = (
        search["results"]
    )


    if not scenes:

        return {

            "available":
                False,

            "source":
                "Copernicus Data Space Ecosystem",

            "product":
                "Sentinel-2 L2A",

            "message":
                "No Sentinel-2 scene was found near "
                "the FIRMS observation date.",
        }


    def scene_rank(scene):

        cloud = (
            scene.get(
                "cloudCover"
            )
        )


        if cloud is None:

            cloud = 100


        difference = (
            scene.get(
                "differenceDays",
                999,
            )
        )


        return (
            float(cloud),
            int(difference),
        )


    ranked_scenes = sorted(
        scenes,
        key=scene_rank,
    )


    tested_scenes = []

    selected_scene = None

    selected_stats = None


    for scene in ranked_scenes[:5]:

        scene_date = (
            scene["datetime"][:10]
        )


        try:

            stats = (
                await get_ndvi_statistics(
                    lat=lat,
                    lng=lng,
                    acquisition_date=
                        scene_date,
                )
            )


        except httpx.HTTPError:

            tested_scenes.append(
                {
                    "id":
                        scene["id"],

                    "date":
                        scene_date,

                    "status":
                        "statistics_request_failed",
                }
            )


            continue


        tested_scenes.append(
            {

                "id":
                    scene["id"],

                "date":
                    scene_date,

                "cloudCover":
                    scene.get(
                        "cloudCover"
                    ),

                "differenceDays":
                    scene.get(
                        "differenceDays"
                    ),

                "usablePixelPercentage":
                    stats.get(
                        "usablePixelPercentage",
                        0,
                    ),

                "available":
                    stats.get(
                        "available",
                        False,
                    ),
            }
        )


        if (
            stats.get(
                "available"
            )
            and
            stats.get(
                "usablePixelPercentage",
                0,
            ) >= 25
        ):

            selected_scene = (
                scene
            )

            selected_stats = (
                stats
            )

            break


    if (
        not selected_scene
        or not selected_stats
    ):

        return {

            "available":
                False,


            "source":
                "Copernicus Data Space Ecosystem",


            "product":
                "Sentinel-2 L2A",


            "referenceDate":
                reference_dt
                .date()
                .isoformat(),


            "candidateScenes":
                len(scenes),


            "testedScenes":
                tested_scenes,


            "message":
                "Sentinel-2 scenes were found, "
                "but no candidate had enough usable "
                "pixels around the hotspot.",
        }


    scene_dt = (
        parse_reference_date(
            selected_scene[
                "datetime"
            ]
        )
    )


    difference_days = abs(
        (
            scene_dt.date()
            -
            reference_dt.date()
        ).days
    )


    mean_ndvi = (
        selected_stats.get(
            "meanNdvi"
        )
    )


    return {

        "available":
            True,


        "source":
            "Copernicus Data Space Ecosystem",


        "product":
            "Sentinel-2 L2A",


        "firmsReferenceDate":
            reference_dt
            .date()
            .isoformat(),


        "selectedScene": {

            "id":
                selected_scene.get(
                    "id"
                ),


            "acquisitionDatetime":
                selected_scene.get(
                    "datetime"
                ),


            "platform":
                selected_scene.get(
                    "platform"
                ),


            "cloudCover":
                selected_scene.get(
                    "cloudCover"
                ),


            "temporalDifferenceDays":
                difference_days,
        },


        "localAnalysis": {

            "meanNdvi":
                mean_ndvi,


            "minimumNdvi":
                selected_stats.get(
                    "minimumNdvi"
                ),


            "maximumNdvi":
                selected_stats.get(
                    "maximumNdvi"
                ),


            "vegetationContext":
                vegetation_context(
                    mean_ndvi
                ),


            "validPixels":
                selected_stats.get(
                    "validPixels"
                ),


            "excludedPixels":
                selected_stats.get(
                    "excludedPixels"
                ),


            "sampleCount":
                selected_stats.get(
                    "sampleCount"
                ),


            "usablePixelPercentage":
                selected_stats.get(
                    "usablePixelPercentage"
                ),


            "analysisBbox":
                selected_stats.get(
                    "areaBbox"
                ),
        },


        "candidateScenes":
            len(scenes),


        "method": (
            "Sentinel-2 L2A scene search followed by "
            "local SCL/dataMask filtering and NDVI "
            "calculation around the FIRMS hotspot."
        ),


        "note": (
            "Scene cloud cover is product-level metadata. "
            "Local usable-pixel percentage is calculated "
            "for the hotspot analysis area."
        ),
    }


# ========================================================
# TRUE COLOR IMAGE
# ========================================================

async def get_true_color_image(
    lat: float,
    lng: float,
    acquisition_date: str,
):

    token = (
        await get_access_token()
    )


    bbox = [
        lng - LOCAL_PADDING,
        lat - LOCAL_PADDING,
        lng + LOCAL_PADDING,
        lat + LOCAL_PADDING,
    ]


    date_value = (
        acquisition_date[:10]
    )


    start_dt = datetime.strptime(
        date_value,
        "%Y-%m-%d",
    ).replace(
        tzinfo=timezone.utc
    )


    end_dt = (
        start_dt
        +
        timedelta(
            days=1
        )
    )


    start_iso = (
        start_dt
        .isoformat()
        .replace(
            "+00:00",
            "Z",
        )
    )


    end_iso = (
        end_dt
        .isoformat()
        .replace(
            "+00:00",
            "Z",
        )
    )


    evalscript = """
    //VERSION=3

    function setup() {
        return {
            input: [{
                bands: [
                    "B02",
                    "B03",
                    "B04",
                    "dataMask"
                ]
            }],
            output: {
                bands: 4,
                sampleType: "AUTO"
            }
        };
    }

    function evaluatePixel(sample) {

        let gain = 2.5;

        return [
            gain * sample.B04,
            gain * sample.B03,
            gain * sample.B02,
            sample.dataMask
        ];
    }
    """


    payload = {

        "input": {

            "bounds": {

                "bbox":
                    bbox,


                "properties": {

                    "crs":
                        "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
                },
            },


            "data": [
                {

                    "type":
                        "sentinel-2-l2a",


                    "dataFilter": {

                        "timeRange": {

                            "from":
                                start_iso,

                            "to":
                                end_iso,
                        },


                        "mosaickingOrder":
                            "leastCC",
                    },
                }
            ],
        },


        "output": {

            "width":
                512,

            "height":
                512,


            "responses": [
                {

                    "identifier":
                        "default",


                    "format": {

                        "type":
                            "image/png"
                    },
                }
            ],
        },


        "evalscript":
            evalscript,
    }


    headers = {

        "Authorization":
            f"Bearer {token}",


        "Content-Type":
            "application/json",


        "Accept":
            "image/png",
    }


    response = await post_with_retry(
        PROCESS_URL,
        headers=headers,
        json=payload,
        timeout=60,
    )


    return response.content