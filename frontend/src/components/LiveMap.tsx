import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    CircleMarker,
    MapContainer,
    Popup,
    TileLayer,
    useMap,
} from "react-leaflet";

import {
    Archive,
    Search,
    SlidersHorizontal,
    X,
} from "lucide-react";

import type {
    Hotspot,
    RiskLevel,
} from "@/types";

import {
    RiskBadge,
    riskColorHex,
} from "./RiskBadge";


/* ========================================================
   PROPS
======================================================== */

type Props = {

    hotspots:
    Hotspot[];

    selected:
    Hotspot | null;

    onSelect: (
        hotspot: Hotspot
    ) =>
        void |
        Promise<void>;

    onAnalyze: (
        hotspot: Hotspot
    ) =>
        Promise<void>;

    analyzingId:
    string | null;

    locatingId:
    string | null;

    /*
     * Coordinate supplied from GIS History.
     */

    focusTarget?:
    [number, number] |
    null;

    /*
     * Marks a persistent historical
     * observation loaded from SQLite.
     */

    historicalSelectedId?:
    string | null;
};


type BaseLayer =
    | "street"
    | "satellite"
    | "terrain";


const levels: RiskLevel[] = [
    "Low",
    "Moderate",
    "High",
    "Extreme",
];


/* ========================================================
   FOCUS SELECTED HOTSPOT
======================================================== */

function Focus({
    hotspot,
}: {
    hotspot:
    Hotspot | null;
}) {

    const map =
        useMap();


    useEffect(
        () => {

            if (
                !hotspot
            ) {

                return;
            }


            map.flyTo(
                [
                    hotspot.lat,
                    hotspot.lng,
                ],

                Math.max(
                    map.getZoom(),
                    13
                ),

                {
                    duration:
                        0.8,
                }
            );

        },
        [
            hotspot,
            map,
        ]
    );


    return null;
}


/* ========================================================
   EXTERNAL GIS HISTORY FOCUS
======================================================== */

function ExternalFocus({
    target,
}: {
    target:
    [number, number] |
    null;
}) {

    const map =
        useMap();


    useEffect(
        () => {

            if (
                !target
            ) {

                return;
            }


            map.flyTo(
                target,
                13,
                {
                    duration:
                        0.9,
                }
            );

        },
        [
            target,
            map,
        ]
    );


    return null;
}


/* ========================================================
   SEARCH FOCUS
======================================================== */

function SearchFocus({
    target,
}: {
    target:
    [number, number] |
    null;
}) {

    const map =
        useMap();


    useEffect(
        () => {

            if (
                !target
            ) {

                return;
            }


            map.flyTo(
                target,
                11,
                {
                    duration:
                        1.1,
                }
            );

        },
        [
            target,
            map,
        ]
    );


    return null;
}


/* ========================================================
   MAIN
======================================================== */

export default function LiveMap({

    hotspots,

    selected,

    onSelect,

    onAnalyze,

    analyzingId,

    locatingId,

    focusTarget = null,

    historicalSelectedId = null,

}: Props) {


    const [
        baseLayer,
        setBaseLayer,
    ] =
        useState<BaseLayer>(
            "street"
        );


    const [
        level,
        setLevel,
    ] =
        useState<
            RiskLevel |
            "All"
        >(
            "All"
        );


    const [
        search,
        setSearch,
    ] =
        useState(
            ""
        );


    const [
        searchTarget,
        setSearchTarget,
    ] =
        useState<
            [number, number] |
            null
        >(
            null
        );


    const [
        searching,
        setSearching,
    ] =
        useState(
            false
        );


    const [
        searchError,
        setSearchError,
    ] =
        useState(
            ""
        );


    const [
        searchedPlace,
        setSearchedPlace,
    ] =
        useState(
            ""
        );


    const [
        toolsOpen,
        setToolsOpen,
    ] =
        useState(
            false
        );


    /* =====================================================
       FILTER HOTSPOTS
    ====================================================== */

    const shown =
        useMemo(
            () =>
                hotspots.filter(
                    hotspot =>
                        level === "All" ||
                        hotspot.riskLevel ===
                        level ||
                        hotspot.id ===
                        historicalSelectedId
                ),
            [
                hotspots,
                level,
                historicalSelectedId,
            ]
        );


    /* =====================================================
       MAP CONFIG
    ====================================================== */

    const mapConfig = {

        street: {

            url:
                "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

            attribution:
                "&copy; OpenStreetMap contributors",
        },


        satellite: {

            url:
                "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",

            attribution:
                "Tiles &copy; Esri",
        },


        terrain: {

            url:
                "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",

            attribution:
                "Map data &copy; OpenStreetMap contributors, SRTM",
        },

    };


    const currentMap =
        mapConfig[
        baseLayer
        ];


    /* =====================================================
       LOCATION SEARCH
    ====================================================== */

    async function handleLocationSearch() {

        const query =
            search.trim();


        if (
            !query
        ) {

            setSearchError(
                "Enter a city, district or state"
            );

            return;
        }


        try {

            setSearching(
                true
            );

            setSearchError(
                ""
            );


            const response =
                await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&limit=1&q=${encodeURIComponent(
                        query
                    )}`
                );


            if (
                !response.ok
            ) {

                throw new Error(
                    `Search failed with status ${response.status}`
                );
            }


            const data =
                await response.json();


            if (
                !data ||
                data.length === 0
            ) {

                setSearchError(
                    "Location not found in India"
                );

                return;
            }


            const lat =
                Number(
                    data[0].lat
                );


            const lon =
                Number(
                    data[0].lon
                );


            if (
                Number.isNaN(
                    lat
                ) ||
                Number.isNaN(
                    lon
                )
            ) {

                setSearchError(
                    "Invalid coordinates returned"
                );

                return;
            }


            setSearchTarget(
                [
                    lat,
                    lon,
                ]
            );


            setSearchedPlace(
                data[0].display_name ||
                query
            );


        }
        catch (
        error
        ) {

            console.error(
                "Location search failed:",
                error
            );


            setSearchError(
                "Unable to search location"
            );


        }
        finally {

            setSearching(
                false
            );

        }

    }


    /* =====================================================
       UI
    ====================================================== */

    return (

        <div
            className="
                relative
                h-full
                w-full
            "
        >

            <MapContainer
                center={[
                    21,
                    79,
                ]}
                zoom={
                    5
                }
                minZoom={
                    4
                }
                maxZoom={
                    18
                }
                className="
                    h-full
                    w-full
                "
            >

                <TileLayer
                    key={
                        baseLayer
                    }
                    url={
                        currentMap.url
                    }
                    attribution={
                        currentMap.attribution
                    }
                    maxZoom={
                        19
                    }
                />


                {baseLayer ===
                    "satellite" && (

                        <TileLayer
                            url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                            attribution="Esri"
                        />

                    )}


                {/* -----------------------------------------
                    GIS HISTORY COORDINATE FOCUS
                ------------------------------------------ */}

                <ExternalFocus
                    target={
                        focusTarget
                    }
                />


                {/* -----------------------------------------
                    SELECTED MARKER FOCUS
                ------------------------------------------ */}

                <Focus
                    hotspot={
                        selected
                    }
                />


                {/* -----------------------------------------
                    LOCATION SEARCH FOCUS
                ------------------------------------------ */}

                <SearchFocus
                    target={
                        searchTarget
                    }
                />


                {/* =========================================
                    FIRMS HOTSPOTS
                ========================================== */}

                {shown.map(
                    hotspot => {


                        const isSelected =
                            selected?.id ===
                            hotspot.id;


                        const isHistorical =
                            historicalSelectedId ===
                            hotspot.id;


                        let radius =
                            7;


                        if (
                            hotspot.riskLevel ===
                            "High"
                        ) {

                            radius =
                                9;

                        }


                        if (
                            hotspot.riskLevel ===
                            "Extreme"
                        ) {

                            radius =
                                11;

                        }


                        if (
                            isSelected
                        ) {

                            radius +=
                                3;

                        }


                        const isLocating =
                            locatingId ===
                            hotspot.id;


                        return (

                            <CircleMarker
                                key={
                                    hotspot.id
                                }

                                center={[
                                    hotspot.lat,
                                    hotspot.lng,
                                ]}

                                radius={
                                    radius
                                }

                                pathOptions={{

                                    /*
                                     * Historical marker gets
                                     * cyan outline so it is easy
                                     * to distinguish from current
                                     * FIRMS detections.
                                     */

                                    color:
                                        isHistorical

                                            ? "#22d3ee"

                                            : isSelected

                                                ? "#ffffff"

                                                : riskColorHex[
                                                hotspot.riskLevel
                                                ],

                                    fillColor:
                                        riskColorHex[
                                        hotspot.riskLevel
                                        ],

                                    fillOpacity:
                                        isHistorical
                                            ? 1
                                            : 0.9,

                                    weight:
                                        isHistorical ||
                                            isSelected

                                            ? 4

                                            : 2,

                                    dashArray:
                                        isHistorical
                                            ? "5 4"
                                            : undefined,
                                }}

                                eventHandlers={{

                                    click:
                                        () => {

                                            void onSelect(
                                                hotspot
                                            );

                                        },

                                }}
                            >

                                <Popup>

                                    <div
                                        className="
                                            min-w-[230px]
                                            p-2
                                            text-xs
                                        "
                                    >

                                        {/* HISTORICAL BADGE */}

                                        {isHistorical && (

                                            <div
                                                className="
                                                    mb-3
                                                    flex
                                                    items-center
                                                    gap-1.5
                                                    rounded-md
                                                    bg-cyan-500/10
                                                    px-2
                                                    py-1.5
                                                    text-[10px]
                                                    font-medium
                                                    text-cyan-700
                                                "
                                            >

                                                <Archive
                                                    className="
                                                        h-3
                                                        w-3
                                                    "
                                                />

                                                Stored historical observation

                                            </div>

                                        )}


                                        {/* HEADER */}

                                        <div
                                            className="
                                                mb-3
                                                flex
                                                items-center
                                                justify-between
                                                gap-3
                                            "
                                        >

                                            <div>

                                                <b
                                                    className="
                                                        text-sm
                                                    "
                                                >

                                                    {
                                                        hotspot.name ||
                                                        "FIRMS Thermal Observation"
                                                    }

                                                </b>


                                                <div
                                                    className="
                                                        mt-1
                                                        text-[10px]
                                                        text-slate-400
                                                    "
                                                >

                                                    {
                                                        hotspot.lat.toFixed(
                                                            4
                                                        )
                                                    }

                                                    ,{" "}

                                                    {
                                                        hotspot.lng.toFixed(
                                                            4
                                                        )
                                                    }

                                                </div>

                                            </div>


                                            <RiskBadge
                                                level={
                                                    hotspot.riskLevel
                                                }
                                                size="sm"
                                            />

                                        </div>


                                        {/* FIRMS DATA */}

                                        <div
                                            className="
                                                grid
                                                grid-cols-2
                                                gap-x-4
                                                gap-y-2
                                            "
                                        >

                                            <span
                                                className="
                                                    text-slate-400
                                                "
                                            >
                                                Brightness
                                            </span>

                                            <b>

                                                {
                                                    hotspot.brightness.toFixed(
                                                        1
                                                    )
                                                }{" "}

                                                K

                                            </b>


                                            <span
                                                className="
                                                    text-slate-400
                                                "
                                            >
                                                FRP
                                            </span>

                                            <b>

                                                {
                                                    hotspot.frp.toFixed(
                                                        1
                                                    )
                                                }{" "}

                                                MW

                                            </b>


                                            <span
                                                className="
                                                    text-slate-400
                                                "
                                            >
                                                Confidence
                                            </span>

                                            <b>

                                                {
                                                    hotspot.confidence
                                                }

                                                %

                                            </b>


                                            <span
                                                className="
                                                    text-slate-400
                                                "
                                            >
                                                Acquired
                                            </span>

                                            <b
                                                className="
                                                    text-[10px]
                                                "
                                            >

                                                {
                                                    hotspot.acquiredAt

                                                        ? new Date(
                                                            hotspot.acquiredAt
                                                        ).toLocaleString()

                                                        : "Unknown"
                                                }

                                            </b>


                                            {/* LOCATION */}

                                            <span
                                                className="
                                                    text-slate-400
                                                "
                                            >
                                                Location
                                            </span>


                                            <b>

                                                {
                                                    isLocating

                                                        ? "Locating…"

                                                        : hotspot.state &&
                                                            hotspot.state !==
                                                            "Unresolved"

                                                            ? hotspot.state

                                                            : "Location unavailable"
                                                }

                                            </b>


                                            {/* LAND */}

                                            <span
                                                className="
                                                    text-slate-400
                                                "
                                            >
                                                Land
                                            </span>


                                            <b>

                                                {
                                                    hotspot.landType &&
                                                        hotspot.landType !==
                                                        "Unknown"

                                                        ? hotspot.landType

                                                        : "Run full analysis"
                                                }

                                            </b>

                                        </div>


                                        {/* RECOMMENDATION */}

                                        {hotspot.recommendation && (

                                            <p
                                                className="
                                                    mt-3
                                                    rounded-md
                                                    bg-orange-500/10
                                                    p-2
                                                    text-sm
                                                    leading-relaxed
                                                    text-slate-700
                                                    dark:text-slate-300
                                                "
                                            >

                                                {
                                                    hotspot.recommendation
                                                }

                                            </p>

                                        )}


                                        {/* FULL ANALYSIS */}

                                        <button
                                            disabled={
                                                analyzingId ===
                                                hotspot.id
                                            }

                                            onClick={
                                                async (
                                                    event
                                                ) => {

                                                    event.stopPropagation();


                                                    try {

                                                        await onAnalyze(
                                                            hotspot
                                                        );

                                                    }
                                                    catch (
                                                    error
                                                    ) {

                                                        console.error(
                                                            "Hotspot analysis failed:",
                                                            error
                                                        );

                                                    }

                                                }
                                            }

                                            className="
                                                mt-3
                                                w-full
                                                rounded-md
                                                bg-orange-500/10
                                                px-3
                                                py-2
                                                font-medium
                                                text-orange-700
                                                transition
                                                hover:bg-orange-500/20
                                                dark:bg-orange-500/20
                                                dark:text-orange-300
                                                dark:hover:bg-orange-500/30
                                                disabled:opacity-50
                                            "
                                        >

                                            {
                                                analyzingId ===
                                                    hotspot.id

                                                    ? "Analyzing..."

                                                    : "View Full Analysis →"
                                            }

                                        </button>

                                    </div>

                                </Popup>

                            </CircleMarker>

                        );

                    }
                )}

            </MapContainer>


            {/* =============================================
                HISTORICAL OBSERVATION INDICATOR
            ============================================== */}

            {historicalSelectedId && (

                <div
                    className="
                        glass-card
                        absolute
                        left-1/2
                        top-4
                        z-[1000]
                        flex
                        -translate-x-1/2
                        items-center
                        gap-2
                        rounded-xl
                        border
                        border-cyan-400/15
                        px-3
                        py-2
                        text-[10px]
                        text-cyan-300
                        shadow-xl
                    "
                >

                    <Archive
                        className="
                            h-3.5
                            w-3.5
                        "
                    />

                    Stored historical FIRMS observation

                </div>

            )}


            {/* =============================================
                MAP TOOLS
            ============================================== */}

            <div
                className="
                    absolute
                    right-4
                    top-4
                    z-[1000]
                "
            >

                {!toolsOpen ? (

                    <button
                        onClick={() =>
                            setToolsOpen(
                                true
                            )
                        }
                        className="
                            glass-card
                            flex
                            items-center
                            gap-2
                            rounded-xl
                            px-4
                            py-2.5
                            text-xs
                            font-semibold
                            shadow-xl
                            transition
                        "
                    >

                        <SlidersHorizontal
                            className="
                                h-4
                                w-4
                                text-fire-400
                            "
                        />

                        Map Tools

                    </button>

                ) : (

                    <div
                        className="
                            glass-card
                            w-[270px]
                            rounded-xl
                            p-4
                            shadow-2xl
                        "
                    >

                        {/* HEADER */}

                        <div
                            className="
                                mb-4
                                flex
                                items-center
                                justify-between
                            "
                        >

                            <div
                                className="
                                    flex
                                    items-center
                                    gap-2
                                "
                            >

                                <SlidersHorizontal
                                    className="
                                        h-4
                                        w-4
                                        text-fire-400
                                    "
                                />

                                <p
                                    className="
                                        text-xs
                                        font-semibold
                                    "
                                >

                                    Map Tools

                                </p>

                            </div>


                            <button
                                onClick={() =>
                                    setToolsOpen(
                                        false
                                    )
                                }
                                className="
                                    rounded-md
                                    p-1
                                    text-slate-400
                                    hover:bg-white/5
                                "
                            >

                                <X
                                    className="
                                        h-4
                                        w-4
                                    "
                                />

                            </button>

                        </div>


                        {/* SEARCH */}

                        <p
                            className="
                                mb-1
                                text-[10px]
                                uppercase
                                tracking-wider
                                text-slate-500
                            "
                        >

                            Location Search

                        </p>


                        <div
                            className="
                                flex
                                gap-1
                            "
                        >

                            <div
                                className="
                                    relative
                                    min-w-0
                                    flex-1
                                "
                            >

                                <Search
                                    className="
                                        pointer-events-none
                                        absolute
                                        left-2.5
                                        top-1/2
                                        h-3.5
                                        w-3.5
                                        -translate-y-1/2
                                        text-slate-500
                                    "
                                />


                                <input
                                    aria-label="Search location"

                                    value={
                                        search
                                    }

                                    onChange={
                                        event => {

                                            setSearch(
                                                event.target.value
                                            );


                                            if (
                                                searchError
                                            ) {

                                                setSearchError(
                                                    ""
                                                );

                                            }

                                        }
                                    }

                                    onKeyDown={
                                        event => {

                                            if (
                                                event.key ===
                                                "Enter"
                                            ) {

                                                void handleLocationSearch();

                                            }

                                        }
                                    }

                                    placeholder="City or state"

                                    className="
                                        w-full
                                        rounded-lg
                                        bg-ink-900/80
                                        py-2
                                        pl-8
                                        pr-2
                                        text-xs
                                        outline-none
                                    "
                                />

                            </div>


                            <button
                                onClick={() =>
                                    void handleLocationSearch()
                                }

                                disabled={
                                    searching
                                }

                                className="
                                    rounded-lg
                                    bg-fire-500/20
                                    px-3
                                    py-2
                                    text-xs
                                    text-fire-300
                                    transition
                                    hover:bg-fire-500/30
                                    disabled:opacity-50
                                "
                            >

                                {
                                    searching
                                        ? "..."
                                        : "Go"
                                }

                            </button>

                        </div>


                        {searchError && (

                            <p
                                className="
                                    mt-2
                                    text-[10px]
                                    text-red-400
                                "
                            >

                                {
                                    searchError
                                }

                            </p>

                        )}


                        {searchedPlace &&
                            !searchError && (

                                <p
                                    title={
                                        searchedPlace
                                    }
                                    className="
                                    mt-2
                                    truncate
                                    text-[10px]
                                    text-emerald-400
                                "
                                >

                                    ✓{" "}

                                    {
                                        searchedPlace
                                    }

                                </p>

                            )}


                        {/* MAP STYLE */}

                        <div
                            className="
                                my-4
                                border-t
                                border-white/5
                            "
                        />


                        <p
                            className="
                                mb-1
                                text-[10px]
                                uppercase
                                tracking-wider
                                text-slate-500
                            "
                        >

                            Map Style

                        </p>


                        <div
                            className="
                                grid
                                grid-cols-3
                                gap-1
                            "
                        >

                            {(
                                [
                                    "street",
                                    "satellite",
                                    "terrain",
                                ] as BaseLayer[]
                            ).map(
                                mapType => (

                                    <button
                                        key={
                                            mapType
                                        }

                                        onClick={() =>
                                            setBaseLayer(
                                                mapType
                                            )
                                        }

                                        className={`
                                            rounded
                                            px-2
                                            py-1.5
                                            text-[10px]
                                            capitalize
                                            transition
                                            ${baseLayer ===
                                                mapType

                                                ? "bg-fire-500/30 text-fire-300"

                                                : "bg-ink-900/60 text-slate-400"
                                            }
                                        `}
                                    >

                                        {
                                            mapType
                                        }

                                    </button>

                                )
                            )}

                        </div>


                        {/* FILTER */}

                        <div
                            className="
                                my-4
                                border-t
                                border-white/5
                            "
                        />


                        <p
                            className="
                                mb-1
                                text-[10px]
                                uppercase
                                tracking-wider
                                text-slate-500
                            "
                        >

                            Risk Filter

                        </p>


                        <select
                            aria-label="Risk filter"

                            value={
                                level
                            }

                            onChange={
                                event =>
                                    setLevel(
                                        event.target
                                            .value as
                                        RiskLevel |
                                        "All"
                                    )
                            }

                            className="
                                w-full
                                rounded
                                bg-ink-900
                                px-2
                                py-2
                                text-xs
                                outline-none
                            "
                        >

                            <option
                                value="All"
                            >
                                All
                            </option>


                            {levels.map(
                                riskLevel => (

                                    <option
                                        key={
                                            riskLevel
                                        }
                                        value={
                                            riskLevel
                                        }
                                    >

                                        {
                                            riskLevel
                                        }

                                    </option>

                                )
                            )}

                        </select>


                        {/* COUNT */}

                        <div
                            className="
                                mt-3
                                flex
                                items-center
                                justify-between
                                text-[10px]
                                text-slate-500
                            "
                        >

                            <span>
                                Visible
                            </span>


                            <span>

                                {
                                    shown.length
                                }

                                {" / "}

                                {
                                    hotspots.length
                                }

                                {" hotspots"}

                            </span>

                        </div>

                    </div>

                )}

            </div>


            {/* =============================================
                LEGEND
            ============================================== */}

            <div
                className="
                    glass-card
                    absolute
                    bottom-4
                    left-4
                    z-[1000]
                    flex
                    gap-3
                    rounded-xl
                    p-3
                "
            >

                {levels.map(
                    riskLevel => (

                        <span
                            key={
                                riskLevel
                            }
                            className="
                                flex
                                items-center
                                gap-1.5
                                text-[10px]
                            "
                        >

                            <i
                                className="
                                    h-2.5
                                    w-2.5
                                    rounded-full
                                "
                                style={{

                                    background:
                                        riskColorHex[
                                        riskLevel
                                        ],

                                }}
                            />


                            {
                                riskLevel
                            }

                        </span>

                    )
                )}


                {historicalSelectedId && (

                    <span
                        className="
                            flex
                            items-center
                            gap-1.5
                            border-l
                            border-white/10
                            pl-3
                            text-[10px]
                        "
                    >

                        <i
                            className="
                                h-2.5
                                w-2.5
                                rounded-full
                                border-2
                                border-cyan-300
                            "
                        />

                        Stored

                    </span>

                )}

            </div>

        </div>
    );
}