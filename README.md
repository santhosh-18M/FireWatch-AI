# FireWatch AI

Production-oriented wildfire and persistent thermal-source intelligence using NASA FIRMS, OpenStreetMap, satellite context, explainable risk scoring, and GIS visualization.

## Architecture

```text
NASA FIRMS ──> async ingestion/cache ──> risk engine ──> FastAPI ──> React dashboard
                                           ^               |
Overpass mirrors ─> retry + TTL cache ─> land classifier ──┘
```

The browser requests FIRMS hotspots once. Selecting a marker updates the shared selected hotspot immediately; Full Analysis enriches it through a coordinate-keyed promise cache, then atomically updates both the marker/popup source array and side panel.

## Local installation

Prerequisites: Python 3.11+ and Node 20+.

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# Set NASA_FIRMS_API_KEY in .env
uvicorn main:app --reload --port 8000
```

In another terminal:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
npm run dev
```

Open http://localhost:5173. API docs are at http://127.0.0.1:8000/docs and health at `/health`.

## API

- `GET /hotspots`: normalized live FIRMS observations with explainable initial risk.
- `GET /analysis?lat=&lng=&brightness=&frp=&confidence=&vegetation=&nearby=`: cached OSM classification, rescored risk, explanation, and recommendation.
- `GET /health`: deployment health check.

Land categories: Forest, Agriculture, Water, Wetland, Urban, Industrial, Commercial, Residential, Grassland, Scrub, Bare Land, and Unknown. Unknown is a legitimate fallback when OSM has no mapped feature.

## Configuration

See `backend/.env.example` and `frontend/.env.example`. Never expose the FIRMS key through Vite; it belongs only on the backend. Configure `CORS_ORIGINS` to the exact deployed frontend URL.

## Deployment

### Render

Create a Python web service rooted at `backend`. Build: `pip install -r requirements.txt`. Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`. Add all backend environment variables and use `/health` as the health check.

### Railway

Deploy the repository with root directory `backend`; use the same start command and variables. Railway supplies `PORT`.

### Vercel

Import the repository, set root directory to `frontend`, build command `npm run build`, output directory `dist`, and `VITE_API_BASE_URL=https://your-api.example`. Add a SPA rewrite to `/index.html` if deep links are used.

## Verification

```powershell
cd frontend
npm run typecheck
npm run lint
npm run build

cd ..\backend
python -m compileall .
python -m pytest
```

## SIH pitch

- One operational picture for wildfire, industrial fire, gas-flare, and persistent thermal-source investigation.
- Explainable risk factors instead of a black-box severity badge.
- Failure-tolerant GIS enrichment through Overpass mirror failover, retry, and caching.
- Human-centered recommendations tailored to forest, agriculture, urban, water, and industrial context.
- National scaling path: state boundaries/reverse geocoding, weather and Sentinel-2 fusion, historical persistence features, then calibrated XGBoost classification.

## Current limitations and roadmap

State names require a boundary dataset or reverse-geocoding service; the API currently reports `Unresolved` rather than inventing a state. The heat layer is a lightweight radius visualization; production-scale clustering should use vector tiles or server-side aggregation. Historical comparison, weather/NDVI, Sentinel inference, notification delivery, authentication/RBAC, rate limiting at the gateway, PostGIS, and an audited incident workflow are the next production milestones.

## Security and operations

Secrets are environment-only; CORS is allow-listed; coordinates are validated; upstream errors are sanitized; API keys are never logged. Add gateway rate limits, HTTPS, request IDs, structured centralized logs, dependency scanning, Sentry/OpenTelemetry, and separate read/operator/admin roles before public operations.

