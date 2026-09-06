import httpx
from fastapi import APIRouter, HTTPException
from services.firms_service import get_india_hotspots

router = APIRouter(
    prefix="/hotspots",
    tags=["Hotspots"]
)

@router.get("")
@router.get("/")
async def hotspots():
    try:
        return await get_india_hotspots()

    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc)
        ) from exc

    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail="NASA FIRMS is temporarily unavailable"
        ) from exc