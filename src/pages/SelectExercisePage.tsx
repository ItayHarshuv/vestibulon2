import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "~/auth/AuthProvider";
import { apiFetch } from "~/lib/api";
import { getZodErrorMessage, todayRepsResponseSchema } from "~/lib/validation";

interface Program {
  id: number;
  exerciseName: string;
  numberOfSeconds: number;
  numberOfRepetions: number;
  position: string;
  background: string;
  recomendedVAS: number;
}

interface TodayRepRow {
  id: number;
  practiceTime: string;
  exerciseName: string;
  repId: number | null;
}

function getPracticeTimeKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}-${String(date.getHours()).padStart(2, "0")}-${String(date.getMinutes()).padStart(2, "0")}`;
}

function isPracticeTimeKey(value: string | null): value is string {
  return value !== null && /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/.test(value);
}

function formatPracticeTime(date: Date) {
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function SelectExercisePage() {
  const { isLoading, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [todayReps, setTodayReps] = useState<TodayRepRow[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestedPracticeTimeKey = useMemo(() => {
    const practiceTimeKey = searchParams.get("practiceTimeKey");
    return isPracticeTimeKey(practiceTimeKey) ? practiceTimeKey : null;
  }, [searchParams]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      setPrograms([]);
      setTodayReps([]);
      setLoading(false);
      return;
    }

    async function fetchPageData() {
      try {
        setLoading(true);
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

        const programsData = (await programsResponse.json()) as Program[];
        const todayRepsResult = todayRepsResponseSchema.safeParse(await todayRepsResponse.json());

        if (!todayRepsResult.success) {
          throw new Error(
            getZodErrorMessage(todayRepsResult.error, "Invalid today's reps response"),
          );
        }

        setPrograms(programsData);
        setTodayReps(todayRepsResult.data);
      } catch (err) {
        setPrograms([]);
        setTodayReps([]);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    void fetchPageData();
  }, [isLoading, user]);

  const selectedProgram = useMemo(
    () => programs.find((program) => program.id === selectedProgramId) ?? null,
    [programs, selectedProgramId],
  );

  const currentSessionPracticeTimeKey = useMemo(() => {
    const now = new Date();
    const scheduledRows = todayReps.map((row) => ({
      ...row,
      practiceDate: new Date(row.practiceTime),
    }));
    const pastOrCurrentRows = scheduledRows.filter((row) => row.practiceDate <= now);
    const latestScheduledRow = pastOrCurrentRows[pastOrCurrentRows.length - 1];
    const latestDuePracticeTimeKey = latestScheduledRow
      ? getPracticeTimeKey(latestScheduledRow.practiceDate)
      : null;

    if (latestDuePracticeTimeKey) {
      const latestDuePendingRow = scheduledRows.find(
        (row) =>
          getPracticeTimeKey(row.practiceDate) === latestDuePracticeTimeKey && row.repId === null,
      );

      if (latestDuePendingRow) {
        return latestDuePracticeTimeKey;
      }
    }

    const nextPendingRow = scheduledRows.find((row) => row.practiceDate > now && row.repId === null);
    return nextPendingRow ? getPracticeTimeKey(nextPendingRow.practiceDate) : null;
  }, [todayReps]);

  const selectedSessionPracticeTimeKey = requestedPracticeTimeKey ?? currentSessionPracticeTimeKey;

  const selectedSessionPracticeDate = useMemo(() => {
    if (selectedSessionPracticeTimeKey === null) {
      return null;
    }

    const matchingRow = todayReps.find(
      (row) =>
        getPracticeTimeKey(new Date(row.practiceTime)) === selectedSessionPracticeTimeKey,
    );

    return matchingRow ? new Date(matchingRow.practiceTime) : null;
  }, [selectedSessionPracticeTimeKey, todayReps]);

  const completedSessionRepsByExercise = useMemo(() => {
    if (selectedSessionPracticeTimeKey === null) {
      return {};
    }

    return todayReps.reduce<Record<string, number>>((acc, row) => {
      if (
        getPracticeTimeKey(new Date(row.practiceTime)) !== selectedSessionPracticeTimeKey ||
        row.repId === null
      ) {
        return acc;
      }

      acc[row.exerciseName] = (acc[row.exerciseName] ?? 0) + 1;
      return acc;
    }, {});
  }, [selectedSessionPracticeTimeKey, todayReps]);

  const hasPendingTodayReps = useMemo(
    () => todayReps.some((row) => row.repId === null),
    [todayReps],
  );

  const hasPendingSelectedSessionReps = useMemo(() => {
    if (selectedSessionPracticeTimeKey === null) {
      return false;
    }

    return todayReps.some(
      (row) =>
        getPracticeTimeKey(new Date(row.practiceTime)) === selectedSessionPracticeTimeKey &&
        row.repId === null,
    );
  }, [selectedSessionPracticeTimeKey, todayReps]);

  return (
    <main
      dir="rtl"
      className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-2xl bg-white px-6 py-8"
    >
      <h1 className="text-center text-3xl font-bold text-gray-900">
        תרגילים לביצוע - אנא בחר תרגיל
      </h1>

      {selectedSessionPracticeDate && (
        <p className="mt-4 text-center text-lg font-semibold text-gray-700">
          {requestedPracticeTimeKey === null
            ? `התרגול הנוכחי לשעה ${formatPracticeTime(selectedSessionPracticeDate)}`
            : `השלמת תרגול קודם מהשעה ${formatPracticeTime(selectedSessionPracticeDate)}`}
        </p>
      )}

      {loading && <p className="mt-8 text-center text-gray-600">טוען תרגילים...</p>}

      {error && !loading && (
        <p className="mt-8 rounded-md bg-red-50 p-3 text-center text-sm text-red-700">
          אירעה שגיאה בטעינת התרגילים: {error}
        </p>
      )}

      {!loading && !error && programs.length === 0 && (
        <p className="mt-8 text-center text-gray-600">
          לא נמצאו תרגילים בתוכנית עבור המשתמש הנוכחי.
        </p>
      )}

      {!loading &&
        !error &&
        programs.length > 0 &&
        selectedSessionPracticeTimeKey !== null &&
        !hasPendingSelectedSessionReps && (
          <p className="mt-8 text-center text-gray-600">
            כל התרגילים בתרגול זה כבר הושלמו.
          </p>
        )}

      {!loading &&
        !error &&
        programs.length > 0 &&
        (requestedPracticeTimeKey === null || hasPendingSelectedSessionReps) && (
        <div className="mt-8 space-y-6">
          {programs.map((program) => {
            const total = program.numberOfRepetions;
            const completed =
              selectedSessionPracticeTimeKey === null
                ? hasPendingTodayReps
                  ? 0
                  : total
                : completedSessionRepsByExercise[program.exerciseName] ?? 0;
            const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
            const isComplete = total > 0 && completed === total;

            return (
              <label
                key={program.id}
                className={`block border-b border-gray-200 pb-6 ${
                  isComplete ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                }`}
              >
                <div className="flex items-start gap-4">
                  <input
                    type="radio"
                    name="exercise"
                    checked={selectedProgramId === program.id}
                    onChange={() => {
                      if (isComplete) return;
                      setSelectedProgramId(program.id);
                    }}
                    disabled={isComplete}
                    className="mt-2 h-6 w-6 accent-gray-500 disabled:cursor-not-allowed disabled:opacity-40"
                  />

                  <div className="flex-1">
                    <div className="flex items-center justify-between text-lg font-semibold text-gray-900">
                      <span>{program.exerciseName}</span>
                      <span className="text-gray-800">
                        בוצע {completed} מתוך {total}
                      </span>
                    </div>

                    <div className="relative mt-4 h-10 overflow-hidden rounded-sm border border-gray-500 bg-gray-100">
                      <div
                        className="h-full bg-emerald-400 transition-[width] duration-300"
                        style={{ width: `${completionPercent}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-gray-900">
                        {completionPercent}%
                      </div>
                    </div>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}

      <div className="mt-10 flex justify-center">
        <button
          type="button"
          disabled={!selectedProgram}
          onClick={() => {
            if (!selectedProgram) return;
            const nextUrl =
              requestedPracticeTimeKey === null
                ? `/exercise-description/${selectedProgram.id}`
                : `/exercise-description/${selectedProgram.id}?practiceTimeKey=${encodeURIComponent(requestedPracticeTimeKey)}`;
            void navigate(nextUrl);
          }}
          className="rounded-lg bg-emerald-300 px-10 py-4 text-4xl font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          אישור
        </button>
      </div>
    </main>
  );
}
