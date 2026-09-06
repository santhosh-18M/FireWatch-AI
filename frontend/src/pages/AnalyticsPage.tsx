import {
  useEffect,
  useMemo,
  useState,
} from "react";

import GlassCard from "@/components/GlassCard";
import { RiskBadge } from "@/components/RiskBadge";

import {
  getHotspots,
  getLocation,
} from "@/services/api";

import type {
  Hotspot,
  RiskLevel,
} from "@/types";

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ScatterChart,
  Scatter,
} from "recharts";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Flame,
  Gauge,
  MapPin,
  PieChart as PieIcon,
  RefreshCw,
  Zap,
} from "lucide-react";


const tooltipStyle = {
  background:
    "rgba(15,22,32,0.97)",
  border:
    "1px solid rgba(255,122,69,0.20)",
  borderRadius:
    "12px",
  fontSize:
    "12px",
};


const riskOrder: RiskLevel[] = [
  "Low",
  "Moderate",
  "High",
  "Extreme",
];


const riskColors: Record<
  RiskLevel,
  string
> = {
  Low: "#22c55e",
  Moderate: "#eab308",
  High: "#ff7a45",
  Extreme: "#ef4444",
};


type HotspotLocation = {
  title: string;
  subtitle: string;
};


export default function AnalyticsPage() {

  const [
    hotspots,
    setHotspots,
  ] =
    useState<Hotspot[]>([]);


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    error,
    setError,
  ] =
    useState("");


  const [
    updated,
    setUpdated,
  ] =
    useState<Date | null>(
      null
    );


  const [
    locations,
    setLocations,
  ] =
    useState<
      Record<
        string,
        HotspotLocation
      >
    >({});


  async function loadData() {

    setLoading(true);
    setError("");

    try {

      const data =
        await getHotspots();

      setHotspots(data);
      setUpdated(new Date());

    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load analytics data"
      );

    } finally {

      setLoading(false);
    }
  }


  useEffect(
    () => {
      loadData();
    },
    []
  );


  const totalHotspots =
    hotspots.length;


  const averageRisk =
    useMemo(
      () => {

        if (
          hotspots.length ===
          0
        ) {
          return 0;
        }

        const total =
          hotspots.reduce(
            (
              sum,
              hotspot
            ) =>
              sum +
              hotspot.riskScore,
            0
          );

        return Math.round(
          total /
          hotspots.length
        );

      },
      [hotspots]
    );


  const highRiskCount =
    useMemo(
      () =>
        hotspots.filter(
          hotspot =>
            hotspot.riskLevel ===
            "High" ||
            hotspot.riskLevel ===
            "Extreme"
        ).length,
      [hotspots]
    );


  const averageFrp =
    useMemo(
      () => {

        if (
          hotspots.length ===
          0
        ) {
          return 0;
        }

        const valid =
          hotspots.filter(
            hotspot =>
              Number.isFinite(
                hotspot.frp
              )
          );

        if (
          valid.length ===
          0
        ) {
          return 0;
        }

        const total =
          valid.reduce(
            (
              sum,
              hotspot
            ) =>
              sum +
              hotspot.frp,
            0
          );

        return (
          total /
          valid.length
        );

      },
      [hotspots]
    );


  const riskDistribution =
    useMemo(
      () => {

        return riskOrder.map(
          level => {

            const value =
              hotspots.filter(
                hotspot =>
                  hotspot.riskLevel ===
                  level
              ).length;

            return {
              name:
                level,

              value,

              color:
                riskColors[
                level
                ],
            };
          }
        );

      },
      [hotspots]
    );


  const riskScoreDistribution =
    useMemo(
      () => {

        const ranges = [
          {
            label:
              "0-19",
            min:
              0,
            max:
              19,
          },

          {
            label:
              "20-39",
            min:
              20,
            max:
              39,
          },

          {
            label:
              "40-59",
            min:
              40,
            max:
              59,
          },

          {
            label:
              "60-79",
            min:
              60,
            max:
              79,
          },

          {
            label:
              "80-100",
            min:
              80,
            max:
              100,
          },
        ];

        return ranges.map(
          range => ({
            range:
              range.label,

            count:
              hotspots.filter(
                hotspot =>
                  hotspot.riskScore >=
                  range.min &&
                  hotspot.riskScore <=
                  range.max
              ).length,
          })
        );

      },
      [hotspots]
    );


  const frpRiskData =
    useMemo(
      () => {

        return hotspots
          .filter(
            hotspot =>
              Number.isFinite(
                hotspot.frp
              ) &&
              Number.isFinite(
                hotspot.riskScore
              )
          )
          .map(
            hotspot => ({
              frp:
                Number(
                  hotspot.frp.toFixed(
                    2
                  )
                ),

              risk:
                hotspot.riskScore,

              level:
                hotspot.riskLevel,

              brightness:
                hotspot.brightness,

              lat:
                hotspot.lat,

              lng:
                hotspot.lng,
            })
          );

      },
      [hotspots]
    );


  const topHotspots =
    useMemo(
      () => {

        return [
          ...hotspots,
        ]
          .sort(
            (
              a,
              b
            ) => {

              if (
                b.riskScore !==
                a.riskScore
              ) {

                return (
                  b.riskScore -
                  a.riskScore
                );
              }

              return (
                b.frp -
                a.frp
              );
            }
          )
          .slice(
            0,
            10
          );

      },
      [hotspots]
    );


  /* =====================================================
     REVERSE GEOCODE TOP 10 ONLY
  ====================================================== */

  useEffect(
    () => {

      if (
        topHotspots.length ===
        0
      ) {
        return;
      }


      let cancelled =
        false;


      async function loadLocations() {

        for (
          const hotspot
          of topHotspots
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


            if (
              cancelled
            ) {
              return;
            }


            const title =
              location.city
              || location.district
              || location.state
              || location.country
              || "Unknown location";


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


            const subtitle =
              parts.length > 0
                ? parts.join(", ")
                : `${hotspot.lat.toFixed(4)}, ${hotspot.lng.toFixed(4)}`;


            setLocations(
              previous => ({
                ...previous,

                [hotspot.id]: {
                  title,
                  subtitle,
                },
              })
            );


          } catch {

            if (
              cancelled
            ) {
              return;
            }


            setLocations(
              previous => ({
                ...previous,

                [hotspot.id]: {
                  title:
                    "Location unavailable",

                  subtitle:
                    `${hotspot.lat.toFixed(4)}, ${hotspot.lng.toFixed(4)}`,
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

    },
    [topHotspots]
  );


  if (
    loading
  ) {

    return (

      <div className="flex min-h-[70vh] items-center justify-center">

        <div className="text-center">

          <RefreshCw className="mx-auto mb-3 h-7 w-7 animate-spin text-fire-400" />

          <p className="text-sm text-slate-400">

            Loading FIRMS analytics...

          </p>

        </div>

      </div>
    );
  }


  return (

    <div className="p-4 lg:p-6">

      <div className="mb-6 flex items-start justify-between gap-4">

        <div>

          <h1 className="text-2xl font-bold text-white">

            Risk Analytics

          </h1>


          <p className="mt-1 text-sm text-slate-400">

            Analytics generated from current NASA FIRMS thermal detections

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
            loadData
          }
          className="
            flex
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
          "
        >

          <RefreshCw className="h-3.5 w-3.5" />

          Refresh

        </button>

      </div>


      {error && (

        <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">

          {
            error
          }

        </div>

      )}


      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <GlassCard className="p-4" hover>

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fire-500/10">

              <Flame className="h-5 w-5 text-fire-400" />

            </div>

            <div>

              <p className="font-mono text-2xl font-bold text-white">

                {totalHotspots}

              </p>

              <p className="text-xs text-slate-400">

                Thermal Hotspots

              </p>

            </div>

          </div>

        </GlassCard>


        <GlassCard className="p-4" hover>

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/10">

              <Gauge className="h-5 w-5 text-yellow-400" />

            </div>

            <div>

              <p className="font-mono text-2xl font-bold text-white">

                {averageRisk}

              </p>

              <p className="text-xs text-slate-400">

                Average Risk Score

              </p>

            </div>

          </div>

        </GlassCard>


        <GlassCard className="p-4" hover>

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">

              <AlertTriangle className="h-5 w-5 text-orange-400" />

            </div>

            <div>

              <p className="font-mono text-2xl font-bold text-white">

                {highRiskCount}

              </p>

              <p className="text-xs text-slate-400">

                High / Extreme

              </p>

            </div>

          </div>

        </GlassCard>


        <GlassCard className="p-4" hover>

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">

              <Zap className="h-5 w-5 text-blue-400" />

            </div>

            <div>

              <p className="font-mono text-2xl font-bold text-white">

                {
                  averageFrp.toFixed(
                    1
                  )
                }

              </p>

              <p className="text-xs text-slate-400">

                Average FRP MW

              </p>

            </div>

          </div>

        </GlassCard>

      </div>


      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">

        <GlassCard className="p-5" hover>

          <div className="mb-4 flex items-center gap-2">

            <PieIcon className="h-4 w-4 text-fire-400" />

            <h2 className="text-sm font-bold text-white">

              Risk Distribution

            </h2>

          </div>


          <ResponsiveContainer width="100%" height={280}>

            <PieChart>

              <Pie
                data={riskDistribution}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={3}
              >

                {riskDistribution.map(
                  item => (

                    <Cell
                      key={item.name}
                      fill={item.color}
                      stroke="none"
                    />

                  )
                )}

              </Pie>

              <Tooltip contentStyle={tooltipStyle} />

            </PieChart>

          </ResponsiveContainer>


          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">

            {riskDistribution.map(
              item => (

                <div
                  key={item.name}
                  className="rounded-lg bg-white/[0.03] p-2 text-center"
                >

                  <p className="font-mono text-lg font-bold text-white">

                    {item.value}

                  </p>

                  <p className="text-[10px] text-slate-500">

                    {item.name}

                  </p>

                </div>

              )
            )}

          </div>

        </GlassCard>


        <GlassCard className="p-5" hover>

          <div className="mb-4 flex items-center gap-2">

            <BarChart3 className="h-4 w-4 text-fire-400" />

            <h2 className="text-sm font-bold text-white">

              Risk Score Distribution

            </h2>

          </div>


          <ResponsiveContainer width="100%" height={300}>

            <BarChart data={riskScoreDistribution}>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />

              <XAxis
                dataKey="range"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />

              <Tooltip contentStyle={tooltipStyle} />

              <Bar
                dataKey="count"
                fill="#ff5722"
                radius={[6, 6, 0, 0]}
                name="Hotspots"
              />

            </BarChart>

          </ResponsiveContainer>

        </GlassCard>

      </div>


      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">

        <GlassCard className="p-5" hover>

          <div className="mb-1 flex items-center gap-2">

            <Activity className="h-4 w-4 text-fire-400" />

            <h2 className="text-sm font-bold text-white">

              FRP vs Risk Score

            </h2>

          </div>


          <p className="mb-4 text-[11px] text-slate-500">

            Relationship between FIRMS fire radiative power and the heuristic risk score

          </p>


          <ResponsiveContainer width="100%" height={320}>

            <ScatterChart>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />

              <XAxis
                type="number"
                dataKey="frp"
                name="FRP"
                unit=" MW"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                type="number"
                dataKey="risk"
                name="Risk"
                domain={[0, 100]}
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />

              <Tooltip
                cursor={{
                  strokeDasharray:
                    "3 3",
                }}
                contentStyle={
                  tooltipStyle
                }
              />

              <Scatter
                name="Thermal Hotspots"
                data={frpRiskData}
                fill="#ff5722"
              />

            </ScatterChart>

          </ResponsiveContainer>

        </GlassCard>


        <GlassCard className="p-5" hover>

          <div className="mb-4 flex items-center gap-2">

            <Flame className="h-4 w-4 text-fire-400" />

            <h2 className="text-sm font-bold text-white">

              Top 10 Risk Detections

            </h2>

          </div>


          <div className="scrollbar-thin max-h-[350px] space-y-2 overflow-y-auto pr-1">

            {topHotspots.map(
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
                    key={hotspot.id}
                    className="
                      flex
                      items-center
                      gap-3
                      rounded-xl
                      bg-ink-700/40
                      p-2.5
                      transition-colors
                      hover:bg-ink-700/70
                    "
                  >

                    <span
                      className={`
                        flex
                        h-7
                        w-7
                        shrink-0
                        items-center
                        justify-center
                        rounded-lg
                        font-mono
                        text-xs
                        font-bold

                        ${index < 3
                          ? "bg-red-500/15 text-red-400"
                          : "bg-white/5 text-slate-400"
                        }
                      `}
                    >

                      {index + 1}

                    </span>


                    <div className="min-w-0 flex-1">

                      <p className="flex items-center gap-1 truncate text-sm font-semibold text-white">

                        <MapPin className="h-3.5 w-3.5 shrink-0 text-fire-400" />

                        {
                          location?.title
                          ?? "Resolving location..."
                        }

                      </p>


                      <p className="truncate text-[11px] text-slate-500">

                        {
                          location?.subtitle
                          ?? `${hotspot.lat.toFixed(4)}, ${hotspot.lng.toFixed(4)}`
                        }

                        {" · FRP "}

                        {
                          hotspot.frp.toFixed(
                            1
                          )
                        }

                        {" MW"}

                      </p>

                    </div>


                    <div className="flex shrink-0 items-center gap-2">

                      <span className="font-mono text-sm font-bold text-white">

                        {
                          hotspot.riskScore
                        }

                      </span>


                      <RiskBadge
                        level={
                          hotspot.riskLevel
                        }
                        size="sm"
                      />

                    </div>

                  </div>
                );
              }
            )}

          </div>

        </GlassCard>

      </div>


      <GlassCard className="p-4">

        <div className="flex items-start gap-3">

          <Activity className="mt-0.5 h-4 w-4 shrink-0 text-fire-400" />

          <div>

            <p className="text-xs font-semibold text-white">

              About these analytics

            </p>

            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">

              These charts are calculated from the current NASA FIRMS
              thermal-anomaly feed loaded by FireWatch. A thermal detection
              does not by itself confirm an industrial fire or wildfire.
              The displayed risk score is the FireWatch Heuristic FIRMS Risk
              Index and is not an ML probability.

            </p>

          </div>

        </div>

      </GlassCard>

    </div>
  );
}