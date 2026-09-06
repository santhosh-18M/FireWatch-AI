import type {
    Analysis,
    FireAlert,
    Hotspot,
    IncidentResponse,
    SatelliteEvidence,
} from "@/types/hotspot";


/* ========================================================
   REVERSE LOCATION
======================================================== */

export interface ReverseLocation {
    city: string | null;

    district: string | null;

    state: string | null;

    country: string | null;

    displayName: string | null;
}


/* ========================================================
   AI CLASSIFICATION
======================================================== */

export interface AIModelClassification {
    label: string;

    displayLabel: string;

    confidence: number;

    confidencePercent: number;

    probabilities: Record<string, number>;

    model: string;

    modelVersion: string;

    labelType: string;

    requiresVerification: boolean;

    note: string;
}


export interface AIClassificationResponse {
    available: boolean;

    coordinates: {
        lat: number;
        lng: number;
    };

    acquiredAt: string;

    classification: AIModelClassification;

    evidence: {
        firms: {
            brightness: number;
            frp: number;
            scan: number;
            track: number;
            rawConfidence: string | number;
            confidencePercent: number;
            dayNight: string;
            hour: number;
            month: number;
        };

        persistence: {
            currentObservationExcluded: boolean;

            detections3d: number;
            detections7d: number;
            detections10d: number;
            detections30d: number;

            distinctActiveDays30d: number;

            summary: unknown;
        };

        osm: {
            landType: string | null;

            nearestIndustrialKm: number | null;

            nearestNaturalKm: number | null;

            industrialWithin1_5Km: boolean;

            naturalWithin1_5Km: boolean;

            lookupStatus: string;
        };
    };

    modelFeatures: Record<string, number>;

    interpretation: string;
}


/* ========================================================
   BASE URL
======================================================== */

const BASE = (
    import.meta.env.VITE_API_BASE_URL
    ||
    "http://127.0.0.1:8000"
).replace(/\/$/, "");


/* ========================================================
   CACHE
======================================================== */

const analysisCache =
    new Map<
        string,
        Promise<Analysis>
    >();


const locationCache =
    new Map<
        string,
        Promise<ReverseLocation>
    >();


const responseCache =
    new Map<
        string,
        Promise<IncidentResponse>
    >();


const satelliteCache =
    new Map<
        string,
        Promise<SatelliteEvidence>
    >();


const classificationCache =
    new Map<
        string,
        Promise<AIClassificationResponse>
    >();


/* ========================================================
   REQUEST HELPER
======================================================== */

async function request<T>(
    path: string,
    signal?: AbortSignal,
): Promise<T> {

    const response = await fetch(
        `${BASE}${path}`,
        {
            signal,
        }
    );


    if (!response.ok) {

        let message =
            `Request failed (${response.status})`;


        try {

            const data =
                await response.json();


            if (
                data
                &&
                typeof data.detail === "string"
            ) {

                message =
                    data.detail;

            }

            else if (
                data
                &&
                data.detail
                &&
                typeof data.detail.message === "string"
            ) {

                message =
                    data.detail.message;

            }

        } catch {

            // Keep fallback message.

        }


        throw new Error(
            message
        );

    }


    return response.json();
}


/* ========================================================
   HOTSPOTS
======================================================== */

export function getHotspots(
    signal?: AbortSignal,
): Promise<Hotspot[]> {

    return request<Hotspot[]>(
        "/hotspots",
        signal,
    );
}


/* ========================================================
   ALERTS
======================================================== */

export function getAlerts(
    signal?: AbortSignal,
): Promise<FireAlert[]> {

    return request<FireAlert[]>(
        "/alerts",
        signal,
    );
}


/* ========================================================
   LOCATION
======================================================== */

export function getLocation(
    lat: number,
    lng: number,
    signal?: AbortSignal,
): Promise<ReverseLocation> {

    const key =
        `${lat.toFixed(4)},${lng.toFixed(4)}`;


    const existing =
        locationCache.get(
            key
        );


    if (existing) {

        return existing;

    }


    const params =
        new URLSearchParams({
            lat: String(lat),
            lng: String(lng),
        });


    const promise =
        request<ReverseLocation>(
            `/analysis/location?${params.toString()}`,
            signal,
        )
            .catch(
                (error: unknown) => {

                    locationCache.delete(
                        key
                    );

                    throw error;

                }
            );


    locationCache.set(
        key,
        promise
    );


    return promise;
}


/* ========================================================
   ANALYZE HOTSPOT
======================================================== */

export function analyzeHotspot(
    hotspot: Hotspot,
): Promise<Analysis> {

    const key =
        hotspot.id;


    const existing =
        analysisCache.get(
            key
        );


    if (existing) {

        return existing;

    }


    const params =
        new URLSearchParams({
            lat: String(
                hotspot.lat
            ),

            lng: String(
                hotspot.lng
            ),

            brightness: String(
                hotspot.brightness
            ),

            frp: String(
                hotspot.frp
            ),

            confidence: String(
                hotspot.confidence
            ),

            nearby: String(
                hotspot.nearbyHotspots
            ),

            reference_date:
                hotspot.acquiredAt,
        });


    const promise =
        request<Analysis>(
            `/analysis?${params.toString()}`
        )
            .catch(
                (error: unknown) => {

                    analysisCache.delete(
                        key
                    );

                    throw error;

                }
            );


    analysisCache.set(
        key,
        promise
    );


    return promise;
}


/* ========================================================
   AI CLASSIFICATION
======================================================== */

export function classifyHotspot(
    hotspot: Hotspot,
): Promise<AIClassificationResponse> {

    const key =
        `${hotspot.id}-classification`;


    const existing =
        classificationCache.get(
            key
        );


    if (existing) {

        return existing;

    }


    const promise =
        fetch(
            `${BASE}/prediction/classify`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",
                },

                body: JSON.stringify({
                    lat:
                        hotspot.lat,

                    lng:
                        hotspot.lng,

                    brightness:
                        hotspot.brightness,

                    frp:
                        hotspot.frp,

                    scan:
                        hotspot.scan,

                    track:
                        hotspot.track,

                    rawConfidence:
                        hotspot.rawConfidence,

                    dayNight:
                        hotspot.dayNight,

                    acquiredAt:
                        hotspot.acquiredAt,
                }),
            }
        )
            .then(
                async response => {

                    if (!response.ok) {

                        let message =
                            `Classification failed (${response.status})`;


                        try {

                            const data =
                                await response.json();


                            if (
                                typeof data?.detail === "string"
                            ) {

                                message =
                                    data.detail;

                            }

                            else if (
                                typeof data?.detail?.message === "string"
                            ) {

                                message =
                                    data.detail.message;

                            }

                            else if (
                                typeof data?.detail?.reason === "string"
                            ) {

                                message =
                                    data.detail.reason;

                            }

                        } catch {

                            // Keep fallback message.

                        }


                        throw new Error(
                            message
                        );

                    }


                    return response.json() as
                        Promise<AIClassificationResponse>;

                }
            )
            .catch(
                (error: unknown) => {

                    classificationCache.delete(
                        key
                    );

                    throw error;

                }
            );


    classificationCache.set(
        key,
        promise
    );


    return promise;
}


/* ========================================================
   SATELLITE EVIDENCE
======================================================== */

export function getSatelliteEvidence(
    hotspot: Hotspot,
): Promise<SatelliteEvidence> {

    const key =
        `${hotspot.id}-satellite`;


    const existing =
        satelliteCache.get(
            key
        );


    if (existing) {

        return existing;

    }


    const params =
        new URLSearchParams({
            lat: String(
                hotspot.lat
            ),

            lng: String(
                hotspot.lng
            ),

            reference_date:
                hotspot.acquiredAt,
        });


    const promise =
        request<SatelliteEvidence>(
            `/satellite/evidence?${params.toString()}`
        )
            .catch(
                (error: unknown) => {

                    satelliteCache.delete(
                        key
                    );

                    throw error;

                }
            );


    satelliteCache.set(
        key,
        promise
    );


    return promise;
}


/* ========================================================
   SATELLITE IMAGE URL
======================================================== */

export function getSatelliteImageUrl(
    hotspot: Hotspot,
    acquisitionDate: string,
): string {

    const params =
        new URLSearchParams({
            lat: String(
                hotspot.lat
            ),

            lng: String(
                hotspot.lng
            ),

            acquisition_date:
                acquisitionDate,
        });


    return (
        `${BASE}/satellite/image?`
        +
        params.toString()
    );
}


/* ========================================================
   INCIDENT RESPONSE
======================================================== */

export function getIncidentResponse(
    lat: number,
    lng: number,
): Promise<IncidentResponse> {

    const key =
        `${lat.toFixed(4)},${lng.toFixed(4)}`;


    const existing =
        responseCache.get(
            key
        );


    if (existing) {

        return existing;

    }


    const params =
        new URLSearchParams({
            lat: String(lat),
            lng: String(lng),
        });


    const promise =
        request<IncidentResponse>(
            `/response?${params.toString()}`
        )
            .catch(
                (error: unknown) => {

                    responseCache.delete(
                        key
                    );

                    throw error;

                }
            );


    responseCache.set(
        key,
        promise
    );


    return promise;
}
