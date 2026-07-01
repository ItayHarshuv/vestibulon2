import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { WorkoutStopwatch } from "~/components/WorkoutStopwatch";
import { apiFetch } from "~/lib/api";
import {
  getZodErrorMessage,
  prescribedExercisesResponseSchema,
  performedRepsResponseSchema,
  todayRepsResponseSchema,
  workoutFinishRouteParamsSchema,
  workoutLocationStateSchema,
} from "~/lib/validation";

function getPracticeTimeKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}-${String(date.getHours()).padStart(2, "0")}-${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatElapsedDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

interface RestTimeEntry {
  label: string;
  elapsedSeconds: number | null;
  liveStartTimestampMs: number | null;
}

export function WorkoutRestPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { prescribedExerciseId, performedRepId } = useParams<{
    prescribedExerciseId: string;
    performedRepId: string;
  }>();
  const location = useLocation();
  const fallbackEndTimestampRef = useRef<number>(Date.now());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [isLastRepInExercise, setIsLastRepInExercise] = useState(false);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [restTimeEntries, setRestTimeEntries] = useState<RestTimeEntry[]>([]);
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
  const selectExerciseUrl =
    requestedPracticeTimeKey === null
      ? "/select-exercise"
      : `/select-exercise?practiceTimeKey=${encodeURIComponent(requestedPracticeTimeKey)}`;

  useEffect(() => {
    const hasLiveEntry = restTimeEntries.some(
      (entry) => entry.liveStartTimestampMs !== null,
    );
    if (!hasLiveEntry) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [restTimeEntries]);

  useEffect(() => {
    if (parsedPrescribedExerciseId === null || parsedPerformedRepId === null) {
      setIsLoading(false);
      setRestTimeEntries([]);
      setIsSessionComplete(false);
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
        setIsLastRepInExercise(false);
        setIsSessionComplete(false);
        setRestTimeEntries([]);
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const [prescribedExercisesResponse, todayRepsResponse] = await Promise.all([
          apiFetch("/api/prescribed-exercises"),
          apiFetch(`/api/today-reps?timeZone=${encodeURIComponent(timeZone)}`),
        ]);

        if (!prescribedExercisesResponse.ok) {
          throw new Error("Failed to fetch prescribed exercises");
        }

        if (!todayRepsResponse.ok) {
          throw new Error("Failed to fetch today's reps");
        }

        const prescribedExercisesResult = prescribedExercisesResponseSchema.safeParse(
          await prescribedExercisesResponse.json(),
        );
        const todayRepsResult = todayRepsResponseSchema.safeParse(
          await todayRepsResponse.json(),
        );

        if (!prescribedExercisesResult.success) {
          throw new Error(
            getZodErrorMessage(prescribedExercisesResult.error, "Invalid prescribed exercises response"),
          );
        }

        if (!todayRepsResult.success) {
          throw new Error(
            getZodErrorMessage(todayRepsResult.error, "Invalid today's reps response"),
          );
        }

        const currentPrescribedExercise =
          prescribedExercisesResult.data.find((prescribedExercise) => prescribedExercise.id === parsedPrescribedExerciseId) ?? null;

        if (!currentPrescribedExercise) {
          throw new Error("Prescribed exercise not found");
        }

        const currentPerformedRepRow = todayRepsResult.data.find(
          (row) => row.performedRepId === parsedPerformedRepId,
        );
        if (!currentPerformedRepRow) {
          throw new Error("Completed performed rep slot not found");
        }

        const currentSessionPracticeTimeKey = getPracticeTimeKey(
          new Date(currentPerformedRepRow.practiceTime),
        );
        const currentSessionRows = todayRepsResult.data.filter(
          (row) =>
            getPracticeTimeKey(new Date(row.practiceTime)) === currentSessionPracticeTimeKey,
        );
        const completedCurrentExerciseRows = currentSessionRows.filter(
          (row) =>
            row.exerciseName === currentPrescribedExercise.exerciseName &&
            row.performedRepId !== null,
        );
        const completedCurrentExerciseReps = completedCurrentExerciseRows.length;
        const lastRepInExercise =
          completedCurrentExerciseReps >= currentPrescribedExercise.numberOfRepetions;

        setIsLastRepInExercise(lastRepInExercise);
        setIsSessionComplete(
          lastRepInExercise &&
            currentSessionRows.every((row) => row.performedRepId !== null),
        );

        if (!lastRepInExercise) {
          setRestTimeEntries([]);
          return;
        }

        const completedPerformedRepIds = completedCurrentExerciseRows
          .map((row) => row.performedRepId)
          .filter((candidateId): candidateId is number => candidateId !== null);

        if (completedPerformedRepIds.length === 0) {
          setRestTimeEntries([]);
          return;
        }

        const performedRepsResponse = await apiFetch(
          `/api/performed-reps?ids=${encodeURIComponent(completedPerformedRepIds.join(","))}`,
        );
        if (!performedRepsResponse.ok) {
          throw new Error("Failed to fetch performed rep summaries");
        }

        const performedRepsResult = performedRepsResponseSchema.safeParse(
          await performedRepsResponse.json(),
        );
        if (!performedRepsResult.success) {
          throw new Error(
            getZodErrorMessage(performedRepsResult.error, "Invalid performed reps response"),
          );
        }

        const performedRepById = new Map(
          performedRepsResult.data.map((performedRep) => [performedRep.id, performedRep]),
        );
        const orderedCompletedPerformedReps = completedPerformedRepIds.flatMap(
          (candidateId) => {
            const performedRep = performedRepById.get(candidateId);
            return performedRep ? [performedRep] : [];
          },
        );

        const nextRestTimeEntries = orderedCompletedPerformedReps.map(
          (performedRep, index) => {
            const label = `תרגיל ${index + 1}`;
            const nextPerformedRep =
              orderedCompletedPerformedReps[index + 1] ?? null;
            const performedRepEndTimestampMs = performedRep.endTime
              ? Date.parse(performedRep.endTime)
              : Number.NaN;

            if (!nextPerformedRep) {
              return {
                label,
                elapsedSeconds: null,
                liveStartTimestampMs: Number.isNaN(performedRepEndTimestampMs)
                  ? workoutEndTimestampMs
                  : performedRepEndTimestampMs,
              };
            }

            const nextPerformedRepStartTimestampMs = Date.parse(
              nextPerformedRep.startTime,
            );
            if (
              Number.isNaN(performedRepEndTimestampMs) ||
              Number.isNaN(nextPerformedRepStartTimestampMs)
            ) {
              return {
                label,
                elapsedSeconds: null,
                liveStartTimestampMs: null,
              };
            }

            return {
              label,
              elapsedSeconds: Math.max(
                0,
                Math.floor(
                  (nextPerformedRepStartTimestampMs - performedRepEndTimestampMs) / 1000,
                ),
              ),
              liveStartTimestampMs: null,
            };
          },
        );

        setRestTimeEntries(nextRestTimeEntries);
      } catch (fetchError) {
        console.error("Error loading workout rest state:", fetchError);
        setRestTimeEntries([]);
        setIsSessionComplete(false);
        setError("לא ניתן לטעון את פרטי המנוחה כעת.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [
    parsedPerformedRepId,
    parsedPrescribedExerciseId,
    routeParamsResult,
    workoutEndTimestampMs,
  ]);

  const primaryButtonLabel = isLastRepInExercise
    ? isSessionComplete
      ? "התאוששתי"
      : "התאוששתי, נמשיך לתרגיל הבא!"
    : "התאוששתי, נמשיך להשלמת התרגול";
  const shouldShowRestTimeline =
    isLastRepInExercise && !isLoading && !error && restTimeEntries.length > 0;

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
          {shouldShowRestTimeline ? (
            <div className="space-y-3 text-center text-2xl font-semibold text-gray-900">
              <p>הזמן שחלף מסיום התרגול:</p>
              {restTimeEntries.map((entry) => {
                const elapsedDisplay =
                  entry.liveStartTimestampMs !== null
                    ? formatElapsedDuration(
                        Math.max(
                          0,
                          Math.floor((nowMs - entry.liveStartTimestampMs) / 1000),
                        ),
                      )
                    : entry.elapsedSeconds !== null
                      ? formatElapsedDuration(entry.elapsedSeconds)
                      : "--:--";

                return (
                  <p key={entry.label}>
                    {entry.label}: {elapsedDisplay} דקות
                  </p>
                );
              })}
            </div>
          ) : (
            <WorkoutStopwatch
              startTimestampMs={workoutEndTimestampMs}
              prefixText="הזמן שחלף מסיום התרגול:"
            />
          )}
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
              if (parsedPrescribedExerciseId === null) return;
              void navigate(
                isLastRepInExercise
                  ? isSessionComplete
                    ? "/session-complete"
                    : selectExerciseUrl
                  : requestedPracticeTimeKey === null
                    ? `/workout/${parsedPrescribedExerciseId}`
                    : `/workout/${parsedPrescribedExerciseId}?practiceTimeKey=${encodeURIComponent(requestedPracticeTimeKey)}`,
              );
            }}
            disabled={isLoading || parsedPrescribedExerciseId === null || error !== null}
            className="w-full rounded-lg bg-emerald-400 px-6 py-6 text-2xl font-extrabold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 sm:text-4xl"
          >
            {primaryButtonLabel}
          </button>

          {!isLastRepInExercise && !isLoading && !error && (
            <button
              type="button"
              onClick={() => {
                void navigate(selectExerciseUrl);
              }}
              className="w-full rounded-lg border-4 border-blue-500 bg-white px-6 py-6 text-2xl font-extrabold text-gray-900 transition hover:bg-blue-50 sm:text-4xl"
            >
              אני רוצה לעבור לתרגיל אחר
            </button>
          )}

          {!isSessionComplete && (
            <button
              type="button"
              onClick={() => {
                void navigate("/");
              }}
              className="w-full rounded-lg border-4 border-blue-500 bg-white px-6 py-6 text-2xl font-extrabold text-gray-900 transition hover:bg-blue-50 sm:text-4xl"
            >
              אין ביכולתי להמשיך כעת, אשלים את התרגול בהמשך
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
