import {
    useEffect,
    useState,
} from "react";

import {
    useNavigate,
} from "react-router-dom";

import {
    Activity,
    CalendarDays,
    Clock3,
    Database,
    Flame,
    Gauge,
    History,
    MapPin,
    Moon,
    Radio,
    RefreshCw,
    Satellite,
    Sun,
    TrendingUp,
} from "lucide-react";

import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import {
    getLocation,
} from "@/services/api";


/* =========================================================
   TYPES
========================================================= */

type PageMode =
    | "analytics"
    | "repeated";


interface DailyObservation {

    date: string;

    count: number;

    averageBrightness:
    number | null;

    averageFrp:
    number | null;

    averageRiskScore:
    number | null;
}


interface RiskScoreRange {

    range: string;

    count: number;
}


interface SatelliteDistribution {

    satellite: string;

    count: number;
}


interface DayNightDistribution {

    period: string;

    code: string | null;

    count: number;
}


interface TopObservation {

    id: string;

    lat: number;

    lng: number;

    brightness:
    number | null;

    brightTi5?:
    number | null;

    frp:
    number | null;

    confidence:
    number | null;

    rawConfidence?:
    string | null;

    riskScore:
    number | null;

    riskLevel:
    string | null;

    acquiredAt: string;

    satellite:
    string | null;

    instrument?:
    string | null;

    dayNight?:
    string | null;

    sourceProduct?:
    string | null;
}


interface HistoricalAnalytics {

    source: string;

    dataType: string;

    totalObservations: number;

    uniqueObservationDates: number;

    earliestObservation:
    string | null;

    latestObservation:
    string | null;

    averages: {

        brightness:
        number | null;

        frp:
        number | null;

        heuristicRiskScore:
        number | null;
    };

    riskDistribution:
    Record<string, number>;

    riskScoreDistribution:
    RiskScoreRange[];

    dailyObservations:
    DailyObservation[];

    satelliteDistribution:
    SatelliteDistribution[];

    dayNightDistribution:
    DayNightDistribution[];

    topRiskObservations:
    TopObservation[];

    highestFrpObservation:
    TopObservation | null;

    highestRiskObservation:
    TopObservation | null;

    note: string;
}


interface HotspotLocation {

    title: string;

    subtitle: string;
}


/* =========================================================
   REPEATED THERMAL LOCATION TYPES
========================================================= */

interface RepeatedClassification {

    label:
    string | null;

    confidence:
    number | null;

    modelStatus: string;
}


interface RepeatedThermalLocation {

    id: string;

    status: string;

    repeatActivity: boolean;

    lat: number;

    lng: number;

    detections: number;

    distinctActiveDays: number;

    observationSpanDays: number;

    activeDayFraction: number;

    firstObserved: string;

    latestObserved: string;

    firstAcquiredAt: string;

    latestAcquiredAt: string;

    meanDetectionDistanceM:
    number | null;

    maxDetectionDistanceM:
    number | null;

    meanGapDays:
    number | null;

    minGapDays:
    number | null;

    maxGapDays:
    number | null;

    averageFrp:
    number | null;

    maximumFrp:
    number | null;

    averageBrightness:
    number | null;

    maximumBrightness:
    number | null;

    averageConfidence:
    number | null;

    dayDetections: number;

    nightDetections: number;

    satellites:
    string[];

    riskAssessedObservations:
    number;

    highestHeuristicRiskScore:
    number | null;

    latestObservationId:
    string;

    classification:
    RepeatedClassification;
}


interface RepeatedLocationsResponse {

    source: string;

    dataType: string;

    method: string;

    requestedDays: number;

    referenceDate:
    string | null;

    windowStart:
    string | null;

    clusteringRadiusKm: number;

    minimumDistinctActiveDays:
    number;

    observationsEvaluated:
    number;

    storedObservationDays:
    number;

    earliestStoredDate?:
    string | null;

    latestStoredDate?:
    string | null;

    count: number;

    locations:
    RepeatedThermalLocation[];

    note: string;
}


/* =========================================================
   CONFIG
========================================================= */

const API_BASE =
    import.meta.env.VITE_API_BASE_URL ||
    "http://127.0.0.1:8000";


const RISK_COLORS = [
    "#22c55e",
    "#eab308",
    "#f97316",
    "#ef4444",
];


const TOOLTIP_STYLE = {

    backgroundColor:
        "#0f172a",

    border:
        "1px solid rgba(34,211,238,0.18)",

    borderRadius:
        "12px",

    fontSize:
        "12px",

    color:
        "#e2e8f0",
};


/* =========================================================
   PAGE
========================================================= */

export default function GISHistoryPage() {

    const navigate =
        useNavigate();


    /* =====================================================
       PAGE MODE
    ===================================================== */

    const [
        mode,
        setMode,
    ] = useState<PageMode>(
        "analytics"
    );


    /* =====================================================
       ANALYTICS STATE
    ===================================================== */

    const [
        data,
        setData,
    ] = useState<
        HistoricalAnalytics | null
    >(
        null
    );


    const [
        loading,
        setLoading,
    ] = useState(
        true
    );


    const [
        error,
        setError,
    ] = useState<
        string | null
    >(
        null
    );


    const [
        locations,
        setLocations,
    ] = useState<
        Record<
            string,
            HotspotLocation
        >
    >({});


    /* =====================================================
       REPEATED LOCATION STATE
    ===================================================== */

    const [
        repeatedData,
        setRepeatedData,
    ] = useState<
        RepeatedLocationsResponse | null
    >(
        null
    );


    const [
        repeatedLoading,
        setRepeatedLoading,
    ] = useState(
        false
    );


    const [
        repeatedError,
        setRepeatedError,
    ] = useState<
        string | null
    >(
        null
    );


    const [
        repeatedLocations,
        setRepeatedLocations,
    ] = useState<
        Record<
            string,
            HotspotLocation
        >
    >({});


    /* =====================================================
       LOAD ANALYTICS
    ===================================================== */

    useEffect(() => {

        async function loadAnalytics() {

            try {

                setLoading(
                    true
                );

                setError(
                    null
                );


                const response =
                    await fetch(
                        `${API_BASE}/storage/analytics`
                    );


                if (!response.ok) {

                    throw new Error(
                        `Request failed with status ${response.status}`
                    );
                }


                const result:
                    HistoricalAnalytics =
                    await response.json();


                setData(
                    result
                );
            }
            catch (err) {

                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load GIS history"
                );
            }
            finally {

                setLoading(
                    false
                );
            }
        }


        loadAnalytics();

    }, []);


    /* =====================================================
       LOAD REPEATED LOCATIONS
    ===================================================== */

    async function loadRepeatedLocations() {

        try {

            setRepeatedLoading(
                true
            );

            setRepeatedError(
                null
            );


            const response =
                await fetch(
                    `${API_BASE}/storage/repeated-locations?days=30&radius_km=1&min_active_days=2&limit=100`
                );


            if (!response.ok) {

                throw new Error(
                    `Request failed with status ${response.status}`
                );
            }


            const result:
                RepeatedLocationsResponse =
                await response.json();


            setRepeatedData(
                result
            );
        }
        catch (err) {

            setRepeatedError(
                err instanceof Error
                    ? err.message
                    : "Unable to load repeated thermal locations"
            );
        }
        finally {

            setRepeatedLoading(
                false
            );
        }
    }


    useEffect(() => {

        if (
            mode !== "repeated"
            ||
            repeatedData
            ||
            repeatedLoading
        ) {

            return;
        }


        loadRepeatedLocations();

    }, [
        mode,
        repeatedData,
        repeatedLoading,
    ]);


    /* =====================================================
       REVERSE GEOCODE TOP RISK OBSERVATIONS
    ===================================================== */

    useEffect(() => {

        if (
            !data?.topRiskObservations?.length
        ) {

            return;
        }


        let cancelled =
            false;


        async function loadLocations() {

            for (
                const hotspot
                of data!.topRiskObservations
            ) {

                if (
                    locations[
                    hotspot.id
                    ]
                ) {

                    continue;
                }


                try {

                    const location =
                        await getLocation(
                            hotspot.lat,
                            hotspot.lng
                        );


                    if (cancelled) {

                        return;
                    }


                    const title =
                        location.district ||
                        location.city ||
                        location.state ||
                        location.country ||
                        "Unknown location";


                    const parts = [

                        location.state,

                        location.country,

                    ]
                        .filter(Boolean)
                        .filter(
                            (
                                value,
                                index,
                                array
                            ) =>
                                array.indexOf(
                                    value
                                ) === index
                        );


                    setLocations(
                        previous => ({

                            ...previous,

                            [hotspot.id]: {

                                title,

                                subtitle:
                                    parts.length > 0
                                        ? parts.join(
                                            ", "
                                        )
                                        : `${hotspot.lat.toFixed(
                                            4
                                        )}, ${hotspot.lng.toFixed(
                                            4
                                        )}`,
                            },
                        })
                    );
                }
                catch {

                    if (cancelled) {

                        return;
                    }


                    setLocations(
                        previous => ({

                            ...previous,

                            [hotspot.id]: {

                                title:
                                    "Location unavailable",

                                subtitle:
                                    `${hotspot.lat.toFixed(
                                        4
                                    )}, ${hotspot.lng.toFixed(
                                        4
                                    )}`,
                            },
                        })
                    );
                }
            }
        }


        loadLocations();


        return () => {

            cancelled =
                true;
        };

    }, [
        data,
    ]);


    /* =====================================================
       REVERSE GEOCODE REPEATED LOCATIONS
    ===================================================== */

    useEffect(() => {

        if (
            !repeatedData?.locations?.length
        ) {

            return;
        }


        let cancelled =
            false;


        async function resolveRepeatedLocations() {

            for (
                const item
                of repeatedData!.locations
            ) {

                if (
                    repeatedLocations[
                    item.id
                    ]
                ) {

                    continue;
                }


                try {

                    const location =
                        await getLocation(
                            item.lat,
                            item.lng
                        );


                    if (cancelled) {

                        return;
                    }


                    const title =
                        location.district ||
                        location.city ||
                        location.state ||
                        location.country ||
                        "Unknown location";


                    const parts = [

                        location.state,

                        location.country,

                    ]
                        .filter(Boolean)
                        .filter(
                            (
                                value,
                                index,
                                array
                            ) =>
                                array.indexOf(
                                    value
                                ) === index
                        );


                    setRepeatedLocations(
                        previous => ({

                            ...previous,

                            [item.id]: {

                                title,

                                subtitle:
                                    parts.length > 0
                                        ? parts.join(
                                            ", "
                                        )
                                        : `${item.lat.toFixed(
                                            4
                                        )}, ${item.lng.toFixed(
                                            4
                                        )}`,
                            },
                        })
                    );
                }
                catch {

                    if (cancelled) {

                        return;
                    }


                    setRepeatedLocations(
                        previous => ({

                            ...previous,

                            [item.id]: {

                                title:
                                    "Location unavailable",

                                subtitle:
                                    `${item.lat.toFixed(
                                        4
                                    )}, ${item.lng.toFixed(
                                        4
                                    )}`,
                            },
                        })
                    );
                }
            }
        }


        resolveRepeatedLocations();


        return () => {

            cancelled =
                true;
        };

    }, [
        repeatedData,
    ]);


    /* =====================================================
       LOADING
    ===================================================== */

    if (loading) {

        return (

            <div
                className="
                    flex
                    min-h-[60vh]
                    items-center
                    justify-center
                "
            >

                <div
                    className="
                        text-center
                    "
                >

                    <Activity
                        className="
                            mx-auto
                            h-7
                            w-7
                            animate-pulse
                            text-cyan-300
                        "
                    />


                    <p
                        className="
                            mt-3
                            text-sm
                            text-slate-400
                        "
                    >

                        Loading GIS history...

                    </p>

                </div>

            </div>
        );
    }


    /* =====================================================
       ERROR
    ===================================================== */

    if (
        error
        ||
        !data
    ) {

        return (

            <div
                className="
                    rounded-2xl
                    border
                    border-red-400/20
                    bg-red-400/[0.04]
                    p-5
                "
            >

                <p
                    className="
                        text-sm
                        font-medium
                        text-red-300
                    "
                >

                    Unable to load GIS history

                </p>


                <p
                    className="
                        mt-1
                        text-xs
                        text-slate-400
                    "
                >

                    {error}

                </p>

            </div>
        );
    }


    /* =====================================================
       ANALYTICS DERIVED DATA
    ===================================================== */

    const riskChartData = [

        {
            name:
                "Low",

            value:
                data.riskDistribution.Low ||
                0,
        },

        {
            name:
                "Moderate",

            value:
                data.riskDistribution.Moderate ||
                0,
        },

        {
            name:
                "High",

            value:
                data.riskDistribution.High ||
                0,
        },

        {
            name:
                "Extreme",

            value:
                data.riskDistribution.Extreme ||
                0,
        },

    ].filter(
        item =>
            item.value > 0
    );


    const day =
        data.dayNightDistribution.find(
            item =>
                item.code === "D"
        )?.count || 0;


    const night =
        data.dayNightDistribution.find(
            item =>
                item.code === "N"
        )?.count || 0;


    const dayNightTotal =
        day + night;


    const dayPercent =
        dayNightTotal > 0
            ? Math.round(
                (
                    day /
                    dayNightTotal
                )
                *
                100
            )
            : 0;


    const nightPercent =
        dayNightTotal > 0
            ? 100 - dayPercent
            : 0;


    /* =====================================================
       VIEW OBSERVATION ON MAP
    ===================================================== */

    function viewOnMap(
        hotspot: TopObservation
    ) {

        navigate(
            `/?lat=${hotspot.lat}&lng=${hotspot.lng}&hotspot=${encodeURIComponent(
                hotspot.id
            )}`
        );
    }


    /* =====================================================
       VIEW REPEATED LOCATION ON MAP
    ===================================================== */

    function viewRepeatedOnMap(
        location:
            RepeatedThermalLocation
    ) {

        navigate(
            `/?lat=${location.lat}&lng=${location.lng}&hotspot=${encodeURIComponent(
                location.latestObservationId
            )}`
        );
    }


    return (

        <div
            className="
                space-y-5
                pb-6
            "
        >

            {/* =================================================
                HEADER
            ================================================== */}

            <section
                className="
                    flex
                    flex-col
                    gap-4
                    sm:flex-row
                    sm:items-center
                    sm:justify-between
                "
            >

                <div
                    className="
                        flex
                        items-center
                        gap-3
                    "
                >

                    <div
                        className="
                            flex
                            h-10
                            w-10
                            items-center
                            justify-center
                            rounded-xl
                            bg-cyan-400/10
                        "
                    >

                        <Database
                            className="
                                h-5
                                w-5
                                text-cyan-300
                            "
                        />

                    </div>


                    <div>

                        <h1
                            className="
                                text-xl
                                font-bold
                                text-white
                            "
                        >

                            GIS History & Analytics

                        </h1>


                        <p
                            className="
                                text-xs
                                text-slate-400
                            "
                        >

                            Persistent spatial intelligence from stored NASA FIRMS observations

                        </p>

                    </div>

                </div>


                <div
                    className="
                        flex
                        items-center
                        gap-2
                        rounded-xl
                        border
                        border-emerald-400/10
                        bg-emerald-400/[0.035]
                        px-3
                        py-2
                    "
                >

                    <span
                        className="
                            h-2
                            w-2
                            rounded-full
                            bg-emerald-400
                        "
                    />


                    <span
                        className="
                            text-[10px]
                            font-medium
                            text-emerald-300
                        "
                    >

                        Persistent GIS Database Active

                    </span>

                </div>

            </section>


            {/* =================================================
                MODE SWITCH
            ================================================== */}

            <section
                className="
                    inline-flex
                    rounded-xl
                    border
                    border-cyan-400/10
                    bg-ink-800/60
                    p-1
                "
            >

                <button
                    onClick={() =>
                        setMode(
                            "analytics"
                        )
                    }
                    className={`
                        flex
                        items-center
                        gap-2
                        rounded-lg
                        px-4
                        py-2
                        text-[11px]
                        font-medium
                        transition

                        ${mode === "analytics"
                            ? "bg-cyan-400/10 text-cyan-300"
                            : "text-slate-500 hover:text-slate-300"
                        }
                    `}
                >

                    <Database
                        className="
                            h-3.5
                            w-3.5
                        "
                    />

                    Database Analytics

                </button>


                <button
                    onClick={() =>
                        setMode(
                            "repeated"
                        )
                    }
                    className={`
                        flex
                        items-center
                        gap-2
                        rounded-lg
                        px-4
                        py-2
                        text-[11px]
                        font-medium
                        transition

                        ${mode === "repeated"
                            ? "bg-cyan-400/10 text-cyan-300"
                            : "text-slate-500 hover:text-slate-300"
                        }
                    `}
                >

                    <History
                        className="
                            h-3.5
                            w-3.5
                        "
                    />

                    Repeated Thermal Locations

                </button>

            </section>


            {/* =================================================
                DATABASE ANALYTICS MODE
            ================================================== */}

            {mode === "analytics" && (

                <>

                    {/* ==========================================
                        SUMMARY CARDS
                    =========================================== */}

                    <section
                        className="
                            grid
                            grid-cols-1
                            gap-3
                            sm:grid-cols-2
                            xl:grid-cols-4
                        "
                    >

                        <StatCard
                            title="Stored Observations"
                            value={
                                data.totalObservations.toLocaleString()
                            }
                            subtitle="Persisted FIRMS detections"
                            icon={Database}
                        />


                        <StatCard
                            title="Observation Days"
                            value={
                                data.uniqueObservationDates.toString()
                            }
                            subtitle="Distinct acquisition dates"
                            icon={CalendarDays}
                        />


                        <StatCard
                            title="Average FRP"
                            value={
                                data.averages.frp !== null
                                    ? data.averages.frp.toFixed(
                                        2
                                    )
                                    : "—"
                            }
                            subtitle="MW across stored observations"
                            icon={Flame}
                        />


                        <StatCard
                            title="Average Risk"
                            value={
                                data.averages.heuristicRiskScore !==
                                    null
                                    ? data.averages.heuristicRiskScore.toFixed(
                                        2
                                    )
                                    : "—"
                            }
                            subtitle="Heuristic FIRMS Risk Index"
                            icon={Gauge}
                        />

                    </section>


                    {/* ==========================================
                        HISTORICAL ACTIVITY
                    =========================================== */}

                    <Panel
                        title="Historical Thermal Activity"
                        subtitle="Daily statistics calculated from persisted FIRMS observations"
                    >

                        <div
                            className="
                                h-[280px]
                                w-full
                            "
                        >

                            <ResponsiveContainer
                                width="100%"
                                height="100%"
                            >

                                <LineChart
                                    data={
                                        data.dailyObservations
                                    }
                                    margin={{
                                        top: 10,
                                        right: 15,
                                        left: -15,
                                        bottom: 0,
                                    }}
                                >

                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="rgba(148,163,184,0.08)"
                                        vertical={false}
                                    />


                                    <XAxis
                                        dataKey="date"
                                        tick={{
                                            fill:
                                                "#64748b",
                                            fontSize:
                                                10,
                                        }}
                                        axisLine={false}
                                        tickLine={false}
                                    />


                                    <YAxis
                                        yAxisId="left"
                                        tick={{
                                            fill:
                                                "#64748b",
                                            fontSize:
                                                10,
                                        }}
                                        axisLine={false}
                                        tickLine={false}
                                    />


                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        tick={{
                                            fill:
                                                "#64748b",
                                            fontSize:
                                                10,
                                        }}
                                        axisLine={false}
                                        tickLine={false}
                                    />


                                    <Tooltip
                                        contentStyle={
                                            TOOLTIP_STYLE
                                        }
                                    />


                                    <Legend
                                        wrapperStyle={{
                                            fontSize:
                                                "11px",
                                        }}
                                    />


                                    <Line
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey="count"
                                        name="Detections"
                                        stroke="#22d3ee"
                                        strokeWidth={2}
                                        dot={{
                                            r: 3,
                                        }}
                                    />


                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="averageFrp"
                                        name="Avg FRP"
                                        stroke="#f97316"
                                        strokeWidth={2}
                                        dot={{
                                            r: 3,
                                        }}
                                    />


                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="averageRiskScore"
                                        name="Avg Risk"
                                        stroke="#a78bfa"
                                        strokeWidth={2}
                                        dot={{
                                            r: 3,
                                        }}
                                    />

                                </LineChart>

                            </ResponsiveContainer>

                        </div>


                        {data.dailyObservations.length < 3 && (

                            <CoverageNotice>

                                Historical coverage is currently limited to{" "}
                                {data.uniqueObservationDates} observation
                                days. The trend becomes more informative as
                                FireWatch accumulates more FIRMS observations.

                            </CoverageNotice>

                        )}

                    </Panel>


                    {/* ==========================================
                        RISK ANALYTICS
                    =========================================== */}

                    <section
                        className="
                            grid
                            grid-cols-1
                            gap-4
                            xl:grid-cols-2
                        "
                    >

                        <Panel
                            title="Risk Distribution"
                            subtitle="Stored observations with a FireWatch Heuristic FIRMS Risk Index"
                        >

                            <div
                                className="
                                    h-[250px]
                                    w-full
                                "
                            >

                                <ResponsiveContainer
                                    width="100%"
                                    height="100%"
                                >

                                    <PieChart>

                                        <Pie
                                            data={
                                                riskChartData
                                            }
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="48%"
                                            innerRadius={58}
                                            outerRadius={88}
                                            paddingAngle={3}
                                        >

                                            {riskChartData.map(
                                                (
                                                    entry,
                                                    index
                                                ) => (

                                                    <Cell
                                                        key={
                                                            entry.name
                                                        }
                                                        fill={
                                                            RISK_COLORS[
                                                            index %
                                                            RISK_COLORS.length
                                                            ]
                                                        }
                                                    />

                                                )
                                            )}

                                        </Pie>


                                        <Tooltip
                                            contentStyle={
                                                TOOLTIP_STYLE
                                            }
                                        />


                                        <Legend
                                            verticalAlign="bottom"
                                            wrapperStyle={{
                                                fontSize:
                                                    "11px",
                                            }}
                                        />

                                    </PieChart>

                                </ResponsiveContainer>

                            </div>

                        </Panel>


                        <Panel
                            title="Risk Score Distribution"
                            subtitle="Distribution of stored observations that have heuristic risk assessment"
                        >

                            <div
                                className="
                                    h-[250px]
                                    w-full
                                "
                            >

                                <ResponsiveContainer
                                    width="100%"
                                    height="100%"
                                >

                                    <BarChart
                                        data={
                                            data.riskScoreDistribution
                                        }
                                        margin={{
                                            top: 10,
                                            right: 10,
                                            left: -20,
                                            bottom: 0,
                                        }}
                                    >

                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            stroke="rgba(148,163,184,0.08)"
                                            vertical={false}
                                        />


                                        <XAxis
                                            dataKey="range"
                                            tick={{
                                                fill:
                                                    "#64748b",
                                                fontSize:
                                                    10,
                                            }}
                                            axisLine={false}
                                            tickLine={false}
                                        />


                                        <YAxis
                                            tick={{
                                                fill:
                                                    "#64748b",
                                                fontSize:
                                                    10,
                                            }}
                                            axisLine={false}
                                            tickLine={false}
                                        />


                                        <Tooltip
                                            contentStyle={
                                                TOOLTIP_STYLE
                                            }
                                        />


                                        <Bar
                                            dataKey="count"
                                            name="Stored Detections"
                                            fill="#22d3ee"
                                            radius={[
                                                6,
                                                6,
                                                0,
                                                0,
                                            ]}
                                            maxBarSize={65}
                                        />

                                    </BarChart>

                                </ResponsiveContainer>

                            </div>

                        </Panel>

                    </section>


                    {/* ==========================================
                        DAY NIGHT + SATELLITE
                    =========================================== */}

                    <section
                        className="
                            grid
                            grid-cols-1
                            gap-4
                            xl:grid-cols-2
                        "
                    >

                        <Panel
                            title="Day / Night Activity"
                            subtitle="FIRMS observations grouped by acquisition period"
                        >

                            <div
                                className="
                                    grid
                                    grid-cols-2
                                    gap-3
                                "
                            >

                                <ContextCard
                                    icon={Sun}
                                    label="Day"
                                    value={day}
                                    secondary={`${dayPercent}%`}
                                    iconClass="text-amber-300"
                                />


                                <ContextCard
                                    icon={Moon}
                                    label="Night"
                                    value={night}
                                    secondary={`${nightPercent}%`}
                                    iconClass="text-cyan-300"
                                />

                            </div>


                            <div
                                className="
                                    mt-4
                                    flex
                                    h-2
                                    overflow-hidden
                                    rounded-full
                                    bg-slate-800
                                "
                            >

                                {dayNightTotal > 0 && (

                                    <>

                                        <div
                                            className="
                                                bg-amber-400
                                            "
                                            style={{
                                                width:
                                                    `${dayPercent}%`,
                                            }}
                                        />


                                        <div
                                            className="
                                                bg-cyan-400
                                            "
                                            style={{
                                                width:
                                                    `${nightPercent}%`,
                                            }}
                                        />

                                    </>

                                )}

                            </div>

                        </Panel>


                        <Panel
                            title="FIRMS Data Sources"
                            subtitle="Satellite platforms represented in persistent FIRMS storage"
                        >

                            <div
                                className="
                                    space-y-2
                                "
                            >

                                {data.satelliteDistribution.map(
                                    item => (

                                        <div
                                            key={
                                                item.satellite
                                            }
                                            className="
                                                flex
                                                items-center
                                                justify-between
                                                rounded-xl
                                                border
                                                border-cyan-400/[0.06]
                                                bg-cyan-400/[0.025]
                                                px-3
                                                py-3
                                            "
                                        >

                                            <div
                                                className="
                                                    flex
                                                    items-center
                                                    gap-2.5
                                                "
                                            >

                                                <Satellite
                                                    className="
                                                        h-4
                                                        w-4
                                                        text-cyan-300
                                                    "
                                                />


                                                <div>

                                                    <p
                                                        className="
                                                            text-xs
                                                            font-medium
                                                            text-slate-200
                                                        "
                                                    >

                                                        {item.satellite}

                                                    </p>


                                                    <p
                                                        className="
                                                            mt-0.5
                                                            text-[9px]
                                                            text-slate-500
                                                        "
                                                    >

                                                        FIRMS satellite source

                                                    </p>

                                                </div>

                                            </div>


                                            <span
                                                className="
                                                    text-sm
                                                    font-semibold
                                                    text-white
                                                "
                                            >

                                                {item.count}

                                            </span>

                                        </div>

                                    )
                                )}

                            </div>

                        </Panel>

                    </section>


                    {/* ==========================================
                        TOP STORED RISK
                    =========================================== */}

                    <section
                        className="
                            grid
                            grid-cols-1
                            gap-4
                            xl:grid-cols-[1.45fr_1fr]
                        "
                    >

                        <Panel
                            title="Top Stored Risk Observations"
                            subtitle="Highest heuristic-risk FIRMS detections in persistent storage"
                        >

                            <div
                                className="
                                    max-h-[430px]
                                    space-y-2
                                    overflow-y-auto
                                    pr-1
                                "
                            >

                                {data.topRiskObservations.map(
                                    (
                                        hotspot,
                                        index
                                    ) => {

                                        const location =
                                            locations[
                                            hotspot.id
                                            ];


                                        return (

                                            <div
                                                key={
                                                    hotspot.id
                                                }
                                                className="
                                                    rounded-xl
                                                    border
                                                    border-cyan-400/[0.06]
                                                    bg-black/10
                                                    px-3
                                                    py-3
                                                "
                                            >

                                                <div
                                                    className="
                                                        flex
                                                        items-start
                                                        gap-3
                                                    "
                                                >

                                                    <div
                                                        className="
                                                            flex
                                                            h-8
                                                            w-8
                                                            shrink-0
                                                            items-center
                                                            justify-center
                                                            rounded-lg
                                                            bg-cyan-400/[0.07]
                                                            text-[11px]
                                                            font-semibold
                                                            text-cyan-300
                                                        "
                                                    >

                                                        {index + 1}

                                                    </div>


                                                    <div
                                                        className="
                                                            min-w-0
                                                            flex-1
                                                        "
                                                    >

                                                        <div
                                                            className="
                                                                flex
                                                                flex-wrap
                                                                items-center
                                                                gap-2
                                                            "
                                                        >

                                                            <span
                                                                className="
                                                                    text-sm
                                                                    font-semibold
                                                                    text-white
                                                                "
                                                            >

                                                                Risk{" "}
                                                                {formatNumber(
                                                                    hotspot.riskScore,
                                                                    0
                                                                )}

                                                            </span>


                                                            {hotspot.riskLevel && (

                                                                <RiskBadge
                                                                    level={
                                                                        hotspot.riskLevel
                                                                    }
                                                                />

                                                            )}

                                                        </div>


                                                        <div
                                                            className="
                                                                mt-2
                                                                flex
                                                                items-start
                                                                gap-2
                                                            "
                                                        >

                                                            <MapPin
                                                                className="
                                                                    mt-0.5
                                                                    h-3.5
                                                                    w-3.5
                                                                    shrink-0
                                                                    text-cyan-300
                                                                "
                                                            />


                                                            <div>

                                                                <p
                                                                    className="
                                                                        text-xs
                                                                        font-medium
                                                                        text-slate-200
                                                                    "
                                                                >

                                                                    {location?.title ??
                                                                        "Resolving location..."}

                                                                </p>


                                                                <p
                                                                    className="
                                                                        mt-0.5
                                                                        text-[10px]
                                                                        text-slate-500
                                                                    "
                                                                >

                                                                    {location?.subtitle ??
                                                                        `${hotspot.lat.toFixed(
                                                                            4
                                                                        )}, ${hotspot.lng.toFixed(
                                                                            4
                                                                        )}`}

                                                                </p>

                                                            </div>

                                                        </div>


                                                        <div
                                                            className="
                                                                mt-2
                                                                flex
                                                                flex-wrap
                                                                gap-x-4
                                                                gap-y-1
                                                                text-[10px]
                                                                text-slate-500
                                                            "
                                                        >

                                                            <span>

                                                                FRP{" "}
                                                                {formatNumber(
                                                                    hotspot.frp,
                                                                    2
                                                                )}
                                                                {" "}MW

                                                            </span>


                                                            <span>

                                                                Brightness{" "}
                                                                {formatNumber(
                                                                    hotspot.brightness,
                                                                    2
                                                                )}
                                                                {" "}K

                                                            </span>


                                                            <span>

                                                                {hotspot.satellite ||
                                                                    "Unknown satellite"}

                                                                {hotspot.instrument
                                                                    ? ` / ${hotspot.instrument}`
                                                                    : ""
                                                                }

                                                            </span>


                                                            <span>

                                                                {new Date(
                                                                    hotspot.acquiredAt
                                                                ).toLocaleDateString()}

                                                            </span>

                                                        </div>

                                                    </div>


                                                    <button
                                                        onClick={() =>
                                                            viewOnMap(
                                                                hotspot
                                                            )
                                                        }
                                                        className="
                                                            shrink-0
                                                            rounded-lg
                                                            border
                                                            border-cyan-400/10
                                                            bg-cyan-400/[0.04]
                                                            px-2.5
                                                            py-1.5
                                                            text-[10px]
                                                            font-medium
                                                            text-cyan-300
                                                            transition
                                                            hover:bg-cyan-400/[0.08]
                                                        "
                                                    >

                                                        View on Map

                                                    </button>

                                                </div>

                                            </div>

                                        );
                                    }
                                )}

                            </div>

                        </Panel>


                        <Panel
                            title="Highest FRP Observation"
                            subtitle="Stored FIRMS detection with the highest Fire Radiative Power"
                        >

                            {data.highestFrpObservation ? (

                                <div>

                                    <div
                                        className="
                                            rounded-xl
                                            border
                                            border-orange-400/10
                                            bg-orange-400/[0.025]
                                            p-4
                                        "
                                    >

                                        <div
                                            className="
                                                flex
                                                items-center
                                                gap-2
                                            "
                                        >

                                            <Flame
                                                className="
                                                    h-5
                                                    w-5
                                                    text-orange-300
                                                "
                                            />


                                            <span
                                                className="
                                                    text-xs
                                                    text-slate-400
                                                "
                                            >

                                                Maximum stored FRP

                                            </span>

                                        </div>


                                        <div
                                            className="
                                                mt-3
                                                flex
                                                items-end
                                                gap-2
                                            "
                                        >

                                            <span
                                                className="
                                                    text-3xl
                                                    font-bold
                                                    text-white
                                                "
                                            >

                                                {formatNumber(
                                                    data.highestFrpObservation.frp,
                                                    2
                                                )}

                                            </span>


                                            <span
                                                className="
                                                    pb-1
                                                    text-xs
                                                    text-slate-500
                                                "
                                            >

                                                MW

                                            </span>

                                        </div>

                                    </div>


                                    <div
                                        className="
                                            mt-3
                                            grid
                                            grid-cols-2
                                            gap-2
                                        "
                                    >

                                        <MiniValue
                                            label="Brightness"
                                            value={
                                                formatNumber(
                                                    data.highestFrpObservation.brightness,
                                                    2
                                                )
                                            }
                                        />


                                        <MiniValue
                                            label="Risk"
                                            value={
                                                data.highestFrpObservation.riskScore !==
                                                    null
                                                    ? `${formatNumber(
                                                        data.highestFrpObservation.riskScore,
                                                        0
                                                    )} · ${data.highestFrpObservation.riskLevel ||
                                                    "Unspecified"
                                                    }`
                                                    : "Not assessed"
                                            }
                                        />


                                        <MiniValue
                                            label="Confidence"
                                            value={
                                                data.highestFrpObservation.confidence !==
                                                    null
                                                    ? `${formatNumber(
                                                        data.highestFrpObservation.confidence,
                                                        0
                                                    )}%`
                                                    : "—"
                                            }
                                        />


                                        <MiniValue
                                            label="Satellite"
                                            value={
                                                data.highestFrpObservation.satellite ||
                                                "Unknown"
                                            }
                                        />

                                    </div>


                                    <button
                                        onClick={() =>
                                            viewOnMap(
                                                data.highestFrpObservation!
                                            )
                                        }
                                        className="
                                            mt-4
                                            flex
                                            w-full
                                            items-center
                                            justify-center
                                            gap-2
                                            rounded-xl
                                            border
                                            border-cyan-400/10
                                            bg-cyan-400/[0.04]
                                            px-3
                                            py-2
                                            text-[11px]
                                            font-medium
                                            text-cyan-300
                                            transition
                                            hover:bg-cyan-400/[0.08]
                                        "
                                    >

                                        <MapPin
                                            className="
                                                h-3.5
                                                w-3.5
                                            "
                                        />

                                        View on Map

                                    </button>

                                </div>

                            ) : (

                                <p
                                    className="
                                        text-xs
                                        text-slate-500
                                    "
                                >

                                    No stored observation available.

                                </p>

                            )}

                        </Panel>

                    </section>


                    {/* ==========================================
                        DATABASE COVERAGE
                    =========================================== */}

                    <CoveragePanel
                        earliest={
                            data.earliestObservation
                        }
                        latest={
                            data.latestObservation
                        }
                        note={
                            data.note
                        }
                    />

                </>

            )}


            {/* =================================================
                REPEATED THERMAL LOCATIONS MODE
            ================================================== */}

            {mode === "repeated" && (

                <>

                    {repeatedLoading && (

                        <div
                            className="
                                flex
                                min-h-[300px]
                                items-center
                                justify-center
                                rounded-2xl
                                border
                                border-cyan-400/10
                                bg-ink-800/40
                            "
                        >

                            <div
                                className="
                                    text-center
                                "
                            >

                                <History
                                    className="
                                        mx-auto
                                        h-7
                                        w-7
                                        animate-pulse
                                        text-cyan-300
                                    "
                                />


                                <p
                                    className="
                                        mt-3
                                        text-xs
                                        text-slate-400
                                    "
                                >

                                    Detecting repeated thermal locations...

                                </p>

                            </div>

                        </div>

                    )}


                    {repeatedError && (

                        <div
                            className="
                                rounded-2xl
                                border
                                border-red-400/20
                                bg-red-400/[0.04]
                                p-4
                            "
                        >

                            <p
                                className="
                                    text-xs
                                    font-medium
                                    text-red-300
                                "
                            >

                                Unable to load repeated thermal locations

                            </p>


                            <p
                                className="
                                    mt-1
                                    text-[10px]
                                    text-slate-500
                                "
                            >

                                {repeatedError}

                            </p>


                            <button
                                onClick={
                                    loadRepeatedLocations
                                }
                                className="
                                    mt-3
                                    flex
                                    items-center
                                    gap-2
                                    rounded-lg
                                    border
                                    border-cyan-400/10
                                    px-3
                                    py-2
                                    text-[10px]
                                    text-cyan-300
                                "
                            >

                                <RefreshCw
                                    className="
                                        h-3
                                        w-3
                                    "
                                />

                                Retry

                            </button>

                        </div>

                    )}


                    {!repeatedLoading &&
                        !repeatedError &&
                        repeatedData && (

                            <>

                                {/* ==================================
                                    COVERAGE CARDS
                                =================================== */}

                                <section
                                    className="
                                        grid
                                        grid-cols-1
                                        gap-3
                                        sm:grid-cols-2
                                        xl:grid-cols-4
                                    "
                                >

                                    <StatCard
                                        title="Repeated Locations"
                                        value={
                                            repeatedData.count.toString()
                                        }
                                        subtitle="Multiple distinct FIRMS dates"
                                        icon={History}
                                    />


                                    <StatCard
                                        title="Observations Evaluated"
                                        value={
                                            repeatedData.observationsEvaluated.toLocaleString()
                                        }
                                        subtitle="Stored detections in analysis window"
                                        icon={Database}
                                    />


                                    <StatCard
                                        title="Stored Observation Days"
                                        value={
                                            repeatedData.storedObservationDays.toString()
                                        }
                                        subtitle={`Within ${repeatedData.requestedDays}-day analysis window`}
                                        icon={CalendarDays}
                                    />


                                    <StatCard
                                        title="Clustering Radius"
                                        value={
                                            `${repeatedData.clusteringRadiusKm.toFixed(
                                                1
                                            )} km`
                                        }
                                        subtitle="Spatial grouping distance"
                                        icon={MapPin}
                                    />

                                </section>


                                {/* ==================================
                                    COVERAGE WARNING
                                =================================== */}

                                <div
                                    className="
                                        rounded-2xl
                                        border
                                        border-amber-400/10
                                        bg-amber-400/[0.025]
                                        p-4
                                    "
                                >

                                    <div
                                        className="
                                            flex
                                            items-start
                                            gap-3
                                        "
                                    >

                                        <CalendarDays
                                            className="
                                                mt-0.5
                                                h-4
                                                w-4
                                                shrink-0
                                                text-amber-300
                                            "
                                        />


                                        <div>

                                            <p
                                                className="
                                                    text-xs
                                                    font-medium
                                                    text-slate-300
                                                "
                                            >

                                                Historical database coverage

                                            </p>


                                            <p
                                                className="
                                                    mt-1
                                                    text-[10px]
                                                    leading-relaxed
                                                    text-slate-500
                                                "
                                            >

                                                FireWatch is analysing a{" "}
                                                {repeatedData.requestedDays}-day
                                                window, but the persistent
                                                database currently contains
                                                FIRMS observations on{" "}
                                                {repeatedData.storedObservationDays}{" "}
                                                distinct dates in that window.

                                                Repeated locations therefore
                                                describe the observations
                                                currently stored and should not
                                                be interpreted as complete
                                                regional 30-day coverage.

                                            </p>

                                        </div>

                                    </div>

                                </div>


                                {/* ==================================
                                    LOCATION LIST
                                =================================== */}

                                <Panel
                                    title="Repeated Thermal Locations"
                                    subtitle="Spatially grouped FIRMS detections observed on multiple distinct dates"
                                >

                                    {repeatedData.locations.length ===
                                        0 ? (

                                        <div
                                            className="
                                                py-10
                                                text-center
                                            "
                                        >

                                            <History
                                                className="
                                                    mx-auto
                                                    h-6
                                                    w-6
                                                    text-slate-600
                                                "
                                            />


                                            <p
                                                className="
                                                    mt-3
                                                    text-xs
                                                    text-slate-500
                                                "
                                            >

                                                No repeated thermal locations
                                                were found in the stored data.

                                            </p>

                                        </div>

                                    ) : (

                                        <div
                                            className="
                                                space-y-3
                                            "
                                        >

                                            {repeatedData.locations.map(
                                                (
                                                    item,
                                                    index
                                                ) => {

                                                    const location =
                                                        repeatedLocations[
                                                        item.id
                                                        ];


                                                    return (

                                                        <div
                                                            key={
                                                                item.id
                                                            }
                                                            className="
                                                                rounded-2xl
                                                                border
                                                                border-cyan-400/[0.07]
                                                                bg-black/10
                                                                p-4
                                                            "
                                                        >

                                                            <div
                                                                className="
                                                                    flex
                                                                    flex-col
                                                                    gap-4
                                                                    xl:flex-row
                                                                    xl:items-start
                                                                    xl:justify-between
                                                                "
                                                            >

                                                                <div
                                                                    className="
                                                                        min-w-0
                                                                        flex-1
                                                                    "
                                                                >

                                                                    <div
                                                                        className="
                                                                            flex
                                                                            flex-wrap
                                                                            items-center
                                                                            gap-2
                                                                        "
                                                                    >

                                                                        <div
                                                                            className="
                                                                                flex
                                                                                h-7
                                                                                w-7
                                                                                items-center
                                                                                justify-center
                                                                                rounded-lg
                                                                                bg-cyan-400/[0.07]
                                                                                text-[10px]
                                                                                font-semibold
                                                                                text-cyan-300
                                                                            "
                                                                        >

                                                                            {index + 1}

                                                                        </div>


                                                                        <span
                                                                            className="
                                                                                text-sm
                                                                                font-semibold
                                                                                text-white
                                                                            "
                                                                        >

                                                                            {location?.title ||
                                                                                "Resolving location..."}

                                                                        </span>


                                                                        <RepeatedBadge />

                                                                    </div>


                                                                    <div
                                                                        className="
                                                                            mt-2
                                                                            flex
                                                                            items-start
                                                                            gap-2
                                                                        "
                                                                    >

                                                                        <MapPin
                                                                            className="
                                                                                mt-0.5
                                                                                h-3.5
                                                                                w-3.5
                                                                                shrink-0
                                                                                text-cyan-300
                                                                            "
                                                                        />


                                                                        <div>

                                                                            <p
                                                                                className="
                                                                                    text-[10px]
                                                                                    text-slate-500
                                                                                "
                                                                            >

                                                                                {location?.subtitle ||
                                                                                    `${item.lat.toFixed(
                                                                                        5
                                                                                    )}, ${item.lng.toFixed(
                                                                                        5
                                                                                    )}`}

                                                                            </p>


                                                                            <p
                                                                                className="
                                                                                    mt-1
                                                                                    font-mono
                                                                                    text-[9px]
                                                                                    text-slate-600
                                                                                "
                                                                            >

                                                                                {item.id}

                                                                            </p>

                                                                        </div>

                                                                    </div>


                                                                    {/* ==================
                                                                        MAIN METRICS
                                                                    =================== */}

                                                                    <div
                                                                        className="
                                                                            mt-4
                                                                            grid
                                                                            grid-cols-2
                                                                            gap-2
                                                                            sm:grid-cols-4
                                                                        "
                                                                    >

                                                                        <RegistryMetric
                                                                            label="Detections"
                                                                            value={
                                                                                item.detections.toString()
                                                                            }
                                                                        />


                                                                        <RegistryMetric
                                                                            label="Active Days"
                                                                            value={
                                                                                item.distinctActiveDays.toString()
                                                                            }
                                                                        />


                                                                        <RegistryMetric
                                                                            label="Observation Span"
                                                                            value={
                                                                                `${item.observationSpanDays} days`
                                                                            }
                                                                        />


                                                                        <RegistryMetric
                                                                            label="Maximum FRP"
                                                                            value={
                                                                                item.maximumFrp !==
                                                                                    null
                                                                                    ? `${item.maximumFrp.toFixed(
                                                                                        2
                                                                                    )} MW`
                                                                                    : "—"
                                                                            }
                                                                        />

                                                                    </div>


                                                                    {/* ==================
                                                                        DATES
                                                                    =================== */}

                                                                    <div
                                                                        className="
                                                                            mt-3
                                                                            grid
                                                                            grid-cols-1
                                                                            gap-2
                                                                            sm:grid-cols-2
                                                                        "
                                                                    >

                                                                        <RegistryInfo
                                                                            label="First observed"
                                                                            value={
                                                                                formatDate(
                                                                                    item.firstObserved
                                                                                )
                                                                            }
                                                                        />


                                                                        <RegistryInfo
                                                                            label="Latest observed"
                                                                            value={
                                                                                formatDate(
                                                                                    item.latestObserved
                                                                                )
                                                                            }
                                                                        />

                                                                    </div>


                                                                    {/* ==================
                                                                        DETAIL GRID
                                                                    =================== */}

                                                                    <div
                                                                        className="
                                                                            mt-3
                                                                            grid
                                                                            grid-cols-2
                                                                            gap-x-5
                                                                            gap-y-2
                                                                            text-[10px]
                                                                            lg:grid-cols-4
                                                                        "
                                                                    >

                                                                        <DetailValue
                                                                            label="Mean spread"
                                                                            value={
                                                                                item.meanDetectionDistanceM !==
                                                                                    null
                                                                                    ? `${item.meanDetectionDistanceM.toFixed(
                                                                                        1
                                                                                    )} m`
                                                                                    : "—"
                                                                            }
                                                                        />


                                                                        <DetailValue
                                                                            label="Max spread"
                                                                            value={
                                                                                item.maxDetectionDistanceM !==
                                                                                    null
                                                                                    ? `${item.maxDetectionDistanceM.toFixed(
                                                                                        1
                                                                                    )} m`
                                                                                    : "—"
                                                                            }
                                                                        />


                                                                        <DetailValue
                                                                            label="Mean gap"
                                                                            value={
                                                                                item.meanGapDays !==
                                                                                    null
                                                                                    ? `${item.meanGapDays} days`
                                                                                    : "—"
                                                                            }
                                                                        />


                                                                        <DetailValue
                                                                            label="30-day active fraction"
                                                                            value={
                                                                                `${(
                                                                                    item.activeDayFraction *
                                                                                    100
                                                                                ).toFixed(
                                                                                    1
                                                                                )}%`
                                                                            }
                                                                        />


                                                                        <DetailValue
                                                                            label="Average FRP"
                                                                            value={
                                                                                item.averageFrp !==
                                                                                    null
                                                                                    ? `${item.averageFrp.toFixed(
                                                                                        2
                                                                                    )} MW`
                                                                                    : "—"
                                                                            }
                                                                        />


                                                                        <DetailValue
                                                                            label="Average brightness"
                                                                            value={
                                                                                item.averageBrightness !==
                                                                                    null
                                                                                    ? `${item.averageBrightness.toFixed(
                                                                                        2
                                                                                    )} K`
                                                                                    : "—"
                                                                            }
                                                                        />


                                                                        <DetailValue
                                                                            label="Day detections"
                                                                            value={
                                                                                item.dayDetections.toString()
                                                                            }
                                                                        />


                                                                        <DetailValue
                                                                            label="Night detections"
                                                                            value={
                                                                                item.nightDetections.toString()
                                                                            }
                                                                        />

                                                                    </div>


                                                                    {/* ==================
                                                                        CLASSIFICATION
                                                                    =================== */}

                                                                    <div
                                                                        className="
                                                                            mt-4
                                                                            rounded-xl
                                                                            border
                                                                            border-violet-400/10
                                                                            bg-violet-400/[0.025]
                                                                            px-3
                                                                            py-3
                                                                        "
                                                                    >

                                                                        <p
                                                                            className="
                                                                                text-[9px]
                                                                                uppercase
                                                                                tracking-wider
                                                                                text-slate-500
                                                                            "
                                                                        >

                                                                            AI Classification

                                                                        </p>


                                                                        <p
                                                                            className="
                                                                                mt-1
                                                                                text-xs
                                                                                font-medium
                                                                                text-slate-300
                                                                            "
                                                                        >

                                                                            {item.classification.label ||
                                                                                "Unclassified thermal source"}

                                                                        </p>


                                                                        <p
                                                                            className="
                                                                                mt-1
                                                                                text-[9px]
                                                                                text-slate-600
                                                                            "
                                                                        >

                                                                            {item.classification.modelStatus}

                                                                        </p>

                                                                    </div>

                                                                </div>


                                                                {/* ======================
                                                                    ACTION
                                                                ======================= */}

                                                                <button
                                                                    onClick={() =>
                                                                        viewRepeatedOnMap(
                                                                            item
                                                                        )
                                                                    }
                                                                    className="
                                                                        flex
                                                                        shrink-0
                                                                        items-center
                                                                        justify-center
                                                                        gap-2
                                                                        rounded-xl
                                                                        border
                                                                        border-cyan-400/10
                                                                        bg-cyan-400/[0.04]
                                                                        px-3
                                                                        py-2
                                                                        text-[10px]
                                                                        font-medium
                                                                        text-cyan-300
                                                                        transition
                                                                        hover:bg-cyan-400/[0.08]
                                                                    "
                                                                >

                                                                    <MapPin
                                                                        className="
                                                                            h-3.5
                                                                            w-3.5
                                                                        "
                                                                    />

                                                                    View on Map

                                                                </button>

                                                            </div>

                                                        </div>

                                                    );
                                                }
                                            )}

                                        </div>

                                    )}

                                </Panel>


                                {/* ==================================
                                    METHODOLOGY / TRUTH NOTE
                                =================================== */}

                                <div
                                    className="
                                        rounded-2xl
                                        border
                                        border-cyan-400/10
                                        bg-ink-800/50
                                        p-4
                                    "
                                >

                                    <div
                                        className="
                                            flex
                                            items-start
                                            gap-3
                                        "
                                    >

                                        <TrendingUp
                                            className="
                                                mt-0.5
                                                h-4
                                                w-4
                                                shrink-0
                                                text-cyan-300
                                            "
                                        />


                                        <div>

                                            <p
                                                className="
                                                    text-xs
                                                    font-medium
                                                    text-slate-300
                                                "
                                            >

                                                Detection methodology

                                            </p>


                                            <p
                                                className="
                                                    mt-1
                                                    text-[10px]
                                                    leading-relaxed
                                                    text-slate-500
                                                "
                                            >

                                                {repeatedData.method}.

                                            </p>


                                            <p
                                                className="
                                                    mt-2
                                                    text-[10px]
                                                    leading-relaxed
                                                    text-slate-500
                                                "
                                            >

                                                {repeatedData.note}

                                            </p>

                                        </div>

                                    </div>

                                </div>

                            </>

                        )}

                </>

            )}

        </div>
    );
}


/* =========================================================
   HELPERS
========================================================= */

function formatNumber(
    value:
        number | null | undefined,
    decimals = 2,
) {

    if (
        value === null
        ||
        value === undefined
    ) {

        return "—";
    }


    return value.toFixed(
        decimals
    );
}


function formatDate(
    value:
        string | null | undefined
) {

    if (!value) {

        return "—";
    }


    return new Date(
        `${value}T00:00:00Z`
    ).toLocaleDateString(
        undefined,
        {
            day:
                "2-digit",

            month:
                "short",

            year:
                "numeric",
        }
    );
}


/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
    title,
    value,
    subtitle,
    icon: Icon,
}: {
    title: string;

    value: string;

    subtitle: string;

    icon:
    React.ElementType;
}) {

    return (

        <div
            className="
                rounded-2xl
                border
                border-cyan-400/10
                bg-ink-800/60
                p-4
            "
        >

            <div
                className="
                    flex
                    items-center
                    justify-between
                "
            >

                <p
                    className="
                        text-[10px]
                        font-medium
                        uppercase
                        tracking-wider
                        text-slate-500
                    "
                >

                    {title}

                </p>


                <Icon
                    className="
                        h-4
                        w-4
                        text-cyan-300
                    "
                />

            </div>


            <p
                className="
                    mt-2
                    text-2xl
                    font-bold
                    text-white
                "
            >

                {value}

            </p>


            <p
                className="
                    mt-1
                    text-[10px]
                    text-slate-500
                "
            >

                {subtitle}

            </p>

        </div>
    );
}


/* =========================================================
   PANEL
========================================================= */

function Panel({
    title,
    subtitle,
    children,
}: {
    title: string;

    subtitle?: string;

    children:
    React.ReactNode;
}) {

    return (

        <section
            className="
                rounded-2xl
                border
                border-cyan-400/10
                bg-ink-800/60
                p-4
            "
        >

            <div>

                <h2
                    className="
                        text-sm
                        font-semibold
                        text-white
                    "
                >

                    {title}

                </h2>


                {subtitle && (

                    <p
                        className="
                            mt-1
                            text-[10px]
                            text-slate-500
                        "
                    >

                        {subtitle}

                    </p>

                )}

            </div>


            <div
                className="
                    mt-4
                "
            >

                {children}

            </div>

        </section>
    );
}


/* =========================================================
   CONTEXT CARD
========================================================= */

function ContextCard({
    icon: Icon,
    label,
    value,
    secondary,
    iconClass,
}: {
    icon:
    React.ElementType;

    label: string;

    value: number;

    secondary: string;

    iconClass: string;
}) {

    return (

        <div
            className="
                rounded-xl
                border
                border-cyan-400/[0.06]
                bg-black/10
                p-3
            "
        >

            <div
                className="
                    flex
                    items-center
                    justify-between
                "
            >

                <Icon
                    className={`h-4 w-4 ${iconClass}`}
                />


                <span
                    className="
                        text-[10px]
                        text-slate-500
                    "
                >

                    {secondary}

                </span>

            </div>


            <p
                className="
                    mt-3
                    text-xl
                    font-bold
                    text-white
                "
            >

                {value}

            </p>


            <p
                className="
                    text-[10px]
                    text-slate-500
                "
            >

                {label} detections

            </p>

        </div>
    );
}


/* =========================================================
   MINI VALUE
========================================================= */

function MiniValue({
    label,
    value,
}: {
    label: string;

    value: string;
}) {

    return (

        <div
            className="
                rounded-xl
                bg-black/10
                px-3
                py-3
            "
        >

            <p
                className="
                    text-[9px]
                    uppercase
                    tracking-wider
                    text-slate-500
                "
            >

                {label}

            </p>


            <p
                className="
                    mt-1
                    text-sm
                    font-semibold
                    text-white
                "
            >

                {value}

            </p>

        </div>
    );
}


/* =========================================================
   REGISTRY METRIC
========================================================= */

function RegistryMetric({
    label,
    value,
}: {
    label: string;

    value: string;
}) {

    return (

        <div
            className="
                rounded-xl
                border
                border-cyan-400/[0.05]
                bg-cyan-400/[0.02]
                px-3
                py-3
            "
        >

            <p
                className="
                    text-[9px]
                    uppercase
                    tracking-wider
                    text-slate-600
                "
            >

                {label}

            </p>


            <p
                className="
                    mt-1
                    text-sm
                    font-semibold
                    text-white
                "
            >

                {value}

            </p>

        </div>
    );
}


/* =========================================================
   REGISTRY INFO
========================================================= */

function RegistryInfo({
    label,
    value,
}: {
    label: string;

    value: string;
}) {

    return (

        <div
            className="
                flex
                items-center
                justify-between
                rounded-xl
                bg-black/10
                px-3
                py-2.5
            "
        >

            <span
                className="
                    text-[10px]
                    text-slate-500
                "
            >

                {label}

            </span>


            <span
                className="
                    text-[10px]
                    font-medium
                    text-slate-300
                "
            >

                {value}

            </span>

        </div>
    );
}


/* =========================================================
   DETAIL VALUE
========================================================= */

function DetailValue({
    label,
    value,
}: {
    label: string;

    value: string;
}) {

    return (

        <div>

            <p
                className="
                    text-[9px]
                    text-slate-600
                "
            >

                {label}

            </p>


            <p
                className="
                    mt-0.5
                    font-medium
                    text-slate-300
                "
            >

                {value}

            </p>

        </div>
    );
}


/* =========================================================
   COVERAGE NOTICE
========================================================= */

function CoverageNotice({
    children,
}: {
    children:
    React.ReactNode;
}) {

    return (

        <div
            className="
                mt-2
                rounded-xl
                border
                border-cyan-400/10
                bg-cyan-400/[0.025]
                px-3
                py-2
            "
        >

            <p
                className="
                    text-[10px]
                    leading-relaxed
                    text-slate-500
                "
            >

                {children}

            </p>

        </div>
    );
}


/* =========================================================
   COVERAGE PANEL
========================================================= */

function CoveragePanel({
    earliest,
    latest,
    note,
}: {
    earliest:
    string | null;

    latest:
    string | null;

    note: string;
}) {

    return (

        <section
            className="
                rounded-2xl
                border
                border-cyan-400/10
                bg-ink-800/50
                p-4
            "
        >

            <div
                className="
                    flex
                    items-start
                    gap-3
                "
            >

                <TrendingUp
                    className="
                        mt-0.5
                        h-4
                        w-4
                        shrink-0
                        text-cyan-300
                    "
                />


                <div>

                    <p
                        className="
                            text-xs
                            text-slate-400
                        "
                    >

                        <span
                            className="
                                font-medium
                                text-slate-300
                            "
                        >

                            Database coverage:

                        </span>

                        {" "}

                        {earliest
                            ? new Date(
                                earliest
                            ).toLocaleString()
                            : "Unknown"
                        }

                        {" → "}

                        {latest
                            ? new Date(
                                latest
                            ).toLocaleString()
                            : "Unknown"
                        }

                    </p>


                    <p
                        className="
                            mt-2
                            text-[10px]
                            leading-relaxed
                            text-slate-500
                        "
                    >

                        {note}

                    </p>

                </div>

            </div>

        </section>
    );
}


/* =========================================================
   RISK BADGE
========================================================= */

function RiskBadge({
    level,
}: {
    level: string;
}) {

    const style =
        level === "Extreme"
            ? "border-red-400/20 bg-red-400/10 text-red-300"

            : level === "High"
                ? "border-orange-400/20 bg-orange-400/10 text-orange-300"

                : level === "Moderate"
                    ? "border-amber-400/20 bg-amber-400/10 text-amber-300"

                    : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";


    return (

        <span
            className={`
                rounded-full
                border
                px-2
                py-0.5
                text-[9px]
                font-semibold
                ${style}
            `}
        >

            {level}

        </span>
    );
}


/* =========================================================
   REPEATED ACTIVITY BADGE
========================================================= */

function RepeatedBadge() {

    return (

        <span
            className="
                rounded-full
                border
                border-cyan-400/15
                bg-cyan-400/[0.07]
                px-2
                py-0.5
                text-[9px]
                font-semibold
                text-cyan-300
            "
        >

            Repeated thermal activity

        </span>
    );
}