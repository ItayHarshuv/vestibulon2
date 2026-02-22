import { useRef } from "react";
import { useLocation } from "react-router-dom";
import { WorkoutStopwatch } from "~/components/WorkoutStopwatch";

export function WorkoutRestPage() {
  const location = useLocation();
  const fallbackStartTimestampRef = useRef<number>(Date.now());

  const locationState = location.state as { workoutStartTimestampMs?: number } | null;
  const workoutStartTimestampMs =
    typeof locationState?.workoutStartTimestampMs === "number"
      ? locationState.workoutStartTimestampMs
      : fallbackStartTimestampRef.current;

  return (
    <main
      dir="rtl"
      className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-4xl bg-white px-4 py-8 sm:px-5"
    >
      <WorkoutStopwatch
        startTimestampMs={workoutStartTimestampMs}
        prefixText="הזמן שחלף מרגע סיום התרגול:"
      />

      <h1 className="mt-12 text-center text-5xl font-extrabold text-gray-900">זמן מנוחה</h1>

      <p className="mt-6 text-center text-2xl font-semibold text-gray-900">
        נחים רגע לפני החזרה הבאה.
      </p>
    </main>
  );
}
