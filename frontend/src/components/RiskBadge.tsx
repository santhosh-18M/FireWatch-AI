import type {
  AlertStatus,
  RiskLevel,
} from "@/types/hotspot";


/* ========================================================
   RISK COLORS
======================================================== */

const riskColors: Record<
  RiskLevel,
  {
    bg: string;
    text: string;
    border: string;
    dot: string;
  }
> = {

  Low: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    dot: "bg-emerald-500",
  },

  Moderate: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    border: "border-yellow-500/30",
    dot: "bg-yellow-500",
  },

  High: {
    bg: "bg-orange-500/10",
    text: "text-orange-400",
    border: "border-orange-500/30",
    dot: "bg-orange-500",
  },

  Extreme: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/30",
    dot: "bg-red-500",
  },

};


/* ========================================================
   RISK BADGE
======================================================== */

export function RiskBadge({
  level,
  size = "md",
}: {
  level: RiskLevel;
  size?: "sm" | "md";
}) {

  const c =
    riskColors[level];


  const padding =
    size === "sm"
      ? "px-2 py-0.5 text-[10px]"
      : "px-2.5 py-1 text-xs";


  return (

    <span
      className={`
        inline-flex
        items-center
        gap-1.5
        rounded-full
        border
        font-semibold
        ${c.bg}
        ${c.text}
        ${c.border}
        ${padding}
      `}
    >

      <span
        className={`
          h-1.5
          w-1.5
          rounded-full
          ${c.dot}
        `}
      />

      {level}

    </span>

  );
}


/* ========================================================
   ALERT STATUS COLORS
======================================================== */

const statusColors: Record<
  AlertStatus,
  {
    text: string;
    bg: string;
    border: string;
  }
> = {

  Active: {
    text: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
  },

};


/* ========================================================
   STATUS BADGE
======================================================== */

export function StatusBadge({
  status,
}: {
  status: AlertStatus | string;
}) {

  const c =
    statusColors[
    status as AlertStatus
    ] ?? {
      text: "text-slate-400",
      bg: "bg-slate-500/10",
      border: "border-slate-500/30",
    };


  return (

    <span
      className={`
        inline-flex
        items-center
        rounded-md
        border
        px-2
        py-0.5
        text-[10px]
        font-semibold
        ${c.bg}
        ${c.text}
        ${c.border}
      `}
    >

      {status}

    </span>

  );
}


/* ========================================================
   MAP MARKER COLORS
======================================================== */

export const riskColorHex:
  Record<RiskLevel, string> = {

  Low:
    "#22c55e",

  Moderate:
    "#eab308",

  High:
    "#ff7a45",

  Extreme:
    "#ef4444",

};


/* ========================================================
   EXPORT
======================================================== */

export {
  riskColors,
};