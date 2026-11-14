import { useEffect, useMemo, useState } from "react";
import { useAuth } from "~/auth/AuthProvider";
import { apiFetch } from "~/lib/api";
import {
  getZodErrorMessage,
  sessionTimesResponseSchema,
} from "~/lib/validation";
import {
  enableWebPush,
  sendTestWebPush,
  type WebPushResult,
} from "~/lib/webPush";

export function SchedulePage() {
  const { isLoading, user } = useAuth();
  const [sessionTimes, setSessionTimes] = useState<string[]>([]);
  const [initialSessionTimes, setInitialSessionTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushAction, setPushAction] = useState<"enable" | "test" | null>(null);

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
          `/api/session-times?timeZone=${encodeURIComponent(timeZone)}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch today's reps");
        }

        const result = sessionTimesResponseSchema.safeParse(await response.json());
        if (!result.success) {
          throw new Error(
            getZodErrorMessage(result.error, "Invalid session times response"),
          );
        }

        const nextSessionTimes = result.data.map((row) => row.localTime);
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
      const response = await apiFetch("/api/session-times", {
        method: "PATCH",
        body: JSON.stringify({
          timeZone,
          sessionTimes,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update today's reps");
      }

      const result = sessionTimesResponseSchema.safeParse(await response.json());
      if (!result.success) {
        throw new Error(
          getZodErrorMessage(result.error, "Invalid session times response"),
        );
      }

      const nextSessionTimes = result.data.map((row) => row.localTime);
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

  function getPushResultMessage(result: WebPushResult, isTest: boolean) {
    switch (result) {
      case "enabled":
        return isTest
          ? "התראת בדיקה נשלחה. היא אמורה להופיע בעוד מספר שניות."
          : "ההתראות הופעלו. נזכיר לך בשעות התרגול שבחרת.";
      case "permission-denied":
        return "ההרשאה להתראות חסומה. יש לאפשר התראות בהגדרות הדפדפן.";
      case "ios-install-required":
        return "ב-iPhone או iPad יש להוסיף תחילה את האפליקציה למסך הבית ולפתוח אותה משם.";
      case "unsupported":
        return "הדפדפן הזה אינו תומך בהתראות Web Push.";
    }
  }

  async function handlePushAction(action: "enable" | "test") {
    try {
      setPushAction(action);
      setPushMessage(null);
      setPushError(null);
      const result =
        action === "test" ? await sendTestWebPush() : await enableWebPush();
      const message = getPushResultMessage(result, action === "test");
      if (result === "enabled") {
        setPushMessage(message);
      } else {
        setPushError(message);
      }
    } catch (pushNotificationError) {
      console.error("Error enabling push notifications:", pushNotificationError);
      setPushError("הפעלת ההתראות נכשלה. נא לנסות שוב.");
    } finally {
      setPushAction(null);
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
        כאן ניתן לעדכן את שעות התרגול הקבועות לכל יום.
      </p>

      <section className="mt-8 rounded-xl border border-sky-100 bg-sky-50 p-5">
        <h2 className="text-right text-xl font-bold text-gray-900">
          תזכורות לתרגול
        </h2>
        <p className="mt-2 text-right text-sm text-gray-700">
          יש לאפשר התראות פעם אחת כדי לקבל תזכורת בשעות שבחרת, גם כשהאפליקציה
          אינה פתוחה.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => void handlePushAction("enable")}
            disabled={pushAction !== null}
            className="rounded-lg bg-sky-600 px-5 py-3 font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pushAction === "enable" ? "מפעיל..." : "הפעלת התראות"}
          </button>
          <button
            type="button"
            onClick={() => void handlePushAction("test")}
            disabled={pushAction !== null}
            className="rounded-lg border border-dashed border-amber-600 bg-amber-50 px-5 py-3 font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pushAction === "test" ? "שולח..." : "בדיקת התראה (זמני)"}
          </button>
        </div>
        {pushError && (
          <p className="mt-4 rounded-md bg-red-50 p-3 text-center text-sm text-red-700">
            {pushError}
          </p>
        )}
        {pushMessage && (
          <p className="mt-4 rounded-md bg-emerald-50 p-3 text-center text-sm text-emerald-700">
            {pushMessage}
          </p>
        )}
      </section>

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
              <div
                key={`${index}-${initialSessionTimes[index] ?? sessionTime}`}
                className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <p className="block text-lg font-semibold text-gray-900">
                  זמן תרגול {index + 1}
                </p>

                <input
                  type="time"
                  aria-label={`זמן תרגול ${index + 1}`}
                  value={sessionTime}
                  onClick={(event) => {
                    event.currentTarget.showPicker?.();
                  }}
                  onChange={(event) => {
                    const nextSessionTimes = [...sessionTimes];
                    nextSessionTimes[index] = event.target.value;
                    setSaveSuccessMessage(null);
                    setSessionTimes(nextSessionTimes);
                  }}
                  className="mt-3 w-full cursor-pointer rounded-lg border border-gray-300 px-4 py-3 text-left text-xl text-gray-900"
                  dir="ltr"
                />
              </div>
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
