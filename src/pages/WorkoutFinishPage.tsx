import { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { WorkoutStopwatch } from "~/components/WorkoutStopwatch";
import { apiFetch } from "~/lib/api";
import {
  getZodErrorMessage,
  workoutFinishRouteParamsSchema,
  workoutLocationStateSchema,
} from "~/lib/validation";

interface SliderQuestionProps {
  label: string;
  value: number | null;
  onChange: (nextValue: number) => void;
}

function SliderQuestion({ label, value, onChange }: SliderQuestionProps) {
  const [isInteracting, setIsInteracting] = useState(false);
  const displayedValue = value ?? 0;
  const bubblePositionPercent = ((10 - displayedValue) / 10  - ((5 - displayedValue) / 300)) * 100;

  return (
    <section className="mt-8">
      <p className="text-right text-3xl font-semibold text-gray-900">{label}</p>

      <div className="mt-3 flex items-center gap-4" dir="ltr">
        <span className="shrink-0 text-4xl font-semibold text-gray-900">10</span>

        <div className="relative flex h-10 flex-1 items-center">
          {isInteracting && (
            <div
              className="pointer-events-none absolute bottom-full -translate-x-1/2 rounded-full bg-blue-500 px-3 py-1 text-lg font-bold text-white shadow-md"
              style={{ left: `${bubblePositionPercent}%` }}
            >
              {displayedValue}
            </div>
          )}

          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={displayedValue}
            onChange={(event) => {
              onChange(Number(event.target.value));
            }}
            onPointerDown={() => {
              setIsInteracting(true);
            }}
            onPointerUp={() => {
              setIsInteracting(false);
            }}
            onPointerCancel={() => {
              setIsInteracting(false);
            }}
            onFocus={() => {
              setIsInteracting(true);
            }}
            onBlur={() => {
              setIsInteracting(false);
            }}
            className="h-2 w-full cursor-pointer accent-blue-500"
            style={{ direction: "rtl" }}
          />
        </div>

        <span className="shrink-0 text-4xl font-semibold text-gray-900">0</span>
      </div>
    </section>
  );
}

export function WorkoutFinishPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { prescribedExerciseId, performedRepId } = useParams<{
    prescribedExerciseId: string;
    performedRepId: string;
  }>();
  const location = useLocation();
  const fallbackEndTimestampRef = useRef<number>(Date.now());
  const [dizziness, setDizziness] = useState<number | null>(null);
  const [nausea, setNausea] = useState<number | null>(null);
  const [generalDifficulty, setGeneralDifficulty] = useState<number | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationStateResult = workoutLocationStateSchema.safeParse(
    location.state,
  );
  const locationState = locationStateResult.success
    ? locationStateResult.data
    : null;
  const workoutEndTimestampMs =
    locationState?.workoutEndTimestampMs ??
    locationState?.workoutStartTimestampMs ??
    fallbackEndTimestampRef.current;

  const routeParamsResult = useMemo(
    () =>
      workoutFinishRouteParamsSchema.safeParse({
        prescribedExerciseId,
        performedRepId,
      }),
    [performedRepId, prescribedExerciseId],
  );
  const parsedPrescribedExerciseId = routeParamsResult.success
    ? routeParamsResult.data.prescribedExerciseId
    : null;
  const parsedPerformedRepId = routeParamsResult.success
    ? routeParamsResult.data.performedRepId
    : null;
  const requestedPracticeTimeKey = searchParams.get("practiceTimeKey");

  const canContinue = useMemo(
    () =>
      dizziness !== null &&
      nausea !== null &&
      generalDifficulty !== null &&
      !isSubmitting,
    [dizziness, generalDifficulty, isSubmitting, nausea],
  );

  async function handleContinue() {
    if (!canContinue) return;

    if (parsedPrescribedExerciseId === null || parsedPerformedRepId === null) {
      const errorMessage = routeParamsResult.success
        ? "נתוני האימון אינם תקינים."
        : getZodErrorMessage(
            routeParamsResult.error,
            "נתוני האימון אינם תקינים.",
          );
      setError(errorMessage);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await apiFetch("/api/performed-reps", {
        method: "PATCH",
        body: JSON.stringify({
          performedRepId: parsedPerformedRepId,
          dizziness,
          nausea,
          general_difficulty: generalDifficulty,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update performed rep record");
      }

      const nextUrl =
        requestedPracticeTimeKey === null
          ? `/workout-rest/${parsedPrescribedExerciseId}/${parsedPerformedRepId}`
          : `/workout-rest/${parsedPrescribedExerciseId}/${parsedPerformedRepId}?practiceTimeKey=${encodeURIComponent(requestedPracticeTimeKey)}`;
      await navigate(nextUrl, {
        state: {
          workoutEndTimestampMs,
        },
      });
    } catch (submitError) {
      console.error("Error updating finish questionnaire:", submitError);
      setError("שמירת התשובות נכשלה. נא לנסות שוב.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-4xl bg-white px-4 py-8 sm:px-5"
    >
      <WorkoutStopwatch
        startTimestampMs={workoutEndTimestampMs}
        prefixText="הזמן שחלף מרגע סיום התרגול:"
      />

      <h1 className="mt-6 text-center text-5xl font-extrabold text-gray-900">
        כל הכבוד! תרגול נהדר! זכית ב 10 נקודות!
      </h1>

      <p className="mt-6 text-center text-2xl font-semibold text-gray-900">
        אשמח לדעת איך הרגשת עכשיו כדי להתאים עבורך את התרגול הבא.
      </p>

      <p className="mt-2 text-center text-2xl font-semibold text-gray-900">
        דרגו מ-0 עד 10 (0-לא קשה בכלל, 10- הכי קשה):
      </p>

      <SliderQuestion
        label="תחושת סחרחורת"
        value={dizziness}
        onChange={setDizziness}
      />

      <SliderQuestion label="תחושת בחילה" value={nausea} onChange={setNausea} />

      <SliderQuestion
        label="קושי כללי בתרגול"
        value={generalDifficulty}
        onChange={setGeneralDifficulty}
      />

      {error && (
        <p className="mt-6 rounded-md bg-red-50 p-3 text-center text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-12 flex justify-center">
        <button
          type="button"
          onClick={() => {
            void handleContinue();
          }}
          disabled={!canContinue}
          className="rounded-lg bg-emerald-300 px-14 py-4 text-4xl font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          המשך
        </button>
      </div>
    </main>
  );
}
