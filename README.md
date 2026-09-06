# 🔥 FireWatch AI

**AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources Using NASA FIRMS, OpenStreetMap & Satellite Data**

FireWatch AI is a GIS-based fire intelligence platform developed for **Smart India Hackathon (SIH)**. It combines real NASA FIRMS thermal anomaly observations, OpenStreetMap contextual information, historical persistence analysis, Sentinel-2 satellite evidence, and an XGBoost classification model to help distinguish between natural/vegetation fires, industrial fire candidates, persistent industrial thermal sources, and uncertain thermal anomalies.

> **Important:** NASA FIRMS observations represent detected thermal anomalies and are not automatically confirmed fires. FireWatch therefore treats industrial classifications as **candidates requiring contextual or satellite verification**.

---

## 🎯 Problem Statement

Industrial fires, gas flares, power-generation heat sources, forest fires, agricultural burning, and other thermal events can all appear as satellite thermal anomalies.

A raw thermal detection alone is therefore not enough to determine the actual source.

FireWatch AI combines:

- NASA FIRMS thermal observations
- Historical thermal persistence
- OpenStreetMap land and infrastructure context
- Sentinel-2 satellite evidence
- Machine-learning classification
- GIS visualization

to provide a more useful investigation workflow.

---

## 🚀 Main Features

### 1. Live NASA FIRMS Monitoring

FireWatch retrieves real active thermal-anomaly observations from **NASA FIRMS** and displays them on an interactive GIS map.

Each observation includes information such as:

- Latitude and longitude
- Brightness temperature
- Fire Radiative Power (FRP)
- Detection confidence
- Satellite
- Acquisition date and time
- Day/night information
- Scan and track values

---

### 2. Heuristic FIRMS Risk Index

Every live thermal observation receives an explainable heuristic risk score based on FIRMS characteristics.

The interface displays:

- Risk score
- Risk level
- Individual risk contributors
- Explanation
- Recommended investigation action

This score is called the:

**Heuristic FIRMS Risk Index**

It is an operational prioritization mechanism and should not be interpreted as a scientifically calibrated fire probability.

---

### 3. AI Thermal-Source Classification

FireWatch uses an **XGBoost V3 Precision Deployment Model** to classify thermal observations into four contextual classes:

- `Industrial Fire Candidate`
- `Natural / Vegetation Fire`
- `Persistent Industrial Thermal Source`
- `Other / Uncertain`

The deployed model uses 15 live-reproducible features from:

- NASA FIRMS thermal measurements
- Historical persistence
- OpenStreetMap contextual information

The model was trained using NASA FIRMS observations from **2022–2024** and evaluated using a temporally held-out **2025** dataset.

Evaluation against contextual weak labels:

**Macro F1-score: 0.7857**

Industrial-fire outputs are deliberately presented as **Industrial Fire Candidates**, not confirmed industrial fires.

---

## 🧠 AI Classification Pipeline

```text
NASA FIRMS Thermal Anomaly
            │
            ▼
     Thermal Features
            │
            ▼
Historical Persistence Analysis
            │
            ▼
OpenStreetMap Context
            │
            ▼
     XGBoost V3 Model
            │
            ▼
 Contextual Classification
            │
            ▼
Satellite / GIS Verification
```

The model considers features such as:

- Brightness
- Fire Radiative Power
- Scan
- Track
- Time of detection
- Month
- FIRMS confidence
- Day/night observation
- Prior detections in 3, 7, 10 and 30 days
- Distinct active days
- Industrial context within 1.5 km
- Natural context within 1.5 km

---

## 🗺️ OpenStreetMap Context Analysis

FireWatch queries OpenStreetMap to understand what exists around a thermal anomaly.

Industrial context includes features such as:

- Industrial land
- Power plants
- Generators
- Substations
- Factories / works
- Storage tanks
- Petroleum wells
- Kilns
- Chimneys
- Fuel facilities

Natural context includes:

- Forest
- Wood
- Grassland
- Scrub
- Agriculture
- Farmland
- Orchards
- Meadows

The system calculates contextual proximity and determines whether relevant industrial or natural features exist within approximately **1.5 km**.

`Unknown` or missing context is valid when OpenStreetMap does not contain sufficient mapped information.

---

## 🔁 Historical Persistence Detection

FireWatch analyzes historical NASA FIRMS observations around a selected hotspot.

Persistence features include:

- Previous detections within 3 days
- Previous detections within 7 days
- Previous detections within 10 days
- Previous detections within 30 days
- Distinct active days
- Observation span

The current observation is excluded from its own historical persistence features.

Repeated thermal activity can indicate a persistent thermal source, but **persistence alone does not prove that a source is industrial**.

---

## 🛰️ Sentinel-2 Satellite Evidence

The Hotspot Investigation panel can retrieve Sentinel-2 satellite evidence using the **Copernicus Data Space Ecosystem**.

Satellite investigation includes:

- Sentinel-2 scene search
- Cloud-aware scene selection
- True-colour satellite imagery
- NDVI-based environmental context
- Acquisition metadata

Satellite imagery is used as supporting contextual evidence rather than automatically claiming that a visible feature is an industrial fire.

---

## 🗄️ GIS Historical Database

FireWatch stores historical observations in a local SQLite GIS database.

The database supports:

- Historical FIRMS observation storage
- Spatial hotspot queries
- Bounding-box queries
- GIS analytics
- Repeated thermal-location detection
- Historical investigation

SQLite RTree indexing is used for efficient spatial querying.

Runtime database files are intentionally excluded from Git.

---

## 🖥️ Dashboard

The application contains three primary sections:

### Live Monitoring

Interactive map containing current NASA FIRMS thermal observations.

Selecting a hotspot opens a detailed investigation panel containing risk, persistence, contextual and AI information.

### Active Alerts

Displays thermal observations categorized as High or Extreme according to the **Heuristic FIRMS Risk Index**.

The alert count is independent of the AI classification result.

### GIS History

Provides access to stored historical observations and repeated thermal-location analysis.

---

# 🏗️ System Architecture

```text
                    NASA FIRMS
                        │
                        ▼
                FIRMS Data Service
                        │
             ┌──────────┴──────────┐
             ▼                     ▼
      Heuristic Risk         Persistence Engine
          Engine                    │
             │                      │
             └──────────┬───────────┘
                        ▼
               OpenStreetMap Context
                        │
                        ▼
                 XGBoost V3 Model
                        │
                        ▼
                AI Classification
                        │
             ┌──────────┴──────────┐
             ▼                     ▼
       Sentinel-2              GIS Database
        Evidence                    │
             │                      │
             └──────────┬───────────┘
                        ▼
                  FastAPI Backend
                        │
                        ▼
                 React Dashboard
```

---

# 🛠️ Technology Stack

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Interactive GIS mapping

## Backend

- Python
- FastAPI
- Uvicorn
- Pandas / NumPy
- Scikit-learn
- XGBoost
- SQLite / RTree

## Data & External Services

- NASA FIRMS
- OpenStreetMap / Overpass API
- Copernicus Data Space Ecosystem
- Sentinel-2

## Machine Learning

- XGBoost
- Historical persistence features
- OSM contextual features
- Temporally separated training/evaluation data

---

# 📁 Project Structure

```text
FireWatch-AI/
│
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── .env.example
│   │
│   ├── models/
│   │   └── classification_model/
│   │       ├── firewatch_xgb_v3_precision.joblib
│   │       ├── feature_columns_v3_precision.json
│   │       └── label_classes_v3_precision.json
│   │
│   ├── routes/
│   │   ├── hotspots.py
│   │   ├── analysis.py
│   │   ├── analytics.py
│   │   ├── persistence.py
│   │   ├── prediction.py
│   │   ├── response.py
│   │   ├── satellite.py
│   │   └── storage.py
│   │
│   └── services/
│       ├── firms_service.py
│       ├── risk_service.py
│       ├── osm_service.py
│       ├── persistence_service.py
│       ├── prediction_service.py
│       ├── sentinel_service.py
│       └── database_service.py
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── types/
│   │
│   ├── .env.example
│   ├── package.json
│   └── vite.config.ts
│
├── ml/
│   └── training/
│
├── .gitignore
└── README.md
```

---

# ⚙️ Local Installation

## Prerequisites

Install:

- Python 3.11+
- Node.js 20+
- npm
- Git

Clone the repository:

```bash
git clone https://github.com/santhosh-18M/FireWatch-AI.git
cd FireWatch-AI
```

---

# 🔐 Environment Configuration

The real `.env` files are **not stored in GitHub** because they contain API credentials.

Each developer must create their own `.env` files.

There are two separate environment files:

```text
FireWatch-AI/
├── backend/
│   ├── .env.example
│   └── .env          ← create this
│
└── frontend/
    ├── .env.example
    └── .env          ← create this
```

---

## Backend `.env`

Go to:

```text
FireWatch-AI/backend/
```

Copy:

```text
.env.example
```

and rename the copy to:

```text
.env
```

On Windows PowerShell:

```powershell
cd backend
Copy-Item .env.example .env
```

Open:

```text
backend/.env
```

and fill in the required credentials.

### NASA FIRMS

FireWatch requires a NASA FIRMS MAP_KEY for retrieving live and historical thermal observations.

Set the corresponding NASA FIRMS variable shown in `backend/.env.example`.

Do not place the NASA FIRMS key in frontend code.

### Copernicus / Sentinel-2

Satellite evidence requires Copernicus Data Space credentials.

Set the Copernicus variables provided in:

```text
backend/.env.example
```

These credentials are used only by the backend.

### Important

Never commit:

```text
backend/.env
frontend/.env
```

The repository `.gitignore` already excludes `.env` files.

---

# ▶️ Running the Backend

Open a terminal in the project:

```powershell
cd backend
```

Create a Python virtual environment:

```powershell
python -m venv .venv
```

Activate it:

```powershell
.venv\Scripts\Activate.ps1
```

If using Command Prompt:

```cmd
.venv\Scripts\activate
```

Install dependencies:

```powershell
pip install -r requirements.txt
```

Start FastAPI:

```powershell
uvicorn main:app --reload --port 8000
```

Backend:

```text
http://127.0.0.1:8000
```

Swagger API documentation:

```text
http://127.0.0.1:8000/docs
```

---

# ▶️ Running the Frontend

Open another terminal:

```powershell
cd frontend
```

Install dependencies:

```powershell
npm install
```

or:

```powershell
npm ci
```

Create the frontend environment file if required:

```powershell
Copy-Item .env.example .env
```

Then start Vite:

```powershell
npm run dev
```

Open:

```text
http://localhost:5173
```

---

# 🔌 Important Backend Endpoints

Examples of important FireWatch API routes include:

```text
GET  /hotspots
GET  /health

GET  /analysis/
GET  /analytics/...
GET  /persistence/...

GET  /prediction/status
POST /prediction/classify

GET/POST satellite investigation endpoints
```

For the complete and current API specification, use Swagger:

```text
http://127.0.0.1:8000/docs
```

Swagger should be treated as the authoritative development reference for endpoint parameters.

---

# 🤖 Model Files

The trained deployment model is already included in the repository:

```text
backend/models/classification_model/
```

Files:

```text
firewatch_xgb_v3_precision.joblib
feature_columns_v3_precision.json
label_classes_v3_precision.json
```

Therefore, teammates **do not need to retrain the model** to run the normal application.

After starting the backend, model availability can be checked through:

```text
GET /prediction/status
```

---

# ⚠️ Development Batch Scanner

The repository contains a temporary development batch-scanning path used during model verification.

It can use a local OSM feature dataset originally stored outside this repository, for example:

```text
D:\FireWatch_ML\data\processed\osm_context_features.parquet
```

That large development dataset is **not included in this Git repository**.

Therefore, the batch `/prediction/scan` development workflow may require a separately configured local OSM dataset.

This does **not** prevent the normal FireWatch application from running.

Normal single-hotspot classification uses the live OpenStreetMap/Overpass contextual workflow.

---

# 🧪 Quick Verification

After starting the backend, open:

```text
http://127.0.0.1:8000/docs
```

Check:

```text
GET /health
```

Then:

```text
GET /prediction/status
```

The prediction status should report that the V3 deployment model is available.

Start the frontend and confirm:

1. Live Monitoring loads FIRMS observations.
2. Hotspots appear on the GIS map.
3. Selecting a hotspot opens Hotspot Investigation.
4. OSM contextual information can be retrieved.
5. Historical persistence analysis works.
6. AI Classification displays a contextual class and model confidence.
7. Sentinel-2 evidence can be requested when Copernicus credentials are configured.
8. GIS History loads stored historical observations.

---

# 📊 Understanding FireWatch Outputs

FireWatch intentionally separates different forms of evidence.

### FIRMS Detection

Means:

> A satellite detected a thermal anomaly.

It does not automatically mean a confirmed fire.

### Heuristic Risk Score

Means:

> Operational prioritization based on FIRMS thermal characteristics.

It is not ML confidence.

### Model Confidence

Means:

> The classifier's confidence relative to the contextual classes it was trained to distinguish.

It should not be interpreted as a calibrated real-world probability that an industrial fire exists.

### Industrial Fire Candidate

Means:

> FIRMS thermal characteristics, persistence and/or mapped context are sufficiently consistent with the model's contextual industrial-fire class to warrant further investigation.

It does not mean the industrial fire has been independently confirmed.

### Other / Uncertain

Means:

> A real FIRMS thermal anomaly exists, but available contextual evidence is insufficient or conflicting for a more specific classification.

FireWatch deliberately preserves uncertainty instead of forcing every anomaly into an incorrect category.

---

# 🔒 Security

API keys and credentials must remain backend-only.

Never commit:

```text
.env
API keys
Copernicus client secrets
NASA FIRMS MAP_KEY
```

The project uses `.env.example` files to document required configuration without exposing real credentials.

If an API key is accidentally committed, rotate the key immediately rather than simply deleting it in a later commit.

---

# 📌 Current Limitations

FireWatch is an investigation and decision-support prototype.

Important limitations include:

- NASA FIRMS reports thermal anomalies rather than confirmed fires.
- OpenStreetMap coverage varies by region.
- Proximity to industrial infrastructure does not prove that the infrastructure caused the thermal anomaly.
- Historical persistence does not by itself prove an industrial source.
- Satellite imagery is supporting evidence and requires interpretation.
- AI classes are trained using contextual weak labels rather than manually verified ground-truth industrial-fire incident labels.
- Model confidence should not be presented as real-world incident probability.

These limitations are deliberately reflected in the user interface through candidate and uncertainty terminology.

---

# 🏆 SIH Objective

FireWatch AI addresses the SIH objective of creating a GIS-based system capable of helping distinguish industrial fires and persistent thermal sources from natural/vegetation fire activity.

The platform demonstrates an end-to-end pipeline:

```text
NASA FIRMS
     ↓
Live Thermal Monitoring
     ↓
Historical Persistence
     ↓
OSM Context Analysis
     ↓
XGBoost Classification
     ↓
Satellite Evidence
     ↓
GIS Visualization & Investigation
```

The objective is not to replace emergency authorities or satellite analysts, but to provide a unified intelligence layer that helps investigators identify thermal anomalies that deserve further attention.

---

## FireWatch AI

**Thermal Detection → Context → Persistence → AI Classification → Satellite Verification → GIS Intelligence**
