import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { WorkoutStopwatch } from "~/components/WorkoutStopwatch";
import { apiFetch } from "~/lib/api";
import {
  getZodErrorMessage,
  programsResponseSchema,
  todayRepsResponseSchema,
  workoutFinishRouteParamsSchema,
  workoutLocationStateSchema,
} from "~/lib/validation";

export function WorkoutRestPage() {
  const navigate = useNavigate();
  const { programId, repId } = useParams<{
    programId: string;
    repId: string;
  }>();
  const location = useLocation();
  const fallbackStartTimestampRef = useRef<number>(Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [isLastRepInExercise, setIsLastRepInExercise] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationStateResult = workoutLocationStateSchema.safeParse(
    location.state,
  );
  const locationState = locationStateResult.success
    ? locationStateResult.data
    : null;
  const workoutStartTimestampMs =
    locationState?.workoutStartTimestampMs ?? fallbackStartTimestampRef.current;
  const routeParamsResult = useMemo(
    () => workoutFinishRouteParamsSchema.safeParse({ programId, repId }),
    [programId, repId],
  );
  const parsedProgramId = routeParamsResult.success
    ? routeParamsResult.data.programId
    : null;

  useEffect(() => {
    if (parsedProgramId === null) {
      setIsLoading(false);
      setError(
        routeParamsResult.success
          ? "נתוני התרגול אינם תקינים."
          : getZodErrorMessage(routeParamsResult.error, "נתוני התרגול אינם תקינים."),
      );
      return;
    }

    void (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const [programsResponse, todayRepsResponse] = await Promise.all([
          apiFetch("/api/programs"),
          apiFetch(`/api/today-reps?timeZone=${encodeURIComponent(timeZone)}`),
        ]);

        if (!programsResponse.ok) {
          throw new Error("Failed to fetch programs");
        }

        if (!todayRepsResponse.ok) {
          throw new Error("Failed to fetch today's reps");
        }

        const programsResult = programsResponseSchema.safeParse(
          await programsResponse.json(),
        );
        const todayRepsResult = todayRepsResponseSchema.safeParse(
          await todayRepsResponse.json(),
        );

        if (!programsResult.success) {
          throw new Error(
            getZodErrorMessage(programsResult.error, "Invalid programs response"),
          );
        }

        if (!todayRepsResult.success) {
          throw new Error(
            getZodErrorMessage(todayRepsResult.error, "Invalid today's reps response"),
          );
        }

        const currentProgram =
          programsResult.data.find((program) => program.id === parsedProgramId) ?? null;

        if (!currentProgram) {
          throw new Error("Program not found");
        }

        const completedCurrentExerciseReps = todayRepsResult.data.filter(
          (row) =>
            row.exerciseName === currentProgram.exerciseName && row.repId !== null,
        ).length;

        setIsLastRepInExercise(
          completedCurrentExerciseReps >= currentProgram.numberOfRepetions,
        );
      } catch (fetchError) {
        console.error("Error loading workout rest state:", fetchError);
        setError("לא ניתן לטעון את פרטי המנוחה כעת.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [parsedProgramId, routeParamsResult]);

  const primaryButtonLabel = isLastRepInExercise
    ? "התאוששתי, נמשיך לתרגיל הבא!"
    : "התאוששתי, נמשיך להשלמת התרגול";

  return (
    <main
      dir="rtl"
      className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-4xl bg-white px-4 py-8 sm:px-5"
    >
      <div className="mx-auto max-w-3xl">
        {isLastRepInExercise && !isLoading && !error && (
          <h1 className="text-center text-3xl font-extrabold text-gray-900 sm:text-5xl">
            נהדר השלמת תרגיל שלם! זכית ב 100 נקודות!
          </h1>
        )}

        <div className={isLastRepInExercise && !isLoading && !error ? "mt-4" : ""}>
          <WorkoutStopwatch
            startTimestampMs={workoutStartTimestampMs}
            prefixText="הזמן שחלף מרגע סיום התרגול:"
          />
        </div>

        <h2 className="mt-8 text-center text-4xl font-extrabold text-gray-900 sm:text-6xl">
          מגיע לך זמן להתאושש
        </h2>

        {error && (
          <p className="mt-6 rounded-md bg-red-50 p-3 text-center text-sm text-red-700">
            {error}
          </p>
        )}

        {isLoading && !error && (
          <p className="mt-6 text-center text-lg text-gray-600">טוען...</p>
        )}

        <div className="mt-10 space-y-6">
          <button
            type="button"
            onClick={() => {
              if (parsedProgramId === null) return;
              void navigate(
                isLastRepInExercise
                  ? "/select-exercise"
                  : `/workout/${parsedProgramId}`,
              );
            }}
            disabled={isLoading || parsedProgramId === null || error !== null}
            className="w-full rounded-lg bg-emerald-400 px-6 py-6 text-2xl font-extrabold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 sm:text-4xl"
          >
            {primaryButtonLabel}
          </button>

          {!isLastRepInExercise && !isLoading && !error && (
            <button
              type="button"
              onClick={() => {
                void navigate("/select-exercise");
              }}
              className="w-full rounded-lg border-4 border-blue-500 bg-white px-6 py-6 text-2xl font-extrabold text-gray-900 transition hover:bg-blue-50 sm:text-4xl"
            >
              אני רוצה לעבור לתרגיל אחר
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              void navigate("/");
            }}
            className="w-full rounded-lg border-4 border-blue-500 bg-white px-6 py-6 text-2xl font-extrabold text-gray-900 transition hover:bg-blue-50 sm:text-4xl"
          >
            אין ביכולתי להמשיך כעת, אשלים את התרגול בהמשך
          </button>
        </div>
      </div>
    </main>
  );
}
