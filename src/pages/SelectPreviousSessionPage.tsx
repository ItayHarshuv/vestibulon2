import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "~/auth/AuthProvider";
import { apiFetch } from "~/lib/api";
import { getZodErrorMessage, todayRepsResponseSchema } from "~/lib/validation";

type TodayRepRow = {
  id: number;
  practiceTime: string;
  exerciseName: string;
  repId: number | null;
};

type IncompleteSession = {
  practiceDate: Date;
  practiceTimeKey: string;
  completedCount: number;
  totalCount: number;
};

function getPracticeTimeKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}-${String(date.getHours()).padStart(2, "0")}-${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatPracticeTime(date: Date) {
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function SelectPreviousSessionPage() {
  const { isLoading, user } = useAuth();
  const navigate = useNavigate();
  const [todayReps, setTodayReps] = useState<TodayRepRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!user) {
      setTodayReps([]);
      setLoading(false);
      return;
    }

    async function loadTodayReps() {
      try {
        setLoading(true);
        setError(null);
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const response = await apiFetch(
          `/api/today-reps?timeZone=${encodeURIComponent(timeZone)}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch today's reps");
        }

        const result = todayRepsResponseSchema.safeParse(await response.json());
        if (!result.success) {
          throw new Error(
            getZodErrorMessage(result.error, "Invalid today's reps response"),
          );
        }

        setTodayReps(result.data);
      } catch (fetchError) {
        console.error("Error fetching previous sessions:", fetchError);
        setTodayReps([]);
        setError("לא ניתן לטעון את התרגולים הקודמים.");
      } finally {
        setLoading(false);
      }
    }

    void loadTodayReps();
  }, [isLoading, user]);

  const incompleteSessions = useMemo(() => {
    const now = new Date();
    const sessions = new Map<string, IncompleteSession>();

    for (const row of todayReps) {
      const practiceDate = new Date(row.practiceTime);
      if (practiceDate > now) {
        continue;
      }

      const practiceTimeKey = getPracticeTimeKey(practiceDate);
      const existingSession = sessions.get(practiceTimeKey);
      if (existingSession) {
        existingSession.totalCount += 1;
        if (row.repId !== null) {
          existingSession.completedCount += 1;
        }
        continue;
      }

      sessions.set(practiceTimeKey, {
        practiceDate,
        practiceTimeKey,
        completedCount: row.repId === null ? 0 : 1,
        totalCount: 1,
      });
    }

    return [...sessions.values()]
      .filter((session) => session.completedCount < session.totalCount)
      .sort((left, right) => left.practiceDate.getTime() - right.practiceDate.getTime());
  }, [todayReps]);

  return (
    <main
      dir="rtl"
      className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-2xl bg-white px-6 py-8"
    >
      <h1 className="text-center text-3xl font-bold text-gray-900">
        השלמת תרגולים קודמים
      </h1>

      <p className="mt-4 text-center text-lg text-gray-700">
        בחרו את התרגול שברצונכם להשלים.
      </p>

      {loading && <p className="mt-8 text-center text-gray-600">טוען תרגולים...</p>}

      {error && !loading && (
        <p className="mt-8 rounded-md bg-red-50 p-3 text-center text-sm text-red-700">
          {error}
        </p>
      )}

      {!loading && !error && incompleteSessions.length === 0 && (
        <p className="mt-8 text-center text-gray-600">
          אין כרגע תרגולים קודמים שדורשים השלמה.
        </p>
      )}

      {!loading && !error && incompleteSessions.length > 0 && (
        <div className="mt-8 space-y-4">
          {incompleteSessions.map((session) => (
            <button
              key={session.practiceTimeKey}
              type="button"
              onClick={() => {
                void navigate(
                  `/select-exercise?practiceTimeKey=${encodeURIComponent(session.practiceTimeKey)}`,
                );
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-6 py-5 text-right shadow-sm transition hover:border-blue-400 hover:bg-blue-50"
            >
              <div className="text-2xl font-bold text-gray-900">
                תרגול של שעה {formatPracticeTime(session.practiceDate)}
              </div>
              <div className="mt-2 text-lg font-semibold text-gray-700">
                הושלמו {session.completedCount} מתוך {session.totalCount} תרגילים
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="mt-10 flex justify-center">
        <button
          type="button"
          onClick={() => {
            void navigate("/");
          }}
          className="rounded-lg border-4 border-blue-500 bg-white px-8 py-4 text-2xl font-extrabold text-gray-900 transition hover:bg-blue-50"
        >
          חזרה למסך הבית
        </button>
      </div>
    </main>
  );
}
