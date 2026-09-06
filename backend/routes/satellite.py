import httpx

from fastapi import (
    APIRouter,
    HTTPException,
    Query,
)

from fastapi.responses import Response

from services.sentinel_service import (
    get_ndvi_statistics,
    get_satellite_evidence,
    get_true_color_image,
    search_sentinel2,
)


router = APIRouter(
    prefix="/satellite",
    tags=["Satellite"],
)


@router.get("/search")
async def satellite_search(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    reference_date: str | None = None,
):
    try:
        result = await search_sentinel2(
            lat=lat,
            lng=lng,
            reference_date=reference_date,
        )

        result["referenceDate"] = (
            result["referenceDate"].isoformat()
        )

        return result

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc

    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=
                "Copernicus is temporarily unavailable",
        ) from exc


@router.get("/ndvi")
async def satellite_ndvi(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    acquisition_date: str = Query(...),
):
    try:
        return await get_ndvi_statistics(
            lat=lat,
            lng=lng,
            acquisition_date=acquisition_date,
        )

    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "message":
                    "Copernicus Statistical API request failed",
                "status":
                    exc.response.status_code,
            },
        ) from exc

    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=
                "Copernicus is temporarily unavailable",
        ) from exc


@router.get("/evidence")
async def satellite_evidence(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    reference_date: str | None = None,
):
    try:
        return await get_satellite_evidence(
            lat=lat,
            lng=lng,
            reference_date=reference_date,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc

    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "message":
                    "Copernicus satellite evidence request failed",
                "status":
                    exc.response.status_code,
            },
        ) from exc

    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=
                "Copernicus is temporarily unavailable",
        ) from exc


@router.get("/image")
async def satellite_image(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    acquisition_date: str = Query(...),
):
    try:
        image_bytes = await get_true_color_image(
            lat=lat,
            lng=lng,
            acquisition_date=acquisition_date,
        )

        return Response(
            content=image_bytes,
            media_type="image/png",
            headers={
                "Cache-Control":
                    "public, max-age=21600"
            },
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc

    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "message":
                    "Copernicus image request failed",
                "status":
                    exc.response.status_code,
            },
        ) from exc

    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=
                "Copernicus imagery is temporarily unavailable",
        ) from exc