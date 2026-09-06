from fastapi import (
    APIRouter,
    HTTPException,
    Query,
)

from services.response_service import (
    get_incident_response,
)


router = APIRouter(
    prefix="/response",
    tags=["Incident Response"],
)


@router.get("")
@router.get("/")
async def incident_response(
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
):

    try:

        return await get_incident_response(
            lat,
            lng,
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "Incident response lookup failed"
            ),
        ) from exc