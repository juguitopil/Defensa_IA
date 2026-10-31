import { riskLabel } from "../lib/format";
import type { RiskLevel } from "../types";

const TONE: Record<RiskLevel, string> = {
  low: "bg-low-wash text-low ring-low/25",
  medium: "bg-mid-wash text-mid ring-mid/25",
  high: "bg-high-wash text-high ring-high/30",
};

const DOT: Record<RiskLevel, string> = {
  low: "bg-low",
  medium: "bg-mid",
  high: "bg-high",
};

interface Props {
  score: number;
  level: RiskLevel;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function TrustStamp({ score, level, size = "sm", showLabel = true }: Props) {
  if (size === "lg") {
    return (
      <div
        className={`stamp flex h-[5.5rem] w-[5.5rem] flex-col items-center justify-center rounded-[1.35rem] ring-1 ${TONE[level]}`}
        aria-label={`${riskLabel(level)}, puntuación ${score} de 100`}
      >
        <span className="text-[1.65rem] font-semibold leading-none">{score}</span>
        <span className="mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.08em]">
          /100
        </span>
      </div>
    );
  }

  return (
    <span
      className={`stamp inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.72rem] font-semibold ring-1 ${TONE[level]} ${
        size === "md" ? "px-2.5 py-1 text-[0.78rem]" : ""
      }`}
      aria-label={`${riskLabel(level)}, ${score} de 100`}
    >
      <span className={`size-1.5 rounded-full ${DOT[level]}`} aria-hidden />
      <span>{score}</span>
      {showLabel && <span className="font-medium opacity-80">{riskLabel(level)}</span>}
    </span>
  );
}

export function RiskDot({ level }: { level: RiskLevel }) {
  return (
    <span className={`inline-block size-2 rounded-full ${DOT[level]}`} aria-hidden />
  );
}
