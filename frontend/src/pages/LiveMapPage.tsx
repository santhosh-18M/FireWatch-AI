import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    useSearchParams,
} from "react-router-dom";

import {
    AlertTriangle,
    Archive,
    Flame,
    RefreshCw,
    TrendingUp,
} from "lucide-react";

import LiveMap from "@/components/LiveMap";
import RiskAnalysisPanel from "@/components/RiskAnalysisPanel";

import type {
    Hotspot,
} from "@/types";

import {
    analyzeHotspot,
    getHotspots,
    getLocation,
} from "@/services/api";


/* ========================================================
   CONFIG
======================================================== */

const API_BASE =
    import.meta.env.VITE_API_BASE_URL ||
    "http://127.0.0.1:8000";


type StoredObservation =
    Record<string, unknown>;


/* ========================================================
   STORED DB ROW -> HOTSPOT
======================================================== */

function storedToHotspot(
    row: StoredObservation
): Hotspot | null {

    const id =
        typeof row.id === "string"
            ? row.id
            : null;


    const lat =
        Number(
            row.lat
        );


    const lng =
        Number(
            row.lng
        );


    const brightness =
        Number(
            row.brightness
        );


    const frp =
        Number(
            row.frp
        );


    const confidence =
        Number(
            row.confidence
        );


    const riskScore =
        Number(
            row.riskScore
        );


    const riskLevel =
        typeof row.riskLevel === "string"
            ? row.riskLevel
            : null;


    const acquiredAt =
        typeof row.acquiredAt === "string"
            ? row.acquiredAt
            : null;


    if (
        !id ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        !Number.isFinite(brightness) ||
        !Number.isFinite(frp) ||
        !Number.isFinite(confidence) ||
        !Number.isFinite(riskScore) ||
        !riskLevel ||
        !acquiredAt
    ) {

        console.error(
            "Invalid stored GIS observation:",
            row
        );

        return null;
    }


    return {

        id,

        name:
            "Stored FIRMS Observation",

        lat,

        lng,

        brightness,

        frp,

        confidence,

        riskScore,

        riskLevel:
            riskLevel as Hotspot["riskLevel"],

        acquiredAt,

        satellite:
            typeof row.satellite === "string"
                ? row.satellite
                : "Unknown",

        state:
            "Unresolved",

        landType:
            typeof row.landType === "string"
                ? row.landType
                : "Unknown",

        fireType:
            typeof row.fireType === "string"
                ? row.fireType
                : "Unclassified thermal source",

        recommendation:
            "",

        riskExplanation:
            [],

        riskContributors:
            [],

    } as Hotspot;
}


/* ========================================================
   MAIN PAGE
======================================================== */

export default function LiveMapPage() {

    const [
        searchParams,
    ] =
        useSearchParams();


    const [
        hotspots,
        setHotspots,
    ] =
        useState<Hotspot[]>(
            []
        );


    const [
        selected,
        setSelected,
    ] =
        useState<Hotspot | null>(
            null
        );


    const [
        analysisOpen,
        setAnalysisOpen,
    ] =
        useState(
            false
        );


    const [
        loading,
        setLoading,
    ] =
        useState(
            true
        );


    const [
        error,
        setError,
    ] =
        useState(
            ""
        );


    const [
        analyzingId,
        setAnalyzingId,
    ] =
        useState<string | null>(
            null
        );


    const [
        locatingId,
        setLocatingId,
    ] =
        useState<string | null>(
            null
        );


    const [
        updated,
        setUpdated,
    ] =
        useState<Date | null>(
            null
        );


    const [
        historicalSelectedId,
        setHistoricalSelectedId,
    ] =
        useState<string | null>(
            null
        );


    const [
        requestedFocus,
        setRequestedFocus,
    ] =
        useState<
            [number, number] |
            null
        >(
            null
        );


    const handledRequest =
        useRef<string | null>(
            null
        );


    /* =====================================================
       GIS HISTORY URL PARAMETERS
    ====================================================== */

    const latParam =
        searchParams.get(
            "lat"
        );


    const lngParam =
        searchParams.get(
            "lng"
        );


    const requestedHotspotId =
        searchParams.get(
            "hotspot"
        );


    const requestedLat =
        latParam !== null &&
            latParam.trim() !== ""

            ? Number(
                latParam
            )

            : null;


    const requestedLng =
        lngParam !== null &&
            lngParam.trim() !== ""

            ? Number(
                lngParam
            )

            : null;


    const hasRequestedCoordinates =
        requestedLat !== null &&
        requestedLng !== null &&
        Number.isFinite(
            requestedLat
        ) &&
        Number.isFinite(
            requestedLng
        );


    /* =====================================================
       LOAD CURRENT FIRMS HOTSPOTS
    ====================================================== */

    const load = () => {

        const controller =
            new AbortController();


        setLoading(
            true
        );


        setError(
            ""
        );


        getHotspots(
            controller.signal
        )
            .then(
                data => {

                    setHotspots(
                        data
                    );


                    setUpdated(
                        new Date()
                    );

                }
            )
            .catch(
                loadError => {

                    if (
                        loadError.name !==
                        "AbortError"
                    ) {

                        setError(
                            loadError instanceof Error
                                ? loadError.message
                                : "Unable to load FIRMS hotspots"
                        );

                    }

                }
            )
            .finally(
                () => {

                    setLoading(
                        false
                    );

                }
            );


        return () =>
            controller.abort();
    };


    useEffect(
        load,
        []
    );


    /* =====================================================
       SELECT HOTSPOT + REVERSE GEOCODING
    ====================================================== */

    const select = async (
        hotspot: Hotspot
    ) => {

        setSelected(
            hotspot
        );


        setAnalysisOpen(
            false
        );


        if (
            hotspot.state &&
            hotspot.state !==
            "Unresolved"
        ) {

            return;
        }


        setLocatingId(
            hotspot.id
        );


        try {

            const location =
                await getLocation(
                    hotspot.lat,
                    hotspot.lng
                );


            const primaryPlace =
                location.city ||
                location.district ||
                location.state ||
                null;


            const readableLocation =
                primaryPlace &&
                    location.state &&
                    primaryPlace !==
                    location.state

                    ? `${primaryPlace}, ${location.state}`

                    : primaryPlace ||
                    location.country ||
                    "Location unavailable";


            const enriched: Hotspot = {

                ...hotspot,

                state:
                    readableLocation,

            };


            setHotspots(
                current =>
                    current.map(
                        item =>
                            item.id === hotspot.id
                                ? enriched
                                : item
                    )
            );


            setSelected(
                current =>
                    current?.id === hotspot.id
                        ? enriched
                        : current
            );

        }
        catch (
        locationError
        ) {

            console.error(
                "Location lookup failed:",
                locationError
            );

        }
        finally {

            setLocatingId(
                current =>
                    current === hotspot.id
                        ? null
                        : current
            );

        }

    };


    /* =====================================================
       GIS HISTORY -> VIEW ON MAP
    ====================================================== */

    useEffect(
        () => {

            if (
                loading ||
                !hasRequestedCoordinates ||
                requestedLat === null ||
                requestedLng === null
            ) {

                return;
            }


            /*
             * Important:
             * From this point onward these are
             * guaranteed numbers.
             */

            const targetLat =
                requestedLat;


            const targetLng =
                requestedLng;


            const requestKey =
                `${requestedHotspotId ?? "coordinate"}-${targetLat}-${targetLng}`;


            if (
                handledRequest.current ===
                requestKey
            ) {

                return;
            }


            handledRequest.current =
                requestKey;


            setRequestedFocus(
                [
                    targetLat,
                    targetLng,
                ]
            );


            async function resolveRequestedObservation() {

                /* =========================================
                   1. CHECK CURRENT LIVE FIRMS FEED
                ========================================== */

                let liveMatch:
                    Hotspot | undefined;


                if (
                    requestedHotspotId
                ) {

                    liveMatch =
                        hotspots.find(
                            hotspot =>
                                hotspot.id ===
                                requestedHotspotId
                        );

                }


                if (
                    !liveMatch
                ) {

                    liveMatch =
                        hotspots.find(
                            hotspot =>

                                Math.abs(
                                    hotspot.lat -
                                    targetLat
                                ) < 0.0001 &&

                                Math.abs(
                                    hotspot.lng -
                                    targetLng
                                ) < 0.0001
                        );

                }


                if (
                    liveMatch
                ) {

                    setHistoricalSelectedId(
                        null
                    );


                    setError(
                        ""
                    );


                    await select(
                        liveMatch
                    );


                    return;
                }


                /* =========================================
                   2. SEARCH PERSISTENT GIS DATABASE
                ========================================== */

                const padding =
                    0.01;


                const minLat =
                    targetLat -
                    padding;


                const maxLat =
                    targetLat +
                    padding;


                const minLng =
                    targetLng -
                    padding;


                const maxLng =
                    targetLng +
                    padding;


                try {

                    const url =
                        `${API_BASE}/storage/hotspots` +
                        `?min_lat=${minLat}` +
                        `&max_lat=${maxLat}` +
                        `&min_lng=${minLng}` +
                        `&max_lng=${maxLng}`;


                    console.log(
                        "Historical GIS query:",
                        url
                    );


                    const response =
                        await fetch(
                            url
                        );


                    if (
                        !response.ok
                    ) {

                        throw new Error(
                            `Stored GIS query failed with status ${response.status}`
                        );

                    }


                    const payload =
                        await response.json();


                    console.log(
                        "Historical GIS response:",
                        payload
                    );


                    /*
                     * Actual backend response:
                     *
                     * {
                     *   count: 1,
                     *   hotspots: [...]
                     * }
                     */

                    const rows:
                        StoredObservation[] =
                        Array.isArray(
                            payload.hotspots
                        )

                            ? payload.hotspots

                            : [];


                    const normalized =
                        rows
                            .map(
                                row =>
                                    storedToHotspot(
                                        row
                                    )
                            )
                            .filter(
                                (
                                    hotspot
                                ): hotspot is Hotspot =>
                                    hotspot !== null
                            );


                    /* =====================================
                       3. EXACT HOTSPOT ID
                    ====================================== */

                    let storedMatch:
                        Hotspot | undefined;


                    if (
                        requestedHotspotId
                    ) {

                        storedMatch =
                            normalized.find(
                                hotspot =>
                                    hotspot.id ===
                                    requestedHotspotId
                            );

                    }


                    /* =====================================
                       4. FALLBACK: CLOSEST COORDINATE
                    ====================================== */

                    if (
                        !storedMatch &&
                        normalized.length > 0
                    ) {

                        storedMatch =
                            [...normalized]
                                .sort(
                                    (
                                        a,
                                        b
                                    ) => {

                                        const distanceA =
                                            Math.pow(
                                                a.lat -
                                                targetLat,
                                                2
                                            ) +
                                            Math.pow(
                                                a.lng -
                                                targetLng,
                                                2
                                            );


                                        const distanceB =
                                            Math.pow(
                                                b.lat -
                                                targetLat,
                                                2
                                            ) +
                                            Math.pow(
                                                b.lng -
                                                targetLng,
                                                2
                                            );


                                        return (
                                            distanceA -
                                            distanceB
                                        );

                                    }
                                )[0];

                    }


                    /* =====================================
                       5. NOTHING FOUND
                    ====================================== */

                    if (
                        !storedMatch
                    ) {

                        setError(
                            "Historical observation not found in persistent GIS storage."
                        );


                        console.error(
                            "Requested historical observation:",
                            {
                                id:
                                    requestedHotspotId,

                                lat:
                                    targetLat,

                                lng:
                                    targetLng,

                                rows,
                            }
                        );


                        return;
                    }


                    /* =====================================
                       6. ADD STORED OBSERVATION TO MAP
                    ====================================== */

                    setHotspots(
                        current => {

                            const exists =
                                current.some(
                                    hotspot =>
                                        hotspot.id ===
                                        storedMatch!.id
                                );


                            if (
                                exists
                            ) {

                                return current;
                            }


                            return [
                                ...current,
                                storedMatch!,
                            ];

                        }
                    );


                    /* =====================================
                       7. MARK AS HISTORICAL
                    ====================================== */

                    setHistoricalSelectedId(
                        storedMatch.id
                    );


                    /* =====================================
                       8. SELECT + GET LOCATION
                    ====================================== */

                    await select(
                        storedMatch
                    );


                    setHistoricalSelectedId(
                        storedMatch.id
                    );


                    setRequestedFocus(
                        [
                            storedMatch.lat,
                            storedMatch.lng,
                        ]
                    );


                    setError(
                        ""
                    );

                }
                catch (
                storageError
                ) {

                    console.error(
                        "Historical GIS lookup failed:",
                        storageError
                    );


                    setError(
                        storageError instanceof Error
                            ? storageError.message
                            : "Unable to retrieve historical GIS observation"
                    );

                }

            }


            void resolveRequestedObservation();

        },
        [
            loading,
            hasRequestedCoordinates,
            requestedHotspotId,
            requestedLat,
            requestedLng,
            hotspots,
        ]
    );


    /* =====================================================
       FULL ANALYSIS
    ====================================================== */

    const analyze = async (
        hotspot: Hotspot
    ) => {

        setSelected(
            hotspot
        );


        setAnalyzingId(
            hotspot.id
        );


        setError(
            ""
        );


        try {

            const result =
                await analyzeHotspot(
                    hotspot
                );


            const primaryPlace =
                result.city ||
                result.district ||
                result.state ||
                null;


            const readableLocation =
                primaryPlace &&
                    result.state &&
                    primaryPlace !==
                    result.state

                    ? `${primaryPlace}, ${result.state}`

                    : primaryPlace ||
                    result.country ||
                    hotspot.state;


            const enriched: Hotspot = {

                ...hotspot,

                state:
                    readableLocation,

                landType:
                    result.landType ||
                    hotspot.landType,

                riskScore:
                    result.riskScore,

                riskLevel:
                    result.riskLevel,

                fireType:
                    result.fireType,

                recommendation:
                    result.recommendation,

                riskExplanation:
                    result.riskExplanation,

                riskContributors:
                    result.riskContributors,

            };


            setHotspots(
                current =>
                    current.map(
                        item =>
                            item.id === hotspot.id
                                ? enriched
                                : item
                    )
            );


            setSelected(
                enriched
            );


            setAnalysisOpen(
                true
            );

        }
        catch (
        analysisError
        ) {

            setError(
                analysisError instanceof Error
                    ? analysisError.message
                    : "Analysis failed"
            );

        }
        finally {

            setAnalyzingId(
                null
            );

        }

    };


    /* =====================================================
       LIVE FEED STATS
    ====================================================== */

    const stats =
        useMemo(
            () => {

                /*
                 * Historical marker is excluded from
                 * current FIRMS summary counts.
                 */

                const liveHotspots =
                    historicalSelectedId

                        ? hotspots.filter(
                            hotspot =>
                                hotspot.id !==
                                historicalSelectedId
                        )

                        : hotspots;


                return {

                    total:
                        liveHotspots.length,


                    extreme:
                        liveHotspots.filter(
                            hotspot =>
                                hotspot.riskLevel ===
                                "Extreme"
                        ).length,


                    high:
                        liveHotspots.filter(
                            hotspot =>
                                hotspot.riskLevel ===
                                "High"
                        ).length,


                    average:
                        liveHotspots.length

                            ? Math.round(
                                liveHotspots.reduce(
                                    (
                                        sum,
                                        hotspot
                                    ) =>
                                        sum +
                                        hotspot.riskScore,
                                    0
                                ) /
                                liveHotspots.length
                            )

                            : 0,

                };

            },
            [
                hotspots,
                historicalSelectedId,
            ]
        );


    const cards = [

        [
            "Thermal hotspots",
            stats.total,
            Flame,
        ],

        [
            "Extreme risk",
            stats.extreme,
            AlertTriangle,
        ],

        [
            "High risk",
            stats.high,
            TrendingUp,
        ],

        [
            "Average risk score",
            stats.average,
            RefreshCw,
        ],

    ] as const;


    /* =====================================================
       UI
    ====================================================== */

    return (

        <div
            className="
                flex
                h-full
                min-h-[700px]
                flex-col
                overflow-hidden
            "
        >

            {/* =============================================
                SUMMARY CARDS
            ============================================== */}

            <div
                className="
                    grid
                    grid-cols-2
                    gap-3
                    p-4
                    lg:grid-cols-4
                "
            >

                {cards.map(
                    (
                        [
                            label,
                            value,
                            Icon,
                        ]
                    ) => (

                        <div
                            key={
                                label
                            }
                            className="
                                glass-card
                                rounded-2xl
                                p-4
                            "
                        >

                            <Icon
                                className="
                                    h-5
                                    w-5
                                    text-fire-400
                                "
                            />


                            <p
                                className="
                                    mt-2
                                    font-mono
                                    text-2xl
                                    font-bold
                                "
                            >

                                {
                                    value
                                }

                            </p>


                            <p
                                className="
                                    text-xs
                                    text-slate-400
                                "
                            >

                                {
                                    label
                                }

                            </p>

                        </div>

                    )
                )}

            </div>


            {/* =============================================
                UPDATE BAR
            ============================================== */}

            <div
                className="
                    flex
                    items-center
                    justify-between
                    px-4
                    pb-2
                    text-xs
                    text-slate-400
                "
            >

                <div
                    className="
                        flex
                        items-center
                        gap-3
                    "
                >

                    <span>

                        {
                            loading

                                ? "Loading NASA FIRMS…"

                                : updated

                                    ? `Updated ${updated.toLocaleString()}`

                                    : "Not updated"
                        }

                    </span>


                    {historicalSelectedId && (

                        <span
                            className="
                                flex
                                items-center
                                gap-1.5
                                rounded-full
                                border
                                border-cyan-400/15
                                bg-cyan-400/[0.05]
                                px-2
                                py-1
                                text-[10px]
                                text-cyan-300
                            "
                        >

                            <Archive
                                className="
                                    h-3
                                    w-3
                                "
                            />

                            Viewing stored observation

                        </span>

                    )}

                </div>


                <button
                    onClick={
                        load
                    }
                    disabled={
                        loading
                    }
                    className="
                        rounded-lg
                        bg-white/5
                        px-3
                        py-1.5
                        transition
                        hover:bg-white/10
                        disabled:opacity-50
                    "
                >

                    Refresh

                </button>

            </div>


            {/* =============================================
                ERROR
            ============================================== */}

            {error && (

                <div
                    role="alert"
                    className="
                        mx-4
                        mb-2
                        rounded-lg
                        border
                        border-red-500/30
                        bg-red-500/10
                        p-3
                        text-xs
                        text-red-300
                    "
                >

                    {
                        error
                    }

                </div>

            )}


            {/* =============================================
                MAP AREA
            ============================================== */}

            <div
                className="
                    flex
                    min-h-0
                    flex-1
                    gap-3
                    px-4
                    pb-4
                "
            >

                <div
                    className="
                        relative
                        min-h-[500px]
                        flex-[3]
                        overflow-hidden
                        rounded-2xl
                        border
                        border-white/10
                    "
                >

                    <LiveMap
                        hotspots={
                            hotspots
                        }

                        selected={
                            selected
                        }

                        onSelect={
                            select
                        }

                        onAnalyze={
                            analyze
                        }

                        analyzingId={
                            analyzingId
                        }

                        locatingId={
                            locatingId
                        }

                        focusTarget={
                            requestedFocus
                        }

                        historicalSelectedId={
                            historicalSelectedId
                        }
                    />


                    {loading && (

                        <div
                            className="
                                absolute
                                inset-0
                                z-[1200]
                                grid
                                place-items-center
                                bg-ink-900/50
                                text-sm
                            "
                        >

                            Loading live hotspots…

                        </div>

                    )}

                </div>


                {/* =========================================
                    INFORMATION PANEL
                ========================================== */}

                <aside
                    className="
                        hidden
                        flex-[1.1]
                        overflow-y-auto
                        rounded-2xl
                        border
                        border-slate-200
                        bg-ink-800/80
                        p-5
                        shadow-sm
                        dark:border-white/10
                        dark:shadow-none
                        xl:block
                    "
                >

                    {selected ? (

                        <>

                            {historicalSelectedId ===
                                selected.id && (

                                    <div
                                        className="
                                        mb-3
                                        flex
                                        items-center
                                        gap-2
                                        rounded-lg
                                        border
                                        border-cyan-400/10
                                        bg-cyan-400/[0.04]
                                        px-3
                                        py-2
                                    "
                                    >

                                        <Archive
                                            className="
                                            h-3.5
                                            w-3.5
                                            text-cyan-300
                                        "
                                        />


                                        <span
                                            className="
                                            text-[10px]
                                            font-medium
                                            text-cyan-300
                                        "
                                        >

                                            Historical stored FIRMS observation

                                        </span>

                                    </div>

                                )}


                            <h2
                                className="
                                    text-lg
                                    font-bold
                                "
                            >

                                {
                                    selected.name ||
                                    "FIRMS Thermal Observation"
                                }

                            </h2>


                            <p
                                className="
                                    text-xs
                                    text-slate-400
                                "
                            >

                                {
                                    selected.lat.toFixed(
                                        4
                                    )
                                }

                                ,{" "}

                                {
                                    selected.lng.toFixed(
                                        4
                                    )
                                }

                            </p>


                            {/* LOCATION */}

                            <div
                                className="
                                    mt-3
                                    rounded-lg
                                    bg-slate-100
                                    p-3
                                    dark:bg-white/5
                                "
                            >

                                <p
                                    className="
                                        text-xs
                                        text-slate-500
                                        dark:text-slate-400
                                    "
                                >

                                    Location

                                </p>


                                <p
                                    className="
                                        mt-1
                                        text-sm
                                        font-semibold
                                    "
                                >

                                    {
                                        locatingId ===
                                            selected.id

                                            ? "Locating…"

                                            : selected.state &&
                                                selected.state !==
                                                "Unresolved"

                                                ? selected.state

                                                : "Location unavailable"
                                    }

                                </p>

                            </div>


                            {/* FIRMS TIME */}

                            <div
                                className="
                                    mt-3
                                    rounded-lg
                                    bg-slate-100
                                    p-3
                                    dark:bg-white/5
                                "
                            >

                                <p
                                    className="
                                        text-xs
                                        text-slate-500
                                        dark:text-slate-400
                                    "
                                >

                                    FIRMS Acquisition Time

                                </p>


                                <p
                                    className="
                                        mt-1
                                        text-sm
                                        font-semibold
                                    "
                                >

                                    {
                                        selected.acquiredAt

                                            ? new Date(
                                                selected.acquiredAt
                                            ).toLocaleString()

                                            : "Unknown"
                                    }

                                </p>

                            </div>


                            {/* METRICS */}

                            <div
                                className="
                                    mt-3
                                    grid
                                    grid-cols-2
                                    gap-2
                                    text-xs
                                "
                            >

                                <Metric
                                    label="Risk"
                                    value={
                                        `${selected.riskScore} · ${selected.riskLevel}`
                                    }
                                />


                                <Metric
                                    label="Land type"
                                    value={
                                        selected.landType &&
                                            selected.landType !==
                                            "Unknown"

                                            ? selected.landType

                                            : "Not analysed"
                                    }
                                />


                                <Metric
                                    label="Brightness"
                                    value={
                                        `${selected.brightness.toFixed(
                                            1
                                        )} K`
                                    }
                                />


                                <Metric
                                    label="FRP"
                                    value={
                                        `${selected.frp.toFixed(
                                            1
                                        )} MW`
                                    }
                                />

                            </div>


                            {/* RECOMMENDATION */}

                            {selected.recommendation && (

                                <>

                                    <h3
                                        className="
                                            mt-5
                                            text-xs
                                            font-bold
                                            uppercase
                                            text-slate-600
                                            dark:text-slate-400
                                        "
                                    >

                                        Risk recommendation

                                    </h3>


                                    <p
                                        className="
                                            mt-2
                                            text-sm
                                            leading-relaxed
                                            text-slate-700
                                            dark:text-slate-300
                                        "
                                    >

                                        {
                                            selected.recommendation
                                        }

                                    </p>

                                </>

                            )}


                            {/* RISK EXPLANATION */}

                            {selected.riskExplanation &&
                                selected.riskExplanation.length > 0 && (

                                    <>

                                        <h3
                                            className="
                                            mt-5
                                            text-xs
                                            font-bold
                                            uppercase
                                            text-slate-600
                                            dark:text-slate-400
                                        "
                                        >

                                            Risk explanation

                                        </h3>


                                        <ul
                                            className="
                                            mt-2
                                            space-y-1
                                            text-xs
                                            text-slate-700
                                            dark:text-slate-300
                                        "
                                        >

                                            {
                                                selected.riskExplanation.map(
                                                    explanation => (

                                                        <li
                                                            key={
                                                                explanation
                                                            }
                                                        >

                                                            •{" "}
                                                            {
                                                                explanation
                                                            }

                                                        </li>

                                                    )
                                                )
                                            }

                                        </ul>

                                    </>

                                )}


                            {/* FULL ANALYSIS */}

                            <button
                                onClick={() =>
                                    analyze(
                                        selected
                                    )
                                }
                                disabled={
                                    analyzingId ===
                                    selected.id
                                }
                                className="
                                    mt-5
                                    w-full
                                    rounded-lg
                                    bg-fire-500/20
                                    px-4
                                    py-2
                                    text-xs
                                    text-fire-300
                                    transition
                                    hover:bg-fire-500/30
                                    disabled:opacity-50
                                "
                            >

                                {
                                    analyzingId ===
                                        selected.id

                                        ? "Analyzing…"

                                        : "View Full Analysis"
                                }

                            </button>

                        </>

                    ) : (

                        <p
                            className="
                                text-sm
                                text-slate-400
                            "
                        >

                            Select a thermal hotspot to
                            view its FIRMS observation
                            and location.

                        </p>

                    )}

                </aside>

            </div>


            {/* =============================================
                FULL ANALYSIS DRAWER
            ============================================== */}

            <RiskAnalysisPanel
                hotspot={
                    selected
                }

                open={
                    analysisOpen
                }

                onClose={() =>
                    setAnalysisOpen(
                        false
                    )
                }
            />

        </div>

    );
}


/* ========================================================
   METRIC
======================================================== */

function Metric({
    label,
    value,
}: {
    label: string;
    value: string;
}) {

    return (

        <div
            className="
                rounded-lg
                bg-slate-100
                p-3
                dark:bg-white/5
            "
        >

            <p
                className="
                    text-slate-500
                    dark:text-slate-400
                "
            >

                {
                    label
                }

            </p>


            <p
                className="
                    mt-1
                    font-semibold
                    text-slate-900
                    dark:text-white
                "
            >

                {
                    value
                }

            </p>

        </div>

    );
}