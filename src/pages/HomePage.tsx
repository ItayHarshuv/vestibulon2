import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "~/auth/AuthProvider";
import { HomeActionButton } from "../components/HomeActionButton";
import { apiFetch } from "~/lib/api";
import { getZodErrorMessage, todayRepsResponseSchema } from "~/lib/validation";

type TodayRepRow = {
  id: number;
  practiceTime: string;
  exerciseName: string;
  repId: number | null;
};

function formatPracticeTime(date: Date) {
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function getPracticeTimeKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}-${String(date.getHours()).padStart(2, "0")}-${String(date.getMinutes()).padStart(2, "0")}`;
}

export function HomePage() {
  const navigate = useNavigate();
  const { isLoading, refreshSession, user } = useAuth();
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [selectedGender, setSelectedGender] = useState<"male" | "female" | null>(
    null,
  );
  const [isSavingGender, setIsSavingGender] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [todayReps, setTodayReps] = useState<TodayRepRow[]>([]);
  const [isLoadingTodayReps, setIsLoadingTodayReps] = useState(false);
  const [todayRepsError, setTodayRepsError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const hasGenderInMetadata = useMemo(() => {
    return user?.gender === "male" || user?.gender === "female";
  }, [user?.gender]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      setShowGenderModal(false);
      return;
    }
    setShowGenderModal(!hasGenderInMetadata);
  }, [hasGenderInMetadata, isLoading, user]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      setTodayReps([]);
      setTodayRepsError(null);
      return;
    }

    void (async () => {
      try {
        setIsLoadingTodayReps(true);
        setTodayRepsError(null);
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const response = await apiFetch(
          `/api/today-reps?timeZone=${encodeURIComponent(timeZone)}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch today's reps");
        }

        const dataResult = todayRepsResponseSchema.safeParse(await response.json());
        if (!dataResult.success) {
          throw new Error(
            getZodErrorMessage(dataResult.error, "Invalid today's reps response"),
          );
        }

        setTodayReps(dataResult.data);
      } catch (error) {
        console.error("Error fetching today's reps:", error);
        setTodayReps([]);
        setTodayRepsError("לא ניתן לטעון את תרגולי היום");
      } finally {
        setIsLoadingTodayReps(false);
      }
    })();
  }, [isLoading, user]);

  const practiceStatus = useMemo(() => {
    if (isLoadingTodayReps) {
      return {
        kind: "loading" as const,
        timeLabel: null,
      };
    }

    if (todayRepsError) {
      return {
        kind: "error" as const,
        timeLabel: null,
      };
    }

    const now = new Date(nowMs);
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
      const latestDuePracticeTimePendingRow = scheduledRows.find(
        (row) =>
          getPracticeTimeKey(row.practiceDate) === latestDuePracticeTimeKey &&
          row.repId === null,
      );

      if (latestDuePracticeTimePendingRow) {
        return {
          kind: "due" as const,
          timeLabel: formatPracticeTime(latestDuePracticeTimePendingRow.practiceDate),
        };
      }
    }

    const nextPendingRow = scheduledRows.find((row) => row.practiceDate > now && row.repId === null);

    if (!nextPendingRow) {
      return {
        kind: "complete" as const,
        timeLabel: null,
      };
    }

    return {
      kind: "upcoming" as const,
      timeLabel: formatPracticeTime(nextPendingRow.practiceDate),
    };
  }, [isLoadingTodayReps, nowMs, todayReps, todayRepsError]);

  async function handleConfirmGender() {
    if (!user || !selectedGender) return;
    try {
      setIsSavingGender(true);
      setSaveError(null);
      const response = await apiFetch("/api/me", {
        method: "PATCH",
        body: JSON.stringify({
          gender: selectedGender,
        }),
      });

      if (!response.ok) {
        throw new Error("שמירת לשון הפנייה נכשלה. נסה שוב.");
      }

      await refreshSession();
      setShowGenderModal(false);
    } catch {
      setSaveError("שמירת לשון הפנייה נכשלה. נסה שוב.");
    } finally {
      setIsSavingGender(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="flex min-h-screen flex-col items-center bg-white px-6 pt-10"
    >


      {/* Call to action */}
      <p className="mt-4 text-xl font-bold text-gray-900 text-center">
        {practiceStatus.kind === "due" ? (
          <>
            הגיע הזמן לתרגל!<br /> יש להשלים את התרגול של
            {" "}
            השעה {practiceStatus.timeLabel}
          </>
        ) : practiceStatus.kind === "upcoming" ? (
          <>תזכורת לתרגיל הבא בשעה {practiceStatus.timeLabel}</>
        ) : practiceStatus.kind === "loading" ? (
          <>טוען תרגולים...</>
        ) : practiceStatus.kind === "error" ? (
          <>{todayRepsError}</>
        ) : (
          <>לא נותרו תרגולים להיום</>
        )}
      </p>

      {/* Button cards */}
      <div className="mt-8 flex w-full max-w-lg flex-col gap-5">
        <HomeActionButton
          to="/"
          label="קביעת זמני תרגול"
          iconSrc="/assets/icons/clock.svg"
        />
        <HomeActionButton
          to="/"
          label="צפייה בנתוני התרגול"
          iconSrc="/assets/icons/bars-chart.svg"
        />
        <HomeActionButton
          to="/"
          label="הודעות מקלינאים"
          iconSrc="/assets/icons/messages.svg"
        />
      </div>

      {/* Start practice button */}
      <div className="mt-12 flex flex-col items-center">
        <button
          type="button"
          onClick={() => navigate("/select-exercise")}
          className="flex h-48 w-48 items-center justify-center rounded-full bg-green-500 text-center text-2xl font-extrabold text-white shadow-lg transition-transform hover:scale-105 hover:bg-green-600"
        >
          התחלת
          <br />
          תרגול
        </button>
      </div>

      {showGenderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 text-right shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-900">
              שלום! איזה כיף שהצטרפת. מה לשון הפנייה המועדף עליך?
            </h2>

            <fieldset className="mt-6 space-y-4">
              <label className="flex cursor-pointer items-center gap-3 text-xl font-semibold text-gray-900">
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  checked={selectedGender === "male"}
                  onChange={() => setSelectedGender("male")}
                  className="h-5 w-5 accent-green-600"
                />
                <span>גבר</span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 text-xl font-semibold text-gray-900">
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  checked={selectedGender === "female"}
                  onChange={() => setSelectedGender("female")}
                  className="h-5 w-5 accent-green-600"
                />
                <span>אישה</span>
              </label>
            </fieldset>

            {saveError && (
              <p className="mt-4 rounded-md bg-red-50 p-2 text-sm text-red-700">
                {saveError}
              </p>
            )}

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  void handleConfirmGender();
                }}
                disabled={!selectedGender || isSavingGender}
                className="rounded-lg bg-green-500 px-10 py-3 text-2xl font-bold text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                אישור
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
