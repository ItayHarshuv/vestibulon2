import { useEffect, useRef, useState } from "react";
import type { ExerciseStatisticsSeries } from "~/lib/validation";

function formatDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
  }).format(date);
}

type ExerciseStatisticsChartProps = {
  series: ExerciseStatisticsSeries;
};

type ActiveTooltip = {
  date: string;
  left: number;
};

const yAxisTicks = [100, 75, 50, 25, 0];

const chartPalettes = [
  {
    bar: "#10b981",
    line: "#047857",
    dot: "#34d399",
    softBorder: "#a7f3d0",
    softBackground: "#ecfdf5",
    softText: "#047857",
  },
  {
    bar: "#3b82f6",
    line: "#1d4ed8",
    dot: "#60a5fa",
    softBorder: "#bfdbfe",
    softBackground: "#eff6ff",
    softText: "#1d4ed8",
  },
  {
    bar: "#f59e0b",
    line: "#d97706",
    dot: "#fbbf24",
    softBorder: "#fde68a",
    softBackground: "#fffbeb",
    softText: "#b45309",
  },
  {
    bar: "#ec4899",
    line: "#be185d",
    dot: "#f472b6",
    softBorder: "#fbcfe8",
    softBackground: "#fdf2f8",
    softText: "#be185d",
  },
  {
    bar: "#8b5cf6",
    line: "#6d28d9",
    dot: "#a78bfa",
    softBorder: "#ddd6fe",
    softBackground: "#f5f3ff",
    softText: "#6d28d9",
  },
] as const;

function getChartPalette(exerciseName: string): (typeof chartPalettes)[number] {
  const hash = Array.from(exerciseName).reduce(
    (currentHash, character) => currentHash + character.charCodeAt(0),
    0,
  );
  return chartPalettes[hash % chartPalettes.length] ?? chartPalettes[0];
}

export function ExerciseStatisticsChart({ series }: ExerciseStatisticsChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const chartFrameRef = useRef<HTMLDivElement>(null);
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip | null>(null);
  const [showBars, setShowBars] = useState(true);
  const [showLine, setShowLine] = useState(true);
  const palette = getChartPalette(series.exerciseName);
  const dayCount = series.days.length;
  const innerWidthPercent = Math.max(1, dayCount / 7) * 100;
  const linePoints = series.days
    .map((day, index) => {
      const x = ((index + 0.5) / dayCount) * 100;
      const y = 100 - day.completionPercentage;
      return `${x},${y}`;
    })
    .join(" ");
  const activeDay = activeTooltip
    ? series.days.find((day) => day.date === activeTooltip.date) ?? null
    : null;

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    container.scrollLeft = 0;
  }, [series.exerciseName, dayCount]);

  useEffect(() => {
    setActiveTooltip(null);
  }, [series.exerciseName, dayCount]);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{series.exerciseName}</h2>
          <p className="mt-1 text-sm text-gray-600">
            {formatDateLabel(series.startDate)} – {formatDateLabel(series.endDate)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowBars((current) => !current)}
            aria-pressed={showBars}
            className="rounded-full border px-3 py-1 text-sm font-medium transition"
            style={
              showBars
                ? {
                    borderColor: palette.softBorder,
                    backgroundColor: palette.softBackground,
                    color: palette.softText,
                  }
                : undefined
            }
          >
            תרגילים שנעשו
          </button>
          <button
            type="button"
            onClick={() => setShowLine((current) => !current)}
            aria-pressed={showLine}
            className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
              showLine
                ? "border-gray-300 bg-gray-900 text-white"
                : "border-gray-200 bg-white text-gray-600"
            }`}
          >
            קו מגמה
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <div className="flex h-56 w-12 shrink-0 flex-col justify-between pb-7 text-xs text-gray-500">
          {yAxisTicks.map((tick) => (
            <span key={tick}>{tick}%</span>
          ))}
        </div>

        <div ref={chartFrameRef} className="relative min-w-0 flex-1">
          {activeDay && activeTooltip && (
            <div
              className="pointer-events-none absolute top-2 z-20 w-52 max-w-[calc(100%-0.5rem)] -translate-x-1/2 rounded-2xl bg-gray-900/90 px-4 py-3 text-right text-xs text-white shadow-xl"
              style={{ left: `${activeTooltip.left}px` }}
            >
              <p className="text-sm font-semibold">{formatDateLabel(activeDay.date)}</p>
              <p className="mt-2">
                חזרות שנעשו: <span className="font-semibold">{activeDay.completedReps}</span>
              </p>
              <p>
                יעד יומי: <span className="font-semibold">{activeDay.plannedReps}</span>
              </p>
            </div>
          )}

          <div
            ref={scrollRef}
            dir="rtl"
            className="min-w-0 overflow-x-auto"
            onClick={() => setActiveTooltip(null)}
            onScroll={() => setActiveTooltip(null)}
          >
            <div
              className="relative flex h-56 flex-row-reverse"
              style={{ width: `${innerWidthPercent}%` }}
            >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-48 border-b border-r border-gray-300 bg-gray-50">
              <div className="flex h-full flex-col justify-between">
                {yAxisTicks.map((tick) => (
                  <div
                    key={tick}
                    className="border-t border-dashed border-gray-300"
                    aria-hidden="true"
                  />
                ))}
              </div>
            </div>

            <div className="pointer-events-none absolute inset-y-0 right-0 top-0 flex h-48 w-full flex-row-reverse">
              {series.days.map((day) => (
                <div
                  key={day.date}
                  className="h-full border-l border-gray-300"
                  style={{ flex: `0 0 ${100 / dayCount}%` }}
                  aria-hidden="true"
                />
              ))}
            </div>

            {showLine && (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-48">
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="h-full w-full overflow-visible"
                  aria-hidden="true"
                >
                  <polyline
                    points={linePoints}
                    fill="none"
                    stroke={palette.line}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </div>
            )}

            {series.days.map((day) => (
              <div
                key={day.date}
                className="relative z-20 flex h-full flex-col items-center"
                style={{ flex: `0 0 ${100 / dayCount}%` }}
              >
                <div className="flex h-48 w-full items-end justify-center px-1">
                  <button
                    type="button"
                    className="flex h-full w-full items-end justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    style={
                      activeTooltip?.date === day.date
                        ? { ["--tw-ring-color" as string]: palette.line }
                        : { ["--tw-ring-color" as string]: palette.line }
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      const chartFrame = chartFrameRef.current;
                      if (!chartFrame) {
                        return;
                      }

                      const buttonRect = event.currentTarget.getBoundingClientRect();
                      const frameRect = chartFrame.getBoundingClientRect();
                      const nextLeft = Math.min(
                        Math.max(buttonRect.left - frameRect.left + buttonRect.width / 2, 104),
                        frameRect.width - 104,
                      );

                      setActiveTooltip((currentTooltip) =>
                        currentTooltip?.date === day.date
                          ? null
                          : { date: day.date, left: nextLeft },
                      );
                    }}
                    aria-expanded={activeTooltip?.date === day.date}
                    aria-label={`${formatDateLabel(day.date)}: ${day.completedReps} מתוך ${day.plannedReps}`}
                  >
                    <div
                      className="relative w-full max-w-10"
                      style={{ height: `${day.completionPercentage}%` }}
                    >
                      {showLine && (
                        <div
                          className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
                          style={{ backgroundColor: palette.dot }}
                        />
                      )}
                      {showBars && (
                        <div
                          className="h-full w-full rounded-t"
                          style={{ backgroundColor: palette.bar }}
                        />
                      )}
                    </div>
                  </button>
                </div>

                <span className="mt-2 w-full px-1 text-center text-[10px] text-gray-600">
                  {formatDateLabel(day.date)}
                </span>
              </div>
            ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
