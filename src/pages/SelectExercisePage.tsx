import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { getApiUrl } from "~/lib/api";

interface Program {
  id: number;
  exerciseName: string;
  numberOfRepetions: number;
}

export function SelectExercisePage() {
  const { user, isLoaded } = useUser();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id;

  useEffect(() => {
    if (!isLoaded) return;
    if (!userId) {
      setPrograms([]);
      setLoading(false);
      return;
    }
    const currentUserId = userId;

    async function fetchPrograms() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          getApiUrl(`/api/programs?userId=${encodeURIComponent(currentUserId)}`),
        );

        if (!response.ok) {
          throw new Error("Failed to fetch programs");
        }

        const data = (await response.json()) as Program[];
        setPrograms(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    void fetchPrograms();
  }, [isLoaded, userId]);

  const selectedProgram = useMemo(
    () => programs.find((program) => program.id === selectedProgramId) ?? null,
    [programs, selectedProgramId],
  );

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
          {programs.map((program) => (
            <label
              key={program.id}
              className="block cursor-pointer border-b border-gray-200 pb-6"
            >
              <div className="flex items-start gap-4">
                <input
                  type="radio"
                  name="exercise"
                  checked={selectedProgramId === program.id}
                  onChange={() => setSelectedProgramId(program.id)}
                  className="mt-2 h-6 w-6 accent-gray-500"
                />

                <div className="flex-1">
                  <div className="flex items-center justify-between text-lg font-semibold text-gray-900">
                    <span>{program.exerciseName}</span>
                    <span className="text-gray-800">
                      בוצע 0 מתוך {program.numberOfRepetions}
                    </span>
                  </div>

                  <div className="mt-4 border border-gray-500 bg-gray-100 px-3 py-0.5 text-left text-lg font-semibold text-gray-800">
                    0%
                  </div>
                </div>
              </div>
            </label>
          ))}
        </div>
      )}

      <div className="mt-10 flex justify-center">
        <button
          type="button"
          disabled={!selectedProgram}
          className="rounded-lg bg-emerald-300 px-10 py-4 text-4xl font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          אישור
        </button>
      </div>
    </main>
  );
}
