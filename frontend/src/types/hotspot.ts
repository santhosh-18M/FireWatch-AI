/* ========================================================
   RISK
======================================================== */

export type RiskLevel =
    | "Low"
    | "Moderate"
    | "High"
    | "Extreme";


/* ========================================================
   HOTSPOT
======================================================== */

export interface Hotspot {
    id: string;

    name: string;

    state: string;

    lat: number;
    lng: number;

    riskScore: number;

    riskLevel: RiskLevel;

    fireType: string;

    confidence: number;

    landType: string;

    brightness: number;

    frp: number;

    vegetation?: number | null;

    nearbyHotspots: number;

    recommendation: string;

    riskExplanation: string[];

    riskContributors:
    Record<string, number>;

    acquiredAt: string;
}


/* ========================================================
   LOCATION
======================================================== */

export interface LocationInfo {
    city: string | null;

    district: string | null;

    state: string | null;

    country: string | null;

    displayName: string | null;
}


/* ========================================================
   OSM CONTEXT
======================================================== */

export interface OSMContext {
    landType: string;

    nearestIndustrialKm: number | null;

    nearestFactoryKm: number | null;

    nearestRefineryKm: number | null;

    nearestPowerPlantKm: number | null;

    nearestForestKm: number | null;

    nearestAgricultureKm: number | null;

    nearestFeature: string | null;

    nearestFeatureName: string | null;

    nearestFeatureDistanceKm: number | null;

    osmFeaturesFound: number;

    lookupStatus?: string;

    lookupMessage?: string | null;
}


/* ========================================================
   FIRMS ANALYSIS
======================================================== */

export interface FIRMSAnalysisInput {
    brightness: number | null;

    frp: number | null;

    confidence: number | null;

    nearbyHotspots: number;

    referenceDate?: string | null;
}


/* ========================================================
   PERSISTENCE FEATURES
======================================================== */

export interface PersistenceFeatures {
    detections3d: number;

    detections7d: number;

    detections10d: number;

    detections30d: number;


    distinctActiveDays3d: number;

    distinctActiveDays7d: number;

    distinctActiveDays10d: number;

    distinctActiveDays30d: number;


    observationSpanDays: number;

    activeDayFraction30d: number;


    meanDetectionDistanceM: number | null;

    maxDetectionDistanceM: number | null;


    meanGapDays: number | null;

    maxGapDays: number | null;

    minGapDays: number | null;
}


/* ========================================================
   PERSISTENCE SUMMARY
======================================================== */

export type PersistenceActivityType =
    | "none"
    | "single"
    | "repeated"
    | "unavailable";


export interface PersistenceSummary {
    activityType: PersistenceActivityType;

    repeatActivity: boolean | null;

    status: string;

    distinctActiveDays: number | null;

    observationSpanDays: number | null;

    firstObserved: string | null;

    latestObserved: string | null;

    message: string;
}


/* ========================================================
   PERSISTENCE ANALYSIS
======================================================== */

export interface PersistenceAnalysis {
    available: boolean;

    lat?: number;

    lng?: number;

    referenceDate?: string;

    requestedHistoryDays?: number;

    requestedFrom?: string;

    requestedTo?: string;

    matchRadiusKm?: number;

    source: string;

    firmsProduct?: string;

    method: string;

    historicalRecordsDownloaded?: number;

    matchingDetections?: number;

    features:
    PersistenceFeatures | null;

    summary:
    PersistenceSummary;
}


/* ========================================================
   SATELLITE SELECTED SCENE
======================================================== */

export interface SatelliteSelectedScene {
    id: string;

    acquisitionDatetime: string;

    platform: string | null;

    cloudCover: number | null;

    temporalDifferenceDays: number;
}


/* ========================================================
   SATELLITE LOCAL ANALYSIS
======================================================== */

export interface SatelliteLocalAnalysis {
    meanNdvi: number | null;

    minimumNdvi: number | null;

    maximumNdvi: number | null;

    vegetationContext: string;

    validPixels: number;

    excludedPixels: number;

    sampleCount: number;

    usablePixelPercentage: number;

    analysisBbox: number[];
}


/* ========================================================
   SATELLITE EVIDENCE
======================================================== */

export interface SatelliteEvidence {
    available: boolean;

    source: string;

    product: string;

    firmsReferenceDate?: string;

    selectedScene?: SatelliteSelectedScene;

    localAnalysis?: SatelliteLocalAnalysis;

    candidateScenes?: number;

    method?: string;

    note?: string;

    message?: string;
}


/* ========================================================
   CLASSIFICATION
======================================================== */

export interface ClassificationResult {
    label: string | null;

    confidence: number | null;

    modelStatus: string;
}


/* ========================================================
   ANALYSIS
======================================================== */

export interface Analysis {
    lat: number;

    lng: number;

    location: LocationInfo;

    city: string | null;

    district: string | null;

    state: string | null;

    country: string | null;

    landType: string;

    osm: OSMContext;

    firms: FIRMSAnalysisInput;

    persistence: PersistenceAnalysis;

    riskScore: number;

    riskLevel: RiskLevel;

    riskMethod: string;

    riskExplanation: string[];

    riskContributors:
    Record<string, number>;

    recommendation: string;

    fireType: string;

    modelStatus: string;

    classification: ClassificationResult;
}


/* ========================================================
   RESPONSE FACILITY
======================================================== */

export interface ResponseFacility {
    name: string;

    type:
    | "Fire Station"
    | "Police Station"
    | "Hospital";

    distanceKm: number;

    lat: number;

    lng: number;

    osmId: number;

    osmType: string;

    phone: string | null;

    emergencyPhone: string | null;

    website: string | null;

    source: string;
}


/* ========================================================
   RESPONSE NAVIGATION
======================================================== */

export interface ResponseNavigation {
    destinationLat: number;

    destinationLng: number;

    originLat?: number;

    originLng?: number;

    googleMapsUrl: string;
}


/* ========================================================
   INCIDENT RESPONSE
======================================================== */

export interface IncidentResponse {
    lat: number;

    lng: number;

    nearestFireStation:
    ResponseFacility | null;

    nearestPoliceStation:
    ResponseFacility | null;

    nearestHospital:
    ResponseFacility | null;

    suggestedResponsePoint:
    ResponseFacility | null;

    navigation:
    ResponseNavigation;

    source: string;

    searchRadiusKm: number;

    facilitiesFound: number;

    lookupStatus?: string;

    lookupMessage?: string | null;
}


/* ========================================================
   ALERTS
======================================================== */

export type AlertStatus =
    "Active";


export type AlertPriority =
    | "Critical"
    | "High";


export interface FireAlert {
    id: string;

    hotspotId: string;

    title: string;

    location: string;

    lat: number;

    lng: number;

    riskScore: number;

    riskLevel: RiskLevel;

    priority: AlertPriority;

    status: AlertStatus;

    createdAt?: string;

    brightness?: number;

    frp?: number;

    confidence?: number;
}