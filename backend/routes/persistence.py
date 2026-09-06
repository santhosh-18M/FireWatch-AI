import httpx

from fastapi import (
    APIRouter,
    HTTPException,
    Query,
)

from services.persistence_service import (
    get_persistence_analysis,
)


router = APIRouter(
    prefix="/persistence",
    tags=["Persistence"],
)


@router.get("")
@router.get("/")
async def persistence_analysis(
    lat: float = Query(
        ...,
        ge=-90,
        le=90,
    ),

    lng: float = Query(
        ...,
        ge=-180,
        le=180,
    ),

    reference_date: str | None = Query(
        default=None,
        description=(
            "Reference date in YYYY-MM-DD format. "
            "Defaults to current UTC date."
        ),
    ),
):
    """
    Analyze repeated thermal activity around
    one selected FIRMS hotspot using real
    historical NASA FIRMS observations.
    """

    try:

        return await get_persistence_analysis(
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
            detail=(
                "NASA FIRMS historical API "
                "returned an error"
            ),
        ) from exc


    except httpx.HTTPError as exc:

        raise HTTPException(
            status_code=502,
            detail=(
                "NASA FIRMS historical API "
                "is temporarily unavailable"
            ),
        ) from exc


    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "Persistence analysis failed"
            ),
        ) from exc