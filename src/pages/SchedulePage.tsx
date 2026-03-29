import { useEffect, useMemo, useState } from "react";
import { useAuth } from "~/auth/AuthProvider";
import { apiFetch } from "~/lib/api";
import { getZodErrorMessage, todayRepsResponseSchema } from "~/lib/validation";

type TodayRepRow = {
  id: number;
  practiceTime: string;
  exerciseName: string;
  repId: number | null;
};

function getPracticeTimeKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}-${String(date.getHours()).padStart(2, "0")}-${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatTimeInputValue(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function extractSessionTimes(todayReps: TodayRepRow[]) {
  const distinctSessionTimes = new Map<string, string>();
  const sortedRows = [...todayReps].sort(
    (left, right) =>
      new Date(left.practiceTime).getTime() - new Date(right.practiceTime).getTime(),
  );

  for (const row of sortedRows) {
    const practiceDate = new Date(row.practiceTime);
    const practiceTimeKey = getPracticeTimeKey(practiceDate);
    if (!distinctSessionTimes.has(practiceTimeKey)) {
      distinctSessionTimes.set(practiceTimeKey, formatTimeInputValue(practiceDate));
    }
  }

  return [...distinctSessionTimes.values()];
}

function openTimePicker(input: HTMLInputElement) {
  const inputWithPicker = input as HTMLInputElement & {
    showPicker?: () => void;
  };

  inputWithPicker.showPicker?.();
}

export function SchedulePage() {
  const { isLoading, user } = useAuth();
  const [sessionTimes, setSessionTimes] = useState<string[]>([]);
  const [initialSessionTimes, setInitialSessionTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      setSessionTimes([]);
      setInitialSessionTimes([]);
      setError(null);
      setLoading(false);
      return;
    }

    void (async () => {
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

        const nextSessionTimes = extractSessionTimes(result.data);
        setSessionTimes(nextSessionTimes);
        setInitialSessionTimes(nextSessionTimes);
      } catch (fetchError) {
        console.error("Error fetching schedule:", fetchError);
        setSessionTimes([]);
        setInitialSessionTimes([]);
        setError("לא ניתן לטעון את זמני התרגול.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoading, user]);

  const hasNonIncreasingTimes = useMemo(
    () =>
      sessionTimes.some((sessionTime, index) => {
        if (index === 0) {
          return false;
        }

        const previousSessionTime = sessionTimes[index - 1];
        return previousSessionTime === undefined || previousSessionTime >= sessionTime;
      }),
    [sessionTimes],
  );
  const hasChanges = useMemo(
    () =>
      sessionTimes.length !== initialSessionTimes.length ||
      sessionTimes.some((sessionTime, index) => sessionTime !== initialSessionTimes[index]),
    [initialSessionTimes, sessionTimes],
  );
  const canSave = useMemo(
    () =>
      sessionTimes.length > 0 &&
      sessionTimes.every((sessionTime) => sessionTime.length > 0) &&
      hasChanges &&
      !hasNonIncreasingTimes &&
      !isSaving,
    [hasChanges, hasNonIncreasingTimes, isSaving, sessionTimes],
  );

  async function handleSave() {
    if (!canSave) {
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await apiFetch("/api/today-reps", {
        method: "PATCH",
        body: JSON.stringify({
          timeZone,
          sessionTimes,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update today's reps");
      }

      const result = todayRepsResponseSchema.safeParse(await response.json());
      if (!result.success) {
        throw new Error(
          getZodErrorMessage(result.error, "Invalid today's reps response"),
        );
      }

      const nextSessionTimes = extractSessionTimes(result.data);
      setSessionTimes(nextSessionTimes);
      setInitialSessionTimes(nextSessionTimes);
      setSaveSuccessMessage("זמני התרגול עודכנו בהצלחה");
    } catch (saveScheduleError) {
      console.error("Error updating schedule:", saveScheduleError);
      setSaveSuccessMessage(null);
      setSaveError("שמירת זמני התרגול נכשלה. נא לנסות שוב.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-2xl bg-white px-6 py-8"
    >
      <h1 className="text-center text-4xl font-bold text-gray-900">
        קביעת זמני תרגול
      </h1>

      <p className="mt-4 text-center text-lg text-gray-700">
        כאן ניתן לעדכן את שעות התרגול של היום.
      </p>

      {loading && <p className="mt-8 text-center text-gray-600">טוען זמנים...</p>}

      {error && !loading && (
        <p className="mt-8 rounded-md bg-red-50 p-3 text-center text-sm text-red-700">
          {error}
        </p>
      )}

      {!loading && !error && sessionTimes.length === 0 && (
        <p className="mt-8 text-center text-gray-600">
          לא נמצאו זמני תרגול להיום.
        </p>
      )}

      {!loading && !error && sessionTimes.length > 0 && (
        <>
          <p className="mt-8 text-right text-lg font-semibold text-gray-900">
            מספר התרגולים להיום: {sessionTimes.length}
          </p>

          <div className="mt-6 space-y-4">
            {sessionTimes.map((sessionTime, index) => (
              <label
                key={`${index}-${initialSessionTimes[index] ?? sessionTime}`}
                className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <span className="block text-lg font-semibold text-gray-900">
                  זמן תרגול {index + 1}
                </span>

                <input
                  type="time"
                  value={sessionTime}
                  onClick={(event) => {
                    openTimePicker(event.currentTarget);
                  }}
                  onFocus={(event) => {
                    openTimePicker(event.currentTarget);
                  }}
                  onChange={(event) => {
                    const nextSessionTimes = [...sessionTimes];
                    nextSessionTimes[index] = event.target.value;
                    setSaveSuccessMessage(null);
                    setSessionTimes(nextSessionTimes);
                  }}
                  className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-3 text-left text-xl text-gray-900"
                  dir="ltr"
                />
              </label>
            ))}
          </div>

          {hasNonIncreasingTimes && (
            <p className="mt-4 rounded-md bg-red-50 p-3 text-center text-sm text-red-700">
              יש לבחור שעות תרגול בסדר עולה.
            </p>
          )}

          {saveError && (
            <p className="mt-4 rounded-md bg-red-50 p-3 text-center text-sm text-red-700">
              {saveError}
            </p>
          )}

          {saveSuccessMessage && (
            <p className="mt-4 rounded-md bg-emerald-50 p-3 text-center text-sm text-emerald-700">
              {saveSuccessMessage}
            </p>
          )}

          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={() => {
                void handleSave();
              }}
              disabled={!canSave}
              className="rounded-lg bg-emerald-300 px-10 py-4 text-3xl font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "שומר..." : "שמירת הזמנים"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
