import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

export function SelectExercisePage() {
  const { isLoading, user } = useAuth();
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [todayReps, setTodayReps] = useState<TodayRepRow[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const todayProgressByExercise = useMemo(() => {
    return todayReps.reduce<Record<string, { completed: number; total: number }>>((acc, row) => {
      const current = acc[row.exerciseName] ?? { completed: 0, total: 0 };
      current.total += 1;
      if (row.repId !== null) {
        current.completed += 1;
      }
      acc[row.exerciseName] = current;
      return acc;
    }, {});
  }, [todayReps]);

  return (
    <main
      dir="rtl"
      className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-2xl bg-white px-6 py-8"
    >
      <h1 className="text-center text-3xl font-bold text-gray-900">
        תרגילים לביצוע - אנא בחר תרגיל
      </h1>

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

      {!loading && !error && programs.length > 0 && (
        <div className="mt-8 space-y-6">
          {programs.map((program) => {
            const progress = todayProgressByExercise[program.exerciseName] ?? {
              completed: 0,
              total: 0,
            };
            const completionPercent =
              progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
            const isComplete = progress.total > 0 && progress.completed === progress.total;

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
                        בוצע {progress.completed} מתוך {progress.total}
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
            void navigate(`/exercise-description/${selectedProgram.id}`);
          }}
          className="rounded-lg bg-emerald-300 px-10 py-4 text-4xl font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          אישור
        </button>
      </div>
    </main>
  );
}
