import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  Bell,
  Clock,
  Filter,
  Flame,
  MapPin,
  RefreshCw,
} from "lucide-react";

import GlassCard from "@/components/GlassCard";

import {
  RiskBadge,
} from "@/components/RiskBadge";

import {
  getAlerts,
} from "@/services/api";

import type {
  FireAlert,
  RiskLevel,
} from "@/types";


type AlertFilter =
  | "All"
  | "Extreme"
  | "High";


const filters: AlertFilter[] = [
  "All",
  "Extreme",
  "High",
];


const severityIcon: Record<
  RiskLevel,
  {
    icon: typeof Flame;
    color: string;
    bg: string;
  }
> = {

  Extreme: {
    icon: Flame,
    color: "text-red-400",
    bg: "bg-red-500/10",
  },

  High: {
    icon: AlertTriangle,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },

  Moderate: {
    icon: AlertTriangle,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
  },

  Low: {
    icon: Bell,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
};


export default function AlertCenterPage() {

  const [
    alerts,
    setAlerts,
  ] = useState<FireAlert[]>([]);


  const [
    filter,
    setFilter,
  ] = useState<AlertFilter>(
    "All"
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
  ] = useState(
    ""
  );


  const [
    updated,
    setUpdated,
  ] = useState<Date | null>(
    null
  );


  /* =====================================================
     LOAD ALERTS
  ====================================================== */

  async function loadAlerts() {

    setLoading(
      true
    );

    setError(
      ""
    );

    try {

      const data =
        await getAlerts();

      setAlerts(
        data
      );

      setUpdated(
        new Date()
      );

    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load alerts"
      );

    } finally {

      setLoading(
        false
      );
    }
  }


  useEffect(
    () => {
      loadAlerts();
    },
    []
  );


  /* =====================================================
     COUNTS
  ====================================================== */

  const totalAlerts =
    alerts.length;


  const extremeCount =
    useMemo(
      () =>
        alerts.filter(
          alert =>
            alert.riskLevel ===
            "Extreme"
        ).length,
      [alerts]
    );


  const highCount =
    useMemo(
      () =>
        alerts.filter(
          alert =>
            alert.riskLevel ===
            "High"
        ).length,
      [alerts]
    );


  /* =====================================================
     FILTER
  ====================================================== */

  const filtered =
    useMemo(
      () => {

        if (
          filter === "All"
        ) {
          return alerts;
        }

        return alerts.filter(
          alert =>
            alert.riskLevel ===
            filter
        );

      },
      [
        alerts,
        filter,
      ]
    );


  return (

    <div className="p-4 lg:p-6">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="mb-6 flex items-start justify-between gap-4">

        <div>

          <h1 className="text-2xl font-bold text-white">

            Active Alerts

          </h1>


          <p className="mt-1 text-sm text-slate-400">

            High and Extreme thermal detections
            identified using the Heuristic FIRMS Risk Index

          </p>


          {updated && (

            <p className="mt-1 text-[10px] text-slate-600">

              Updated{" "}
              {
                updated.toLocaleString()
              }

            </p>

          )}

        </div>


        <button
          onClick={
            loadAlerts
          }
          disabled={
            loading
          }
          className="
            flex
            shrink-0
            items-center
            gap-2
            rounded-lg
            bg-white/5
            px-3
            py-2
            text-xs
            text-slate-300
            transition
            hover:bg-white/10
            disabled:opacity-50
          "
        >

          <RefreshCw
            className={`
              h-3.5
              w-3.5
              ${loading
                ? "animate-spin"
                : ""
              }
            `}
          />

          Refresh

        </button>

      </div>


      {/* =================================================
          ERROR
      ================================================= */}

      {error && (

        <div
          className="
            mb-5
            rounded-xl
            border
            border-red-500/20
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


      {/* =================================================
          SUMMARY
      ================================================= */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">

        {/* TOTAL */}

        <GlassCard
          className="p-4"
          hover
        >

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fire-500/10">

              <Bell className="h-5 w-5 text-fire-400" />

            </div>


            <div>

              <p className="font-mono text-2xl font-bold text-white">

                {
                  totalAlerts
                }

              </p>


              <p className="text-xs text-slate-400">

                Total Alerts

              </p>

            </div>

          </div>

        </GlassCard>


        {/* EXTREME */}

        <GlassCard
          className="p-4"
          hover
        >

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">

              <Flame className="h-5 w-5 text-red-400" />

            </div>


            <div>

              <p className="font-mono text-2xl font-bold text-white">

                {
                  extremeCount
                }

              </p>


              <p className="text-xs text-slate-400">

                Extreme

              </p>

            </div>

          </div>

        </GlassCard>


        {/* HIGH */}

        <GlassCard
          className="p-4"
          hover
        >

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">

              <AlertTriangle className="h-5 w-5 text-orange-400" />

            </div>


            <div>

              <p className="font-mono text-2xl font-bold text-white">

                {
                  highCount
                }

              </p>


              <p className="text-xs text-slate-400">

                High Risk

              </p>

            </div>

          </div>

        </GlassCard>

      </div>


      {/* =================================================
          FILTERS
      ================================================= */}

      <div className="mb-4 flex flex-wrap items-center gap-2">

        <Filter className="h-4 w-4 text-slate-500" />


        {filters.map(
          currentFilter => (

            <button
              key={
                currentFilter
              }
              onClick={
                () =>
                  setFilter(
                    currentFilter
                  )
              }
              className={`
                rounded-lg
                px-3
                py-1.5
                text-xs
                font-semibold
                transition-all

                ${filter ===
                  currentFilter

                  ? "bg-fire-500/20 text-fire-300"

                  : "text-slate-400 hover:bg-white/5 hover:text-white"
                }
              `}
            >

              {
                currentFilter
              }

            </button>

          )
        )}

      </div>


      {/* =================================================
          LOADING
      ================================================= */}

      {loading && (

        <div className="py-16 text-center">

          <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-fire-400" />


          <p className="text-sm text-slate-500">

            Loading FIRMS alerts...

          </p>

        </div>

      )}


      {/* =================================================
          ALERT FEED
      ================================================= */}

      {!loading && (

        <div className="space-y-3">

          {filtered.map(
            (
              alert,
              index
            ) => {

              const severity =
                severityIcon[
                alert.severity
                ];


              const SeverityIcon =
                severity.icon;


              return (

                <GlassCard
                  key={
                    alert.id
                  }
                  hover
                  className="
                    fade-in-up
                    p-4
                  "
                  style={{
                    animationDelay:
                      `${index * 40}ms`,
                  }}
                >

                  <div className="flex items-start gap-4">

                    {/* ICON */}

                    <div
                      className={`
                        flex
                        h-11
                        w-11
                        shrink-0
                        items-center
                        justify-center
                        rounded-xl
                        ${severity.bg}
                      `}
                    >

                      <SeverityIcon
                        className={`
                          h-5
                          w-5
                          ${severity.color}
                        `}
                      />

                    </div>


                    {/* CONTENT */}

                    <div className="min-w-0 flex-1">

                      {/* TOP ROW */}

                      <div className="mb-1.5 flex flex-wrap items-center gap-2">

                        <RiskBadge
                          level={
                            alert.severity
                          }
                          size="sm"
                        />


                        <span className="rounded-md border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400">

                          {
                            alert.priority
                          }

                        </span>


                        <span className="text-[10px] text-slate-500">

                          Risk{" "}
                          {
                            alert.riskScore
                          }
                          /100

                        </span>


                        <span className="ml-auto flex items-center gap-1 text-[10px] text-slate-500">

                          <Clock className="h-3 w-3" />

                          {
                            formatTimestamp(
                              alert.timestamp
                            )
                          }

                        </span>

                      </div>


                      {/* TITLE */}

                      <p className="text-sm font-bold text-white">

                        {
                          alert.title
                        }

                      </p>


                      {/* MESSAGE */}

                      <p className="mt-1 text-xs leading-relaxed text-slate-400">

                        {
                          alert.message
                        }

                      </p>


                      {/* METRICS */}

                      <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-500">

                        <span className="flex items-center gap-1">

                          <MapPin className="h-3 w-3" />

                          {
                            alert.location
                          }

                        </span>


                        <span>

                          FRP{" "}

                          <strong className="text-slate-300">

                            {
                              alert.frp.toFixed(
                                1
                              )
                            }
                            {" "}
                            MW

                          </strong>

                        </span>


                        <span>

                          Brightness{" "}

                          <strong className="text-slate-300">

                            {
                              alert.brightness.toFixed(
                                1
                              )
                            }
                            {" "}
                            K

                          </strong>

                        </span>


                        <span>

                          Nearby{" "}

                          <strong className="text-slate-300">

                            {
                              alert.nearbyHotspots
                            }

                          </strong>

                        </span>

                      </div>


                      {/* RECOMMENDATION */}

                      {alert.recommendation && (

                        <div
                          className="
                            mt-3
                            rounded-lg
                            bg-fire-500/[0.06]
                            p-3
                            text-xs
                            leading-relaxed
                            text-slate-300
                          "
                        >

                          {
                            alert.recommendation
                          }

                        </div>

                      )}

                    </div>

                  </div>

                </GlassCard>

              );

            }
          )}

        </div>

      )}


      {/* =================================================
          EMPTY STATE
      ================================================= */}

      {!loading &&
        filtered.length === 0 && (

          <div className="py-16 text-center">

            <Bell className="mx-auto mb-3 h-10 w-10 text-slate-600" />


            <p className="text-sm text-slate-500">

              No alerts in this category.

            </p>

          </div>

        )}

    </div>
  );
}


/* ========================================================
   DATE FORMAT
======================================================== */

function formatTimestamp(
  value: string,
) {

  if (!value) {
    return "Unknown time";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }


  return date.toLocaleString();
}