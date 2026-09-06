import type {
  ReactNode,
} from "react";

import {
  ExternalLink,
  Flame,
  History,
  Hospital,
  MapPin,
  Navigation,
  Radio,
  Satellite,
  ShieldAlert,
  Sparkles,
  Thermometer,
  X,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import type {
  Analysis,
  Hotspot,
  IncidentResponse,
  ResponseFacility,
  SatelliteEvidence,
} from "@/types/hotspot";

import {
  analyzeHotspot,
  classifyHotspot,
  getIncidentResponse,
  getSatelliteEvidence,
  getSatelliteImageUrl,
} from "@/services/api";

import type {
  AIClassificationResponse,
} from "@/services/api";

import {
  RiskBadge,
} from "./RiskBadge";

import GlassCard from "./GlassCard";


interface RiskAnalysisPanelProps {
  hotspot: Hotspot | null;

  open: boolean;

  onClose: () => void;
}


type Tab =
  | "analysis"
  | "response"
  | "details";


export default function RiskAnalysisPanel({
  hotspot,
  open,
  onClose,
}: RiskAnalysisPanelProps) {

  const [
    analysis,
    setAnalysis,
  ] =
    useState<Analysis | null>(
      null
    );


  const [
    loading,
    setLoading,
  ] =
    useState(false);


  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );


  const [
    activeTab,
    setActiveTab,
  ] =
    useState<Tab>(
      "analysis"
    );


  const [
    responseData,
    setResponseData,
  ] =
    useState<IncidentResponse | null>(
      null
    );


  const [
    responseLoading,
    setResponseLoading,
  ] =
    useState(false);


  const [
    responseError,
    setResponseError,
  ] =
    useState<string | null>(
      null
    );


  const [
    aiClassification,
    setAiClassification,
  ] =
    useState<AIClassificationResponse | null>(
      null
    );


  const [
    classificationLoading,
    setClassificationLoading,
  ] =
    useState(false);


  const [
    classificationError,
    setClassificationError,
  ] =
    useState<string | null>(
      null
    );


  const [
    satelliteEvidence,
    setSatelliteEvidence,
  ] =
    useState<SatelliteEvidence | null>(
      null
    );


  const [
    satelliteLoading,
    setSatelliteLoading,
  ] =
    useState(false);


  const [
    satelliteError,
    setSatelliteError,
  ] =
    useState<string | null>(
      null
    );


  const [
    satelliteImageLoaded,
    setSatelliteImageLoaded,
  ] =
    useState(false);


  const [
    satelliteImageError,
    setSatelliteImageError,
  ] =
    useState(false);


  /* ======================================================
     LOAD ANALYSIS
  ====================================================== */

  useEffect(() => {

    if (
      !hotspot ||
      !open
    ) {

      return;

    }


    let cancelled =
      false;


    setLoading(
      true
    );


    setError(
      null
    );


    setAnalysis(
      null
    );


    setActiveTab(
      "analysis"
    );


    setResponseData(
      null
    );


    setResponseError(
      null
    );


    setAiClassification(
      null
    );


    setClassificationError(
      null
    );


    setSatelliteEvidence(
      null
    );


    setSatelliteError(
      null
    );


    setSatelliteImageLoaded(
      false
    );


    setSatelliteImageError(
      false
    );


    analyzeHotspot(
      hotspot
    )
      .then(
        (
          result:
            Analysis
        ) => {

          if (!cancelled) {

            setAnalysis(
              result
            );

          }

        }
      )

      .catch(
        (
          err:
            unknown
        ) => {

          if (!cancelled) {

            setError(
              err instanceof Error
                ? err.message
                : "Analysis failed"
            );

          }

        }
      )

      .finally(
        () => {

          if (!cancelled) {

            setLoading(
              false
            );

          }

        }
      );


    return () => {

      cancelled =
        true;

    };

  }, [
    hotspot?.id,
    open,
  ]);


  /* ======================================================
     LOAD SENTINEL-2 EVIDENCE
  ====================================================== */

  useEffect(() => {

    if (
      !hotspot ||
      !open ||
      activeTab !== "analysis"
    ) {

      return;

    }


    let cancelled =
      false;


    setSatelliteLoading(
      true
    );


    setSatelliteError(
      null
    );


    setSatelliteEvidence(
      null
    );


    setSatelliteImageLoaded(
      false
    );


    setSatelliteImageError(
      false
    );


    getSatelliteEvidence(
      hotspot
    )
      .then(
        (
          result:
            SatelliteEvidence
        ) => {

          if (!cancelled) {

            setSatelliteEvidence(
              result
            );

          }

        }
      )

      .catch(
        (
          err:
            unknown
        ) => {

          if (!cancelled) {

            setSatelliteError(
              err instanceof Error
                ? err.message
                : "Unable to load Sentinel-2 evidence"
            );

          }

        }
      )

      .finally(
        () => {

          if (!cancelled) {

            setSatelliteLoading(
              false
            );

          }

        }
      );


    return () => {

      cancelled =
        true;

    };

  }, [
    hotspot?.id,
    open,
    activeTab,
  ]);


  /* ======================================================
     LOAD AI CLASSIFICATION
  ====================================================== */

  useEffect(() => {

    if (
      !hotspot ||
      !open ||
      activeTab !== "analysis"
    ) {

      return;

    }


    let cancelled =
      false;


    setClassificationLoading(
      true
    );


    setClassificationError(
      null
    );


    setAiClassification(
      null
    );


    classifyHotspot(
      hotspot
    )
      .then(
        (
          result:
            AIClassificationResponse
        ) => {

          if (!cancelled) {

            setAiClassification(
              result
            );

          }

        }
      )

      .catch(
        (
          err:
            unknown
        ) => {

          if (!cancelled) {

            setClassificationError(
              err instanceof Error
                ? err.message
                : "AI classification failed"
            );

          }

        }
      )

      .finally(
        () => {

          if (!cancelled) {

            setClassificationLoading(
              false
            );

          }

        }
      );


    return () => {

      cancelled =
        true;

    };

  }, [
    hotspot?.id,
    open,
    activeTab,
  ]);


  /* ======================================================
     LOAD INCIDENT RESPONSE
  ====================================================== */

  useEffect(() => {

    if (
      !open ||
      !hotspot ||
      activeTab !== "response"
    ) {

      return;

    }


    let cancelled =
      false;


    setResponseLoading(
      true
    );


    setResponseError(
      null
    );


    setResponseData(
      null
    );


    getIncidentResponse(
      hotspot.lat,
      hotspot.lng
    )
      .then(
        (
          result:
            IncidentResponse
        ) => {

          if (!cancelled) {

            setResponseData(
              result
            );

          }

        }
      )

      .catch(
        (
          err:
            unknown
        ) => {

          if (!cancelled) {

            setResponseError(
              err instanceof Error
                ? err.message
                : "Unable to load response information"
            );

          }

        }
      )

      .finally(
        () => {

          if (!cancelled) {

            setResponseLoading(
              false
            );

          }

        }
      );


    return () => {

      cancelled =
        true;

    };

  }, [
    activeTab,
    hotspot?.id,
    open,
  ]);


  /* ======================================================
     BASIC VALUES
  ====================================================== */

  const score =
    analysis?.riskScore
    ??
    hotspot?.riskScore
    ??
    0;


  const level =
    analysis?.riskLevel
    ??
    hotspot?.riskLevel
    ??
    "Low";


  const isPriority =
    level === "High"
    ||
    level === "Extreme";


  const ringColor =
    score >= 80
      ? "#ef4444"

      : score >= 60
        ? "#ff7a45"

        : score >= 40
          ? "#eab308"

          : "#22c55e";


  const contributors =
    analysis?.riskContributors
    ??
    hotspot?.riskContributors
    ??
    {};


  const maxContributor =
    Math.max(
      ...Object.values(
        contributors
      ),
      1
    );


  const responseStart =
    responseData?.suggestedResponsePoint
    ??
    responseData?.nearestFireStation
    ??
    responseData?.nearestPoliceStation
    ??
    responseData?.nearestHospital
    ??
    null;


  const hotspotMapUrl =
    hotspot
      ? (
        "https://www.google.com/maps/search/?api=1"
        +
        `&query=${hotspot.lat},${hotspot.lng}`
      )
      : null;


  return (
    <>

      {open && (

        <div
          className="
            fixed
            inset-0
            z-[40]
            bg-black/40
            backdrop-blur-sm
            md:hidden
          "
          onClick={
            onClose
          }
        />

      )}


      <div
        className={`
          fixed
          right-0
          top-0
          z-[45]
          h-full
          w-[420px]
          max-w-[94vw]
          transform
          border-l
          border-white/10
          bg-ink-800/95
          backdrop-blur-2xl
          transition-transform
          duration-300

          ${open
            ? "translate-x-0"
            : "translate-x-full"
          }
        `}
      >

        <div
          className="
            flex
            h-full
            flex-col
          "
        >

          {/* =================================================
              HEADER
          ================================================== */}

          <div
            className="
              shrink-0
              border-b
              border-white/10
            "
          >

            <div
              className="
                flex
                items-start
                justify-between
                p-5
                pb-4
              "
            >

              <div>

                <div
                  className="
                    flex
                    items-center
                    gap-2
                  "
                >

                  <Sparkles
                    className="
                      h-4
                      w-4
                      text-fire-400
                    "
                  />


                  <h3
                    className="
                      text-sm
                      font-bold
                      uppercase
                      tracking-wider
                      text-white
                    "
                  >

                    Hotspot Investigation

                  </h3>

                </div>


                <p
                  className="
                    mt-1
                    text-xs
                    text-slate-500
                  "
                >

                  FIRMS + persistence + OSM + Sentinel-2 assessment

                </p>

              </div>


              <button
                onClick={
                  onClose
                }
                className="
                  rounded-lg
                  p-1.5
                  text-slate-400
                  hover:bg-white/5
                  hover:text-white
                "
              >

                <X
                  className="
                    h-5
                    w-5
                  "
                />

              </button>

            </div>


            {hotspot && (

              <div
                className="
                  px-5
                  pb-4
                "
              >

                <div
                  className="
                    flex
                    items-start
                    justify-between
                    gap-3
                  "
                >

                  <div>

                    <h4
                      className="
                        text-lg
                        font-bold
                        text-white
                      "
                    >

                      {
                        analysis?.city
                        ||
                        analysis?.district
                        ||
                        analysis?.state
                        ||
                        hotspot.name
                      }

                    </h4>


                    <p
                      className="
                        mt-1
                        font-mono
                        text-[11px]
                        text-slate-500
                      "
                    >

                      {hotspot.lat.toFixed(4)}
                      ,{" "}
                      {hotspot.lng.toFixed(4)}

                    </p>

                  </div>


                  <RiskBadge
                    level={
                      level
                    }
                  />

                </div>

              </div>

            )}


            {hotspot && (

              <div
                className="
                  grid
                  grid-cols-3
                  gap-1
                  px-4
                  pb-3
                "
              >

                <TabButton
                  active={
                    activeTab === "analysis"
                  }
                  onClick={() =>
                    setActiveTab(
                      "analysis"
                    )
                  }
                >
                  Investigation
                </TabButton>


                <TabButton
                  active={
                    activeTab === "response"
                  }
                  priority={
                    isPriority
                  }
                  onClick={() =>
                    setActiveTab(
                      "response"
                    )
                  }
                >
                  Response
                </TabButton>


                <TabButton
                  active={
                    activeTab === "details"
                  }
                  onClick={() =>
                    setActiveTab(
                      "details"
                    )
                  }
                >
                  Details
                </TabButton>

              </div>

            )}

          </div>


          {/* =================================================
              CONTENT
          ================================================== */}

          <div
            className="
              flex-1
              overflow-y-auto
            "
          >

            {!hotspot && (

              <div
                className="
                  p-8
                  text-center
                  text-sm
                  text-slate-400
                "
              >

                Select a FIRMS thermal observation
                to investigate it.

              </div>

            )}


            {hotspot && (
              <>

                {/* ===========================================
                    INVESTIGATION TAB
                ============================================ */}

                {activeTab === "analysis" && (

                  <div
                    className="
                      space-y-5
                      p-5
                    "
                  >

                    {loading && (

                      <GlassCard
                        className="
                          p-4
                          text-sm
                          text-slate-400
                        "
                      >

                        Loading hotspot investigation...

                      </GlassCard>

                    )}


                    {error && (

                      <div
                        className="
                          rounded-xl
                          border
                          border-red-500/20
                          bg-red-500/10
                          p-4
                          text-xs
                          text-red-300
                        "
                      >

                        {error}

                      </div>

                    )}


                    {/* =======================================
                        LOCATION
                    ======================================== */}

                    <SectionTitle>
                      Location
                    </SectionTitle>


                    <GlassCard
                      className="
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

                        <MapPin
                          className="
                            mt-0.5
                            h-4
                            w-4
                            shrink-0
                            text-emerald-400
                          "
                        />


                        <div
                          className="
                            min-w-0
                          "
                        >

                          <p
                            className="
                              text-sm
                              font-semibold
                              text-white
                            "
                          >

                            {
                              analysis
                                ? (
                                  analysis.city
                                  ||
                                  analysis.district
                                  ||
                                  analysis.state
                                  ||
                                  "Unknown location"
                                )

                                : (
                                  hotspot.state
                                  ||
                                  hotspot.name
                                )
                            }

                          </p>


                          {analysis && (

                            <p
                              className="
                                mt-1
                                text-xs
                                leading-relaxed
                                text-slate-400
                              "
                            >

                              {
                                [
                                  analysis.district,
                                  analysis.state,
                                  analysis.country,
                                ]
                                  .filter(Boolean)
                                  .join(", ")
                              }

                            </p>

                          )}


                          <p
                            className="
                              mt-2
                              font-mono
                              text-[10px]
                              text-slate-500
                            "
                          >

                            {hotspot.lat.toFixed(5)}
                            ,{" "}
                            {hotspot.lng.toFixed(5)}

                          </p>

                        </div>

                      </div>

                    </GlassCard>


                    <div
                      className="
                        grid
                        grid-cols-2
                        gap-2
                      "
                    >

                      <SimpleMetric
                        label="FIRMS Acquisition"
                        value={
                          formatDateTime(
                            hotspot.acquiredAt
                          )
                        }
                      />


                      <SimpleMetric
                        label="Land Context"
                        value={
                          analysis?.landType
                          ||
                          hotspot.landType
                          ||
                          "Unknown"
                        }
                      />

                    </div>


                    {/* =======================================
                        FIRMS OBSERVATION
                    ======================================== */}

                    <SectionTitle>
                      NASA FIRMS Observation
                    </SectionTitle>


                    <div
                      className="
                        grid
                        grid-cols-2
                        gap-2
                      "
                    >

                      <MetricCard
                        icon={
                          <Thermometer
                            className="
                              h-4
                              w-4
                              text-orange-400
                            "
                          />
                        }
                        label="Brightness"
                        value={
                          `${hotspot.brightness.toFixed(1)} K`
                        }
                      />


                      <MetricCard
                        icon={
                          <Flame
                            className="
                              h-4
                              w-4
                              text-orange-400
                            "
                          />
                        }
                        label="FRP"
                        value={
                          `${hotspot.frp.toFixed(1)} MW`
                        }
                      />


                      <MetricCard
                        icon={
                          <Radio
                            className="
                              h-4
                              w-4
                              text-sky-400
                            "
                          />
                        }
                        label="Confidence"
                        value={
                          String(
                            hotspot.confidence
                          )
                        }
                      />


                      <MetricCard
                        icon={
                          <MapPin
                            className="
                              h-4
                              w-4
                              text-emerald-400
                            "
                          />
                        }
                        label="Nearby Detections"
                        value={
                          String(
                            hotspot.nearbyHotspots
                          )
                        }
                      />

                    </div>


                    <GlassCard
                      className="
                        p-3
                      "
                    >

                      <p
                        className="
                          text-[10px]
                          leading-relaxed
                          text-slate-500
                        "
                      >

                        NASA FIRMS observations represent
                        satellite-detected thermal anomalies.
                        They are not by themselves confirmed
                        industrial or natural fires.

                      </p>

                    </GlassCard>


                    {/* =======================================
                        THERMAL HISTORY
                    ======================================== */}

                    {analysis && (

                      <>

                        <SectionTitle>
                          Thermal History
                        </SectionTitle>


                        <GlassCard
                          className="
                            p-4
                          "
                        >

                          {analysis.persistence.available ? (

                            <>

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
                                    h-10
                                    w-10
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-xl
                                    bg-sky-500/10
                                  "
                                >

                                  <History
                                    className="
                                      h-5
                                      w-5
                                      text-sky-400
                                    "
                                  />

                                </div>


                                <div>

                                  <p
                                    className="
                                      text-sm
                                      font-bold
                                      text-white
                                    "
                                  >

                                    {
                                      analysis.persistence
                                        .summary.status
                                    }

                                  </p>


                                  <p
                                    className="
                                      mt-1
                                      text-xs
                                      leading-relaxed
                                      text-slate-400
                                    "
                                  >

                                    {
                                      analysis.persistence
                                        .summary.message
                                    }

                                  </p>

                                </div>

                              </div>


                              {analysis.persistence.features && (

                                <>

                                  <div
                                    className="
                                      mt-4
                                      grid
                                      grid-cols-2
                                      gap-2
                                    "
                                  >

                                    <HistoryMetric
                                      label="Last 3 days"
                                      value={
                                        analysis.persistence
                                          .features
                                          .detections3d
                                      }
                                    />


                                    <HistoryMetric
                                      label="Last 7 days"
                                      value={
                                        analysis.persistence
                                          .features
                                          .detections7d
                                      }
                                    />


                                    <HistoryMetric
                                      label="Last 10 days"
                                      value={
                                        analysis.persistence
                                          .features
                                          .detections10d
                                      }
                                    />


                                    <HistoryMetric
                                      label="Last 30 days"
                                      value={
                                        analysis.persistence
                                          .features
                                          .detections30d
                                      }
                                    />

                                  </div>


                                  <div
                                    className="
                                      mt-3
                                      rounded-lg
                                      bg-white/[0.025]
                                      px-3
                                    "
                                  >

                                    <InfoRow
                                      label="Distinct active days"
                                      value={
                                        String(
                                          analysis.persistence
                                            .features
                                            .distinctActiveDays30d
                                        )
                                      }
                                    />


                                    <InfoRow
                                      label="Observation span"
                                      value={
                                        `${analysis.persistence
                                          .features
                                          .observationSpanDays} days`
                                      }
                                    />


                                    <InfoRow
                                      label="30-day active-day fraction"
                                      value={
                                        formatPercentage(
                                          analysis.persistence
                                            .features
                                            .activeDayFraction30d
                                        )
                                      }
                                    />

                                  </div>

                                </>

                              )}


                              <div
                                className="
                                  mt-3
                                  grid
                                  grid-cols-2
                                  gap-2
                                "
                              >

                                <TemporalDate
                                  label="First observed"
                                  value={
                                    formatObservationDate(
                                      analysis.persistence
                                        .summary
                                        .firstObserved
                                    )
                                  }
                                />


                                <TemporalDate
                                  label="Latest observed"
                                  value={
                                    formatObservationDate(
                                      analysis.persistence
                                        .summary
                                        .latestObserved
                                    )
                                  }
                                />

                              </div>


                              <div
                                className="
                                  mt-3
                                  rounded-lg
                                  border
                                  border-sky-400/10
                                  bg-sky-400/[0.035]
                                  p-3
                                "
                              >

                                <p
                                  className="
                                    text-[10px]
                                    leading-relaxed
                                    text-slate-400
                                  "
                                >

                                  Repeated detections indicate
                                  repeated thermal activity near
                                  this location. Persistence alone
                                  does not prove that the source is
                                  industrial.

                                </p>

                              </div>

                            </>

                          ) : (

                            <div
                              className="
                                flex
                                items-start
                                gap-3
                              "
                            >

                              <History
                                className="
                                  mt-0.5
                                  h-4
                                  w-4
                                  shrink-0
                                  text-slate-500
                                "
                              />


                              <div>

                                <p
                                  className="
                                    text-sm
                                    font-semibold
                                    text-white
                                  "
                                >

                                  Historical analysis unavailable

                                </p>


                                <p
                                  className="
                                    mt-1
                                    text-xs
                                    leading-relaxed
                                    text-slate-500
                                  "
                                >

                                  {
                                    analysis.persistence
                                      .summary.message
                                  }

                                </p>

                              </div>

                            </div>

                          )}

                        </GlassCard>

                      </>

                    )}


                    {/* =======================================
                        SURROUNDING CONTEXT
                    ======================================== */}

                    {analysis && (

                      <>

                        <SectionTitle>
                          Surrounding Context
                        </SectionTitle>


                        <GlassCard
                          className="
                            p-4
                          "
                        >

                          <InfoRow
                            label="Land Context"
                            value={
                              analysis.osm.landType
                              ||
                              "Unknown"
                            }
                          />


                          <InfoRow
                            label="Nearest Industrial Area"
                            value={
                              formatDistance(
                                analysis.osm
                                  .nearestIndustrialKm
                              )
                            }
                          />


                          <InfoRow
                            label="Nearest Factory"
                            value={
                              formatDistance(
                                analysis.osm
                                  .nearestFactoryKm
                              )
                            }
                          />


                          <InfoRow
                            label="Nearest Refinery"
                            value={
                              formatDistance(
                                analysis.osm
                                  .nearestRefineryKm
                              )
                            }
                          />


                          <InfoRow
                            label="Nearest Power Plant"
                            value={
                              formatDistance(
                                analysis.osm
                                  .nearestPowerPlantKm
                              )
                            }
                          />


                          <InfoRow
                            label="Nearest Forest"
                            value={
                              formatDistance(
                                analysis.osm
                                  .nearestForestKm
                              )
                            }
                          />


                          <InfoRow
                            label="Nearest Agriculture"
                            value={
                              formatDistance(
                                analysis.osm
                                  .nearestAgricultureKm
                              )
                            }
                          />


                          <InfoRow
                            label="Mapped OSM Features"
                            value={
                              String(
                                analysis.osm
                                  .osmFeaturesFound
                              )
                            }
                          />

                        </GlassCard>


                        <GlassCard
                          className="
                            p-3
                          "
                        >

                          <p
                            className="
                              text-[10px]
                              leading-relaxed
                              text-slate-500
                            "
                          >

                            OSM context is derived from
                            nearby mapped features and
                            proximity. It does not mean
                            the FIRMS coordinate lies
                            directly inside a particular
                            facility.

                          </p>

                        </GlassCard>

                      </>

                    )}


                    {/* =======================================
                        SATELLITE EVIDENCE
                    ======================================== */}

                    <SectionTitle>
                      Satellite Evidence
                    </SectionTitle>


                    {satelliteLoading && (

                      <GlassCard
                        className="
                          p-4
                        "
                      >

                        <div
                          className="
                            flex
                            items-center
                            gap-3
                          "
                        >

                          <Satellite
                            className="
                              h-5
                              w-5
                              animate-pulse
                              text-sky-400
                            "
                          />


                          <div>

                            <p
                              className="
                                text-sm
                                font-semibold
                                text-white
                              "
                            >
                              Searching Sentinel-2 imagery
                            </p>


                            <p
                              className="
                                mt-1
                                text-xs
                                leading-relaxed
                                text-slate-500
                              "
                            >
                              Finding a usable Sentinel-2 scene
                              near this FIRMS observation.
                            </p>

                          </div>

                        </div>

                      </GlassCard>

                    )}


                    {satelliteError && (

                      <GlassCard
                        className="
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

                          <Satellite
                            className="
                              mt-0.5
                              h-5
                              w-5
                              shrink-0
                              text-slate-500
                            "
                          />


                          <div>

                            <p
                              className="
                                text-sm
                                font-semibold
                                text-white
                              "
                            >
                              Satellite evidence unavailable
                            </p>


                            <p
                              className="
                                mt-1
                                text-xs
                                leading-relaxed
                                text-slate-500
                              "
                            >
                              {satelliteError}
                            </p>

                          </div>

                        </div>

                      </GlassCard>

                    )}


                    {!satelliteLoading &&
                      !satelliteError &&
                      satelliteEvidence &&
                      !satelliteEvidence.available && (

                        <GlassCard
                          className="
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

                            <Satellite
                              className="
                                mt-0.5
                                h-5
                                w-5
                                shrink-0
                                text-slate-500
                              "
                            />


                            <div>

                              <p
                                className="
                                  text-sm
                                  font-semibold
                                  text-white
                                "
                              >
                                No suitable Sentinel-2 scene
                              </p>


                              <p
                                className="
                                  mt-1
                                  text-xs
                                  leading-relaxed
                                  text-slate-500
                                "
                              >
                                {
                                  satelliteEvidence.message
                                  ||
                                  (
                                    "No suitable Sentinel-2 evidence "
                                    +
                                    "was available for this FIRMS observation."
                                  )
                                }
                              </p>

                            </div>

                          </div>

                        </GlassCard>

                      )}


                    {!satelliteLoading &&
                      !satelliteError &&
                      satelliteEvidence?.available &&
                      satelliteEvidence.selectedScene && (

                        <>

                          <GlassCard
                            className="
                              overflow-hidden
                            "
                          >

                            <div
                              className="
                                relative
                                aspect-video
                                w-full
                                overflow-hidden
                                bg-black/30
                              "
                            >

                              {!satelliteImageLoaded &&
                                !satelliteImageError && (

                                  <div
                                    className="
                                      absolute
                                      inset-0
                                      flex
                                      items-center
                                      justify-center
                                    "
                                  >

                                    <div
                                      className="
                                        text-center
                                      "
                                    >

                                      <Satellite
                                        className="
                                          mx-auto
                                          h-6
                                          w-6
                                          animate-pulse
                                          text-sky-400
                                        "
                                      />


                                      <p
                                        className="
                                          mt-2
                                          text-xs
                                          text-slate-500
                                        "
                                      >
                                        Loading Sentinel-2 image...
                                      </p>

                                    </div>

                                  </div>

                                )}


                              {!satelliteImageError && (

                                <img
                                  src={
                                    getSatelliteImageUrl(
                                      hotspot,
                                      satelliteEvidence
                                        .selectedScene
                                        .acquisitionDatetime
                                        .slice(0, 10)
                                    )
                                  }
                                  alt="Sentinel-2 true-colour satellite evidence"
                                  className={`
                                    h-full
                                    w-full
                                    object-cover
                                    transition-opacity
                                    duration-300

                                    ${satelliteImageLoaded
                                      ? "opacity-100"
                                      : "opacity-0"
                                    }
                                  `}
                                  onLoad={() => {
                                    setSatelliteImageLoaded(
                                      true
                                    );
                                  }}
                                  onError={() => {
                                    setSatelliteImageError(
                                      true
                                    );
                                  }}
                                />

                              )}


                              {satelliteImageError && (

                                <div
                                  className="
                                    absolute
                                    inset-0
                                    flex
                                    items-center
                                    justify-center
                                    p-5
                                  "
                                >

                                  <div
                                    className="
                                      text-center
                                    "
                                  >

                                    <Satellite
                                      className="
                                        mx-auto
                                        h-6
                                        w-6
                                        text-slate-500
                                      "
                                    />


                                    <p
                                      className="
                                        mt-2
                                        text-xs
                                        text-slate-400
                                      "
                                    >
                                      Sentinel-2 image could not be loaded.
                                    </p>

                                  </div>

                                </div>

                              )}


                              <div
                                className="
                                  absolute
                                  bottom-2
                                  left-2
                                  rounded-md
                                  bg-black/70
                                  px-2
                                  py-1
                                  text-[9px]
                                  font-semibold
                                  text-white
                                  backdrop-blur
                                "
                              >
                                Sentinel-2 · True Colour
                              </div>

                            </div>


                            <div
                              className="
                                p-4
                              "
                            >

                              <div
                                className="
                                  mb-3
                                  flex
                                  items-start
                                  gap-3
                                "
                              >

                                <div
                                  className="
                                    flex
                                    h-9
                                    w-9
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-lg
                                    bg-sky-500/10
                                  "
                                >

                                  <Satellite
                                    className="
                                      h-4
                                      w-4
                                      text-sky-400
                                    "
                                  />

                                </div>


                                <div>

                                  <p
                                    className="
                                      text-sm
                                      font-bold
                                      text-white
                                    "
                                  >
                                    {satelliteEvidence.product}
                                  </p>


                                  <p
                                    className="
                                      mt-0.5
                                      text-[10px]
                                      text-slate-500
                                    "
                                  >
                                    {satelliteEvidence.source}
                                  </p>

                                </div>

                              </div>


                              <InfoRow
                                label="Acquired"
                                value={
                                  formatSatelliteDate(
                                    satelliteEvidence
                                      .selectedScene
                                      .acquisitionDatetime
                                  )
                                }
                              />


                              <InfoRow
                                label="Platform"
                                value={
                                  satelliteEvidence
                                    .selectedScene
                                    .platform
                                  ||
                                  "Sentinel-2"
                                }
                              />


                              <InfoRow
                                label="Scene Cloud Cover"
                                value={
                                  formatOptionalPercentage(
                                    satelliteEvidence
                                      .selectedScene
                                      .cloudCover
                                  )
                                }
                              />


                              <InfoRow
                                label="Difference from FIRMS"
                                value={
                                  formatTemporalDifference(
                                    satelliteEvidence
                                      .selectedScene
                                      .temporalDifferenceDays
                                  )
                                }
                              />

                            </div>

                          </GlassCard>


                          {satelliteEvidence.localAnalysis && (

                            <GlassCard
                              className="
                                p-4
                              "
                            >

                              <p
                                className="
                                  mb-3
                                  text-[10px]
                                  font-semibold
                                  uppercase
                                  tracking-wider
                                  text-slate-500
                                "
                              >
                                Local Satellite Analysis
                              </p>


                              <InfoRow
                                label="Mean NDVI"
                                value={
                                  formatNdvi(
                                    satelliteEvidence
                                      .localAnalysis
                                      .meanNdvi
                                  )
                                }
                              />


                              <InfoRow
                                label="Minimum NDVI"
                                value={
                                  formatNdvi(
                                    satelliteEvidence
                                      .localAnalysis
                                      .minimumNdvi
                                  )
                                }
                              />


                              <InfoRow
                                label="Maximum NDVI"
                                value={
                                  formatNdvi(
                                    satelliteEvidence
                                      .localAnalysis
                                      .maximumNdvi
                                  )
                                }
                              />


                              <InfoRow
                                label="Vegetation Context"
                                value={
                                  satelliteEvidence
                                    .localAnalysis
                                    .vegetationContext
                                  ||
                                  "Unavailable"
                                }
                              />


                              <InfoRow
                                label="Usable Pixels"
                                value={
                                  `${satelliteEvidence
                                    .localAnalysis
                                    .usablePixelPercentage
                                    .toFixed(1)}%`
                                }
                              />


                              <InfoRow
                                label="Valid Pixels"
                                value={
                                  satelliteEvidence
                                    .localAnalysis
                                    .validPixels
                                    .toLocaleString()
                                }
                              />

                            </GlassCard>

                          )}


                          <GlassCard
                            className="
                              p-3
                            "
                          >

                            <p
                              className="
                                text-[10px]
                                leading-relaxed
                                text-slate-500
                              "
                            >
                              Sentinel-2 imagery and NDVI provide
                              environmental context around this
                              FIRMS thermal observation. They do
                              not independently confirm an
                              industrial fire or identify the
                              cause of the thermal anomaly.
                            </p>

                          </GlassCard>

                        </>

                      )}


                    {/* =======================================
                        HEURISTIC RISK
                    ======================================== */}

                    <SectionTitle>
                      Heuristic FIRMS Risk
                    </SectionTitle>


                    <GlassCard
                      className="
                        p-5
                      "
                    >

                      <div
                        className="
                          flex
                          items-center
                          gap-5
                        "
                      >

                        <RiskRing
                          score={
                            score
                          }
                          color={
                            ringColor
                          }
                        />


                        <div>

                          <p
                            className="
                              text-lg
                              font-bold
                              text-white
                            "
                          >

                            {level} Risk

                          </p>


                          <p
                            className="
                              mt-1
                              text-xs
                              text-slate-400
                            "
                          >

                            {
                              analysis?.riskMethod
                              ||
                              "Heuristic FIRMS Risk Index"
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

                            This score is a rule-based
                            prioritisation index and is
                            not an ML probability.

                          </p>

                        </div>

                      </div>

                    </GlassCard>


                    {Object.keys(
                      contributors
                    ).length > 0 && (

                        <GlassCard
                          className="
                          p-4
                        "
                        >

                          <p
                            className="
                            mb-3
                            text-[10px]
                            font-semibold
                            uppercase
                            tracking-wider
                            text-slate-500
                          "
                          >

                            Risk Contributors

                          </p>


                          <div
                            className="
                            space-y-3
                          "
                          >

                            {Object.entries(
                              contributors
                            ).map(
                              (
                                [
                                  label,
                                  value,
                                ]
                              ) => {

                                const width =
                                  Math.min(
                                    100,
                                    (
                                      value /
                                      maxContributor
                                    )
                                    *
                                    100
                                  );


                                return (

                                  <div
                                    key={
                                      label
                                    }
                                  >

                                    <div
                                      className="
                                      mb-1
                                      flex
                                      items-center
                                      justify-between
                                      text-xs
                                    "
                                    >

                                      <span
                                        className="
                                        text-slate-300
                                      "
                                      >

                                        {label}

                                      </span>


                                      <span
                                        className="
                                        font-mono
                                        font-semibold
                                        text-white
                                      "
                                      >

                                        {value.toFixed(1)}

                                      </span>

                                    </div>


                                    <div
                                      className="
                                      h-1.5
                                      overflow-hidden
                                      rounded-full
                                      bg-white/5
                                    "
                                    >

                                      <div
                                        className="
                                        h-full
                                        rounded-full
                                      "
                                        style={{
                                          width:
                                            `${width}%`,

                                          background:
                                            ringColor,
                                        }}
                                      />

                                    </div>

                                  </div>

                                );

                              }
                            )}

                          </div>

                        </GlassCard>

                      )}


                    {/* =======================================
                        SYSTEM ASSESSMENT
                    ======================================== */}

                    {analysis && (

                      <>

                        <SectionTitle>
                          System Assessment
                        </SectionTitle>


                        <GlassCard
                          className="
                            p-4
                          "
                        >

                          <p
                            className="
                              text-sm
                              leading-relaxed
                              text-slate-200
                            "
                          >

                            {
                              analysis.recommendation
                            }

                          </p>

                        </GlassCard>


                        {/* ===================================
                            CLASSIFICATION
                        ==================================== */}

                        <SectionTitle>
                          AI Classification
                        </SectionTitle>


                        {classificationLoading && (

                          <GlassCard
                            className="
                              p-4
                            "
                          >

                            <div
                              className="
                                flex
                                items-center
                                gap-3
                              "
                            >

                              <Sparkles
                                className="
                                  h-5
                                  w-5
                                  animate-pulse
                                  text-sky-400
                                "
                              />


                              <div>

                                <p
                                  className="
                                    text-sm
                                    font-semibold
                                    text-white
                                  "
                                >
                                  Running FireWatch AI...
                                </p>


                                <p
                                  className="
                                    mt-1
                                    text-xs
                                    text-slate-500
                                  "
                                >
                                  FIRMS + persistence + OSM context
                                </p>

                              </div>

                            </div>

                          </GlassCard>

                        )}


                        {classificationError && (

                          <GlassCard
                            className="
                              p-4
                            "
                          >

                            <p
                              className="
                                text-sm
                                font-semibold
                                text-white
                              "
                            >
                              AI classification unavailable
                            </p>


                            <p
                              className="
                                mt-1
                                text-xs
                                leading-relaxed
                                text-red-300
                              "
                            >
                              {classificationError}
                            </p>

                          </GlassCard>

                        )}


                        {!classificationLoading &&
                          !classificationError &&
                          aiClassification && (

                            <GlassCard
                              className="
                                overflow-hidden
                              "
                            >

                              <div
                                className="
                                  border-b
                                  border-white/5
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

                                  <div
                                    className="
                                      flex
                                      h-11
                                      w-11
                                      shrink-0
                                      items-center
                                      justify-center
                                      rounded-xl
                                      bg-sky-500/10
                                    "
                                  >

                                    <Sparkles
                                      className="
                                        h-5
                                        w-5
                                        text-sky-400
                                      "
                                    />

                                  </div>


                                  <div
                                    className="
                                      min-w-0
                                      flex-1
                                    "
                                  >

                                    <p
                                      className="
                                        text-base
                                        font-bold
                                        text-white
                                      "
                                    >

                                      {
                                        aiClassification
                                          .classification
                                          .displayLabel
                                      }

                                    </p>


                                    <p
                                      className="
                                        mt-1
                                        text-[10px]
                                        uppercase
                                        tracking-wider
                                        text-slate-500
                                      "
                                    >

                                      FireWatch XGBoost V3

                                    </p>

                                  </div>

                                </div>


                                <div
                                  className="
                                    mt-4
                                    rounded-xl
                                    bg-white/[0.035]
                                    p-3
                                  "
                                >

                                  <div
                                    className="
                                      flex
                                      items-end
                                      justify-between
                                      gap-4
                                    "
                                  >

                                    <div>

                                      <p
                                        className="
                                          text-[9px]
                                          uppercase
                                          tracking-wider
                                          text-slate-500
                                        "
                                      >
                                        Model Confidence
                                      </p>


                                      <p
                                        className="
                                          mt-1
                                          font-mono
                                          text-2xl
                                          font-bold
                                          text-white
                                        "
                                      >

                                        {
                                          aiClassification
                                            .classification
                                            .confidencePercent
                                            .toFixed(1)
                                        }%

                                      </p>

                                    </div>


                                    <div
                                      className="
                                        text-right
                                      "
                                    >

                                      <p
                                        className="
                                          text-[9px]
                                          text-slate-500
                                        "
                                      >
                                        Model
                                      </p>


                                      <p
                                        className="
                                          mt-1
                                          text-xs
                                          font-semibold
                                          text-slate-300
                                        "
                                      >
                                        V3 Precision
                                      </p>

                                    </div>

                                  </div>


                                  <div
                                    className="
                                      mt-3
                                      h-1.5
                                      overflow-hidden
                                      rounded-full
                                      bg-white/5
                                    "
                                  >

                                    <div
                                      className="
                                        h-full
                                        rounded-full
                                        bg-sky-400
                                      "
                                      style={{
                                        width:
                                          `${Math.min(
                                            100,
                                            aiClassification
                                              .classification
                                              .confidencePercent
                                          )
                                          }%`,
                                      }}
                                    />

                                  </div>

                                </div>

                              </div>


                              <div
                                className="
                                  space-y-2
                                  p-4
                                "
                              >

                                <InfoRow
                                  label="Industrial context ≤ 1.5 km"
                                  value={
                                    aiClassification
                                      .evidence
                                      .osm
                                      .industrialWithin1_5Km
                                      ? "Detected"
                                      : "Not detected"
                                  }
                                />


                                <InfoRow
                                  label="Natural context ≤ 1.5 km"
                                  value={
                                    aiClassification
                                      .evidence
                                      .osm
                                      .naturalWithin1_5Km
                                      ? "Detected"
                                      : "Not detected"
                                  }
                                />


                                <InfoRow
                                  label="Prior detections · 30 days"
                                  value={
                                    String(
                                      aiClassification
                                        .evidence
                                        .persistence
                                        .detections30d
                                    )
                                  }
                                />


                                <InfoRow
                                  label="Prior active days"
                                  value={
                                    String(
                                      aiClassification
                                        .evidence
                                        .persistence
                                        .distinctActiveDays30d
                                    )
                                  }
                                />

                              </div>


                              {aiClassification
                                .classification
                                .requiresVerification && (

                                  <div
                                    className="
                                      mx-4
                                      mb-4
                                      rounded-lg
                                      border
                                      border-orange-400/20
                                      bg-orange-400/[0.06]
                                      p-3
                                    "
                                  >

                                    <div
                                      className="
                                        flex
                                        items-start
                                        gap-2
                                      "
                                    >

                                      <ShieldAlert
                                        className="
                                          mt-0.5
                                          h-4
                                          w-4
                                          shrink-0
                                          text-orange-400
                                        "
                                      />


                                      <p
                                        className="
                                          text-[10px]
                                          leading-relaxed
                                          text-orange-200
                                        "
                                      >

                                        Industrial fire candidate.
                                        Requires satellite and contextual
                                        verification before incident confirmation.

                                      </p>

                                    </div>

                                  </div>

                                )}


                              <div
                                className="
                                  border-t
                                  border-white/5
                                  px-4
                                  py-3
                                "
                              >

                                <p
                                  className="
                                    text-[9px]
                                    leading-relaxed
                                    text-slate-500
                                  "
                                >

                                  AI classification uses NASA FIRMS thermal
                                  measurements, prior thermal persistence and
                                  OpenStreetMap context. Model confidence is
                                  relative to contextual weak-label classes,
                                  not a confirmed real-world fire probability.

                                </p>

                              </div>

                            </GlassCard>

                          )}

                      </>

                    )}

                  </div>

                )}


                {/* ===========================================
                    RESPONSE TAB
                ============================================ */}

                {activeTab === "response" && (

                  <div
                    className="
                      space-y-5
                      p-5
                    "
                  >

                    <SectionTitle>
                      Incident Response
                    </SectionTitle>


                    <GlassCard
                      className="
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

                        <ShieldAlert
                          className={`
                            mt-0.5
                            h-5
                            w-5
                            shrink-0

                            ${isPriority
                              ? "text-orange-400"
                              : "text-emerald-400"
                            }
                          `}
                        />


                        <div>

                          <p
                            className="
                              text-sm
                              font-bold
                              text-white
                            "
                          >

                            {
                              isPriority
                                ? `${level} Priority`
                                : "Monitoring"
                            }

                          </p>


                          <p
                            className="
                              mt-1
                              text-xs
                              leading-relaxed
                              text-slate-400
                            "
                          >

                            {
                              isPriority
                                ? (
                                  "This observation currently meets "
                                  +
                                  "the High/Extreme heuristic risk threshold."
                                )

                                : (
                                  "This observation does not currently meet "
                                  +
                                  "the High/Extreme heuristic risk threshold."
                                )
                            }

                          </p>

                        </div>

                      </div>

                    </GlassCard>


                    <SectionTitle>
                      Hotspot Destination
                    </SectionTitle>


                    <GlassCard
                      className="
                        p-4
                      "
                    >

                      <p
                        className="
                          text-sm
                          font-semibold
                          text-white
                        "
                      >

                        {
                          analysis?.city
                          ||
                          analysis?.district
                          ||
                          analysis?.state
                          ||
                          hotspot.state
                          ||
                          hotspot.name
                        }

                      </p>


                      <p
                        className="
                          mt-2
                          font-mono
                          text-xs
                          text-slate-400
                        "
                      >

                        {hotspot.lat.toFixed(4)}
                        ,{" "}
                        {hotspot.lng.toFixed(4)}

                      </p>

                    </GlassCard>


                    {responseLoading && (

                      <GlassCard
                        className="
                          p-4
                          text-sm
                          text-slate-400
                        "
                      >

                        Searching OpenStreetMap for
                        mapped emergency facilities...

                      </GlassCard>

                    )}


                    {responseError && (

                      <div
                        className="
                          rounded-xl
                          border
                          border-red-500/20
                          bg-red-500/10
                          p-4
                          text-xs
                          text-red-300
                        "
                      >

                        {responseError}

                      </div>

                    )}


                    {responseData && (
                      <>

                        <SectionTitle>
                          Suggested Response Starting Point
                        </SectionTitle>


                        {responseStart ? (

                          <ResponseStartCard
                            facility={
                              responseStart
                            }
                          />

                        ) : (

                          <GlassCard
                            className="
                              p-4
                            "
                          >

                            <p
                              className="
                                text-sm
                                font-semibold
                                text-white
                              "
                            >

                              No mapped response facility found

                            </p>

                          </GlassCard>

                        )}


                        {!responseStart &&
                          hotspotMapUrl && (

                            <a
                              href={
                                hotspotMapUrl
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="
                                flex
                                w-full
                                items-center
                                justify-center
                                gap-2
                                rounded-xl
                                bg-sky-500/15
                                px-4
                                py-3
                                text-sm
                                font-semibold
                                text-sky-300
                                transition
                                hover:bg-sky-500/25
                              "
                            >

                              <MapPin
                                className="
                                  h-4
                                  w-4
                                "
                              />

                              Open Hotspot in Google Maps

                              <ExternalLink
                                className="
                                  h-3.5
                                  w-3.5
                                "
                              />

                            </a>

                          )}


                        <SectionTitle>
                          Nearby Emergency Facilities
                        </SectionTitle>


                        <FacilityCard
                          title="Nearest Fire Station"
                          facility={
                            responseData.nearestFireStation
                          }
                          icon={
                            <Flame
                              className="
                                h-5
                                w-5
                                text-orange-400
                              "
                            />
                          }
                        />


                        {responseData.nearestFireStation && (

                          <RouteButton
                            url={
                              buildDirectionsUrl(
                                responseData.nearestFireStation.lat,
                                responseData.nearestFireStation.lng,
                                hotspot.lat,
                                hotspot.lng,
                              )
                            }

                            label="Route Fire Station → Hotspot"

                            tone="orange"
                          />

                        )}


                        <FacilityCard
                          title="Nearest Police Station"
                          facility={
                            responseData.nearestPoliceStation
                          }
                          icon={
                            <ShieldAlert
                              className="
                                h-5
                                w-5
                                text-sky-400
                              "
                            />
                          }
                        />


                        {responseData.nearestPoliceStation && (

                          <RouteButton
                            url={
                              buildDirectionsUrl(
                                responseData.nearestPoliceStation.lat,
                                responseData.nearestPoliceStation.lng,
                                hotspot.lat,
                                hotspot.lng,
                              )
                            }

                            label="Route Police Station → Hotspot"

                            tone="blue"
                          />

                        )}


                        <FacilityCard
                          title="Nearest Hospital"
                          facility={
                            responseData.nearestHospital
                          }
                          icon={
                            <Hospital
                              className="
                                h-5
                                w-5
                                text-emerald-400
                              "
                            />
                          }
                        />


                        {responseData.nearestHospital && (

                          <RouteButton
                            url={
                              buildDirectionsUrl(
                                hotspot.lat,
                                hotspot.lng,
                                responseData.nearestHospital.lat,
                                responseData.nearestHospital.lng,
                              )
                            }

                            label="Route Hotspot → Hospital"

                            tone="green"
                          />

                        )}


                        <div
                          className="
                            rounded-xl
                            border
                            border-white/5
                            bg-white/[0.02]
                            p-3
                          "
                        >

                          <p
                            className="
                              text-[10px]
                              leading-relaxed
                              text-slate-500
                            "
                          >

                            Emergency facility data is obtained
                            from OpenStreetMap. Distances shown
                            are straight-line distances. Google
                            Maps calculates the road route when
                            opened.

                          </p>

                        </div>

                      </>
                    )}

                  </div>

                )}


                {/* ===========================================
                    DETAILS TAB
                ============================================ */}

                {activeTab === "details" && (

                  <div
                    className="
                      space-y-4
                      p-5
                    "
                  >

                    {analysis && (
                      <>

                        <SectionTitle>
                          Full Location
                        </SectionTitle>


                        <GlassCard
                          className="
                            p-4
                          "
                        >

                          <p
                            className="
                              text-xs
                              leading-relaxed
                              text-slate-300
                            "
                          >

                            {
                              analysis.location.displayName
                              ||
                              "Detailed address unavailable"
                            }

                          </p>

                        </GlassCard>


                        <SectionTitle>
                          Persistence Diagnostics
                        </SectionTitle>


                        <GlassCard
                          className="
                            p-4
                          "
                        >

                          <InfoRow
                            label="Source"
                            value={
                              analysis.persistence.source
                              ||
                              "Unknown"
                            }
                          />


                          <InfoRow
                            label="Method"
                            value={
                              analysis.persistence.method
                              ||
                              "Unknown"
                            }
                          />


                          <InfoRow
                            label="Matching Detections"
                            value={
                              analysis.persistence
                                .matchingDetections !== undefined

                                ? String(
                                  analysis.persistence
                                    .matchingDetections
                                )

                                : "Unknown"
                            }
                          />


                          <InfoRow
                            label="Match Radius"
                            value={
                              analysis.persistence
                                .matchRadiusKm !== undefined

                                ? `${analysis.persistence
                                  .matchRadiusKm} km`

                                : "Unknown"
                            }
                          />

                        </GlassCard>


                        {analysis.persistence.features && (

                          <GlassCard
                            className="
                              p-4
                            "
                          >

                            <InfoRow
                              label="Mean Detection Distance"
                              value={
                                formatMeters(
                                  analysis.persistence
                                    .features
                                    .meanDetectionDistanceM
                                )
                              }
                            />


                            <InfoRow
                              label="Max Detection Distance"
                              value={
                                formatMeters(
                                  analysis.persistence
                                    .features
                                    .maxDetectionDistanceM
                                )
                              }
                            />


                            <InfoRow
                              label="Mean Detection Gap"
                              value={
                                formatDays(
                                  analysis.persistence
                                    .features
                                    .meanGapDays
                                )
                              }
                            />


                            <InfoRow
                              label="Minimum Gap"
                              value={
                                formatDays(
                                  analysis.persistence
                                    .features
                                    .minGapDays
                                )
                              }
                            />


                            <InfoRow
                              label="Maximum Gap"
                              value={
                                formatDays(
                                  analysis.persistence
                                    .features
                                    .maxGapDays
                                )
                              }
                            />

                          </GlassCard>

                        )}


                        <SectionTitle>
                          OSM Context Details
                        </SectionTitle>


                        <GlassCard
                          className="
                            p-4
                          "
                        >

                          <InfoRow
                            label="Nearest Feature"
                            value={
                              analysis.osm.nearestFeature
                              ||
                              "Not found"
                            }
                          />


                          <InfoRow
                            label="Feature Name"
                            value={
                              analysis.osm.nearestFeatureName
                              ||
                              "Not mapped"
                            }
                          />


                          <InfoRow
                            label="Feature Distance"
                            value={
                              formatDistance(
                                analysis.osm
                                  .nearestFeatureDistanceKm
                              )
                            }
                          />


                          <InfoRow
                            label="Lookup Status"
                            value={
                              analysis.osm.lookupStatus
                              ||
                              "Available"
                            }
                          />

                        </GlassCard>

                      </>
                    )}


                    <SectionTitle>
                      FIRMS Details
                    </SectionTitle>


                    <GlassCard
                      className="
                        p-4
                      "
                    >

                      <InfoRow
                        label="Brightness"
                        value={
                          `${hotspot.brightness.toFixed(1)} K`
                        }
                      />


                      <InfoRow
                        label="FRP"
                        value={
                          `${hotspot.frp.toFixed(1)} MW`
                        }
                      />


                      <InfoRow
                        label="Confidence"
                        value={
                          String(
                            hotspot.confidence
                          )
                        }
                      />


                      <InfoRow
                        label="Nearby Hotspots"
                        value={
                          String(
                            hotspot.nearbyHotspots
                          )
                        }
                      />


                      <InfoRow
                        label="Acquisition Time"
                        value={
                          formatDateTime(
                            hotspot.acquiredAt
                          )
                        }
                      />

                    </GlassCard>

                  </div>

                )}

              </>
            )}

          </div>

        </div>

      </div>

    </>
  );
}


/* ========================================================
   GOOGLE MAPS URL
======================================================== */

function buildDirectionsUrl(
  originLat: number,
  originLng: number,
  destinationLat: number,
  destinationLng: number,
): string {

  return (
    "https://www.google.com/maps/dir/?api=1"
    +
    `&origin=${originLat},${originLng}`
    +
    `&destination=${destinationLat},${destinationLng}`
    +
    "&travelmode=driving"
  );
}


/* ========================================================
   ROUTE BUTTON
======================================================== */

function RouteButton({
  url,
  label,
  tone,
}: {
  url: string;

  label: string;

  tone:
  | "orange"
  | "blue"
  | "green";
}) {

  const toneClass =
    tone === "orange"

      ? (
        "bg-orange-500/15 "
        +
        "text-orange-300 "
        +
        "hover:bg-orange-500/25 "
        +
        "border-orange-500/20"
      )

      : tone === "blue"

        ? (
          "bg-sky-500/15 "
          +
          "text-sky-300 "
          +
          "hover:bg-sky-500/25 "
          +
          "border-sky-500/20"
        )

        : (
          "bg-emerald-500/15 "
          +
          "text-emerald-300 "
          +
          "hover:bg-emerald-500/25 "
          +
          "border-emerald-500/20"
        );


  return (

    <a
      href={
        url
      }
      target="_blank"
      rel="noreferrer"
      className={`
        -mt-2
        flex
        w-full
        items-center
        justify-center
        gap-2
        rounded-xl
        border
        px-4
        py-2.5
        text-xs
        font-semibold
        transition

        ${toneClass}
      `}
    >

      <Navigation
        className="
          h-4
          w-4
        "
      />

      {label}

      <ExternalLink
        className="
          h-3.5
          w-3.5
        "
      />

    </a>

  );
}


/* ========================================================
   RESPONSE START CARD
======================================================== */

function ResponseStartCard({
  facility,
}: {
  facility:
  ResponseFacility;
}) {

  return (

    <GlassCard
      className="
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

        <div
          className="
            flex
            h-10
            w-10
            shrink-0
            items-center
            justify-center
            rounded-xl
            bg-white/5
          "
        >

          {facility.type ===
            "Fire Station" ? (

            <Flame
              className="
                h-5
                w-5
                text-orange-400
              "
            />

          ) : facility.type ===
            "Police Station" ? (

            <ShieldAlert
              className="
                h-5
                w-5
                text-sky-400
              "
            />

          ) : (

            <Hospital
              className="
                h-5
                w-5
                text-emerald-400
              "
            />

          )}

        </div>


        <div
          className="
            min-w-0
            flex-1
          "
        >

          <p
            className="
              text-[10px]
              uppercase
              tracking-wider
              text-slate-500
            "
          >

            {facility.type}

          </p>


          <p
            className="
              mt-1
              text-sm
              font-bold
              text-white
            "
          >

            {facility.name}

          </p>


          <p
            className="
              mt-1
              text-xs
              text-slate-400
            "
          >

            {facility.distanceKm.toFixed(2)}
            {" km straight-line from hotspot"}

          </p>


          <p
            className="
              mt-2
              font-mono
              text-[10px]
              text-slate-500
            "
          >

            {facility.lat.toFixed(4)}
            ,{" "}
            {facility.lng.toFixed(4)}

          </p>

        </div>

      </div>

    </GlassCard>

  );
}


/* ========================================================
   FACILITY CARD
======================================================== */

function FacilityCard({
  icon,
  title,
  facility,
}: {
  icon: ReactNode;

  title: string;

  facility:
  ResponseFacility | null;
}) {

  return (

    <GlassCard
      className="
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

        <div
          className="
            mt-0.5
            shrink-0
          "
        >

          {icon}

        </div>


        <div
          className="
            min-w-0
            flex-1
          "
        >

          <p
            className="
              text-[10px]
              uppercase
              tracking-wider
              text-slate-500
            "
          >

            {title}

          </p>


          {facility ? (
            <>

              <p
                className="
                  mt-1
                  text-sm
                  font-semibold
                  text-white
                "
              >

                {facility.name}

              </p>


              <p
                className="
                  mt-1
                  text-xs
                  text-slate-400
                "
              >

                {facility.distanceKm.toFixed(2)}
                {" km straight-line distance"}

              </p>

            </>
          ) : (

            <p
              className="
                mt-2
                text-sm
                text-slate-400
              "
            >

              No mapped facility found
              within the search radius.

            </p>

          )}

        </div>

      </div>

    </GlassCard>

  );
}


/* ========================================================
   TAB BUTTON
======================================================== */

function TabButton({
  active,
  priority = false,
  onClick,
  children,
}: {
  active: boolean;

  priority?: boolean;

  onClick: () => void;

  children: ReactNode;
}) {

  return (

    <button
      onClick={
        onClick
      }
      className={`
        relative
        rounded-lg
        px-2
        py-2
        text-[11px]
        font-semibold
        transition

        ${active
          ? "bg-white/10 text-white"
          : (
            "text-slate-500 "
            +
            "hover:bg-white/5 "
            +
            "hover:text-slate-300"
          )
        }

        ${priority &&
          !active
          ? "text-orange-400"
          : ""
        }
      `}
    >

      {children}


      {priority && (

        <span
          className="
            absolute
            right-2
            top-1.5
            h-1.5
            w-1.5
            rounded-full
            bg-orange-400
          "
        />

      )}

    </button>

  );
}


/* ========================================================
   SECTION TITLE
======================================================== */

function SectionTitle({
  children,
}: {
  children: ReactNode;
}) {

  return (

    <p
      className="
        text-xs
        font-semibold
        uppercase
        tracking-wider
        text-slate-400
      "
    >

      {children}

    </p>

  );
}


/* ========================================================
   METRIC CARD
======================================================== */

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;

  label: string;

  value: string;
}) {

  return (

    <div
      className="
        rounded-lg
        bg-ink-700/50
        p-3
      "
    >

      <div
        className="
          mb-1
        "
      >

        {icon}

      </div>


      <p
        className="
          font-mono
          text-xs
          font-bold
          text-white
        "
      >

        {value}

      </p>


      <p
        className="
          mt-0.5
          text-[9px]
          text-slate-500
        "
      >

        {label}

      </p>

    </div>

  );
}


/* ========================================================
   HISTORY METRIC
======================================================== */

function HistoryMetric({
  label,
  value,
}: {
  label: string;

  value: number;
}) {

  return (

    <div
      className="
        rounded-lg
        bg-white/[0.035]
        p-3
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
          font-mono
          text-xl
          font-bold
          text-white
        "
      >

        {value}

      </p>


      <p
        className="
          mt-0.5
          text-[9px]
          text-slate-500
        "
      >

        FIRMS detections

      </p>

    </div>

  );
}


/* ========================================================
   SIMPLE METRIC
======================================================== */

function SimpleMetric({
  label,
  value,
}: {
  label: string;

  value: string;
}) {

  return (

    <GlassCard
      className="
        p-3
      "
    >

      <p
        className="
          text-[10px]
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

    </GlassCard>

  );
}


/* ========================================================
   RISK RING
======================================================== */

function RiskRing({
  score,
  color,
}: {
  score: number;

  color: string;
}) {

  const safeScore =
    Math.max(
      0,
      Math.min(
        100,
        score
      )
    );


  return (

    <div
      className="
        relative
        h-24
        w-24
        shrink-0
      "
    >

      <svg
        className="
          h-full
          w-full
          -rotate-90
        "
        viewBox="0 0 100 100"
      >

        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="8"
        />


        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={
            color
          }
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={
            `${(
              safeScore /
              100
            )
            *
            264} 264`
          }
        />

      </svg>


      <div
        className="
          absolute
          inset-0
          flex
          flex-col
          items-center
          justify-center
        "
      >

        <span
          className="
            font-mono
            text-2xl
            font-bold
            text-white
          "
        >

          {Math.round(
            safeScore
          )}

        </span>


        <span
          className="
            text-[9px]
            text-slate-500
          "
        >

          / 100

        </span>

      </div>

    </div>

  );
}


/* ========================================================
   INFO ROW
======================================================== */

function InfoRow({
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
        gap-4
        border-b
        border-white/5
        py-2
        last:border-0
      "
    >

      <span
        className="
          text-xs
          text-slate-400
        "
      >

        {label}

      </span>


      <span
        className="
          text-right
          font-mono
          text-xs
          font-semibold
          text-white
        "
      >

        {value}

      </span>

    </div>

  );
}


/* ========================================================
   DISTANCE
======================================================== */

function formatDistance(
  value: number | null,
): string {

  if (
    value === null ||
    value === undefined
  ) {

    return "Not found";

  }


  if (value < 1) {

    return `${Math.round(
      value *
      1000
    )} m`;

  }


  return `${value.toFixed(2)} km`;
}


/* ========================================================
   METERS
======================================================== */

function formatMeters(
  value: number | null,
): string {

  if (
    value === null ||
    value === undefined
  ) {

    return "Unavailable";

  }


  if (value >= 1000) {

    return `${(
      value /
      1000
    ).toFixed(2)} km`;

  }


  return `${Math.round(
    value
  )} m`;
}


/* ========================================================
   DAYS
======================================================== */

function formatDays(
  value: number | null,
): string {

  if (
    value === null ||
    value === undefined
  ) {

    return "Unavailable";

  }


  return `${value.toFixed(1)} days`;
}


/* ========================================================
   PERCENTAGE
======================================================== */

function formatPercentage(
  value: number,
): string {

  return `${(
    value *
    100
  ).toFixed(1)}%`;
}


/* ========================================================
   TEMPORAL DATE
======================================================== */

function TemporalDate({
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
        bg-white/[0.03]
        px-3
        py-2
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
          font-mono
          text-xs
          font-semibold
          text-slate-200
        "
      >

        {value}

      </p>

    </div>

  );
}


/* ========================================================
   FORMAT OBSERVATION DATE
======================================================== */

function formatObservationDate(
  value: string | null,
): string {

  if (!value) {

    return "Unknown";

  }


  const date =
    new Date(
      `${value}T00:00:00Z`
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return value;

  }


  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",

      month: "short",

      year: "numeric",

      timeZone: "UTC",
    }
  );
}


/* ========================================================
   FORMAT FIRMS DATE TIME
======================================================== */

function formatDateTime(
  value: string,
): string {

  if (!value) {

    return "Unknown";

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


  return date.toLocaleString(
    "en-IN",
    {
      day: "2-digit",

      month: "short",

      year: "numeric",

      hour: "2-digit",

      minute: "2-digit",

      timeZone: "UTC",

      timeZoneName: "short",
    }
  );
}


/* ========================================================
   SATELLITE DATE
======================================================== */

function formatSatelliteDate(
  value: string,
): string {

  if (!value) {

    return "Unknown";

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


  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",

      month: "short",

      year: "numeric",

      timeZone: "UTC",
    }
  );
}


/* ========================================================
   OPTIONAL PERCENTAGE
======================================================== */

function formatOptionalPercentage(
  value: number | null,
): string {

  if (
    value === null ||
    value === undefined
  ) {

    return "Unavailable";

  }


  return `${value.toFixed(1)}%`;
}


/* ========================================================
   TEMPORAL DIFFERENCE
======================================================== */

function formatTemporalDifference(
  value: number,
): string {

  if (value === 0) {

    return "Same day";

  }


  return `${value} ${value === 1
    ? "day"
    : "days"
    }`;
}


/* ========================================================
   NDVI
======================================================== */

function formatNdvi(
  value: number | null,
): string {

  if (
    value === null ||
    value === undefined
  ) {

    return "Unavailable";

  }


  return value.toFixed(3);
}

