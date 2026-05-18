import { useEffect, useMemo, useState } from "react";
import { useAuth } from "~/auth/AuthProvider";
import { ExerciseStatisticsChart } from "~/components/ExerciseStatisticsChart";
import { apiFetch } from "~/lib/api";
import {
  clinicianPatientsResponseSchema,
  exerciseStatisticsResponseSchema,
  getZodErrorMessage,
  type ClinicianPatient,
  type ExerciseStatisticsSeries,
} from "~/lib/validation";

type DateFilterOption =
  | "today"
  | "lastTwoDays"
  | "lastWeek"
  | "lastMonth"
  | "allTime"
  | "custom";

const dateFilterOptions: Array<{ value: DateFilterOption; label: string }> = [
  { value: "today", label: "יום נוכחי" },
  { value: "lastTwoDays", label: "יומיים אחרונים" },
  { value: "lastWeek", label: "שבוע אחרון" },
  { value: "lastMonth", label: "חודש אחרון" },
  { value: "allTime", label: "סך הכל תרגול עד כה" },
  { value: "custom", label: "לפי תאריך" },
];

function getDateKeyInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shiftedDate = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  shiftedDate.setUTCDate(shiftedDate.getUTCDate() + days);
  return shiftedDate.toISOString().slice(0, 10);
}

function formatDisplayDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
  }).format(date);
}

export function ExerciseStatisticsPage() {
  const { isLoading, user } = useAuth();
  const [patients, setPatients] = useState<ClinicianPatient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [exercises, setExercises] = useState<ExerciseStatisticsSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const todayKey = getDateKeyInTimeZone(new Date(), timeZone);
  const selectableUsers = useMemo(() => {
    if (!user || user.role !== "clinician") {
      return [];
    }

    return [
      {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      ...patients,
    ];
  }, [patients, user]);
  const selectedPatient = useMemo(
    () => selectableUsers.find((patient) => patient.id === selectedPatientId) ?? null,
    [selectableUsers, selectedPatientId],
  );

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!user) {
      setPatients([]);
      setSelectedPatientId("");
      setPatientsLoading(false);
      return;
    }

    if (user.role !== "clinician") {
      setPatients([]);
      setSelectedPatientId("");
      setPatientsLoading(false);
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        setPatientsLoading(true);
        setError(null);
        const response = await apiFetch("/api/clinician/patients");

        if (!response.ok) {
          throw new Error("Failed to fetch clinician patients");
        }

        const parsed = clinicianPatientsResponseSchema.safeParse(await response.json());
        if (!parsed.success) {
          throw new Error(
            getZodErrorMessage(parsed.error, "Invalid clinician patients response"),
          );
        }

        if (isCancelled) {
          return;
        }

        setPatients(parsed.data.patients);
        setSelectedPatientId((currentSelectedPatientId) => {
          if (
            currentSelectedPatientId &&
            (currentSelectedPatientId === user.id ||
              parsed.data.patients.some((patient) => patient.id === currentSelectedPatientId))
          ) {
            return currentSelectedPatientId;
          }

          return user.id;
        });
      } catch (fetchError) {
        console.error("Error fetching clinician patients:", fetchError);
        if (isCancelled) {
          return;
        }
        setPatients([]);
        setSelectedPatientId("");
        setError("לא ניתן לטעון את רשימת המטופלים");
      } finally {
        if (!isCancelled) {
          setPatientsLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [isLoading, user]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!user) {
      setExercises([]);
      setLoading(false);
      return;
    }

    const targetUserId = user.role === "clinician" ? selectedPatientId : user.id;
    if (!targetUserId) {
      setExercises([]);
      setLoading(false);
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const query = new URLSearchParams({ timeZone });
        if (targetUserId !== user.id) {
          query.set("userId", targetUserId);
        }
        const response = await apiFetch(
          `/api/exercise-statistics?${query.toString()}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch exercise statistics");
        }

        const parsed = exerciseStatisticsResponseSchema.safeParse(await response.json());
        if (!parsed.success) {
          throw new Error(
            getZodErrorMessage(parsed.error, "Invalid exercise statistics response"),
          );
        }

        if (isCancelled) {
          return;
        }

        setExercises(parsed.data.exercises);
      } catch (fetchError) {
        console.error("Error fetching exercise statistics:", fetchError);
        if (isCancelled) {
          return;
        }
        setExercises([]);
        setError("לא ניתן לטעון את נתוני התרגול");
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [isLoading, selectedPatientId, timeZone, user]);

  const selectedRange = useMemo(() => {
    if (dateFilter === "allTime") {
      return { startDate: null, endDate: null, isValid: true };
    }

    if (dateFilter === "custom") {
      if (!customStartDate || !customEndDate) {
        return { startDate: null, endDate: null, isValid: false };
      }

      return {
        startDate: customStartDate,
        endDate: customEndDate,
        isValid: customStartDate <= customEndDate,
      };
    }

    const daysBackByFilter: Record<Exclude<DateFilterOption, "allTime" | "custom">, number> = {
      today: 0,
      lastTwoDays: 1,
      lastWeek: 6,
      lastMonth: 29,
    };

    return {
      startDate: shiftDateKey(todayKey, -daysBackByFilter[dateFilter]),
      endDate: todayKey,
      isValid: true,
    };
  }, [customEndDate, customStartDate, dateFilter, todayKey]);

  const filteredExercises = useMemo(() => {
    return exercises
      .map((series) => {
        if (!selectedRange.startDate || !selectedRange.endDate) {
          return dateFilter === "allTime" ? series : null;
        }

        const days = series.days.filter(
          (day) =>
            day.date >= selectedRange.startDate! && day.date <= selectedRange.endDate!,
        );

        if (days.length === 0) {
          return null;
        }

        return {
          ...series,
          startDate: days[0]?.date ?? series.startDate,
          endDate: days[days.length - 1]?.date ?? series.endDate,
          days,
        };
      })
      .filter((series): series is ExerciseStatisticsSeries => series !== null);
  }, [dateFilter, exercises, selectedRange.endDate, selectedRange.startDate]);

  const rangeError =
    dateFilter === "custom" && customStartDate && customEndDate && customStartDate > customEndDate
      ? "תאריך התחלה חייב להיות מוקדם או שווה לתאריך הסיום"
      : null;

  const exerciseSummaries = useMemo(() => {
    return filteredExercises.map((series) => {
      const totals = series.days.reduce(
        (accumulator, day) => {
          accumulator.completedReps += day.completedReps;
          accumulator.plannedReps += day.plannedReps;
          return accumulator;
        },
        { completedReps: 0, plannedReps: 0 },
      );

      return {
        exerciseName: series.exerciseName,
        completedReps: totals.completedReps,
        plannedReps: totals.plannedReps,
        completionRate:
          totals.plannedReps > 0
            ? Math.round((totals.completedReps / totals.plannedReps) * 100)
            : 0,
      };
    });
  }, [filteredExercises]);

  const selectedRangeLabel = useMemo(() => {
    switch (dateFilter) {
      case "today":
        return "יום נוכחי";
      case "lastTwoDays":
        return "יומיים אחרונים";
      case "lastWeek":
        return "שבוע אחרון";
      case "lastMonth":
        return "חודש אחרון";
      case "allTime":
        return "סך כל התרגול עד כה";
      case "custom":
        if (selectedRange.startDate && selectedRange.endDate && !rangeError) {
          return `${formatDisplayDate(selectedRange.startDate)} - ${formatDisplayDate(
            selectedRange.endDate,
          )}`;
        }
        return "טווח תאריכים מותאם";
    }
  }, [dateFilter, rangeError, selectedRange.endDate, selectedRange.startDate]);

  return (
    <main
      dir="rtl"
      className="mx-auto min-h-[calc(100vh-4rem)] max-w-4xl bg-white px-4 py-6 sm:px-6"
    >


      {user?.role === "clinician" && (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold text-gray-900">בחירת מטופל/ת</h2>
            <p className="text-sm text-gray-600">
              בחר/י מטופל/ת כדי לצפות בנתוני התרגול שלו/ה.
            </p>
          </div>

          {patientsLoading ? (
            <p className="mt-4 text-sm text-gray-600">טוען מטופלים...</p>
          ) : (
            <label className="mt-4 flex flex-col gap-2 text-sm font-medium text-gray-700">
              <span>מטופל/ת</span>
              <select
                value={selectedPatientId}
                onChange={(event) => setSelectedPatientId(event.target.value)}
                className="rounded-xl border border-gray-300 px-3 py-2 text-base text-gray-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                {selectableUsers.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.username}
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-4 sm:px-6">
          <h2 className="text-2xl font-bold text-gray-900">בחר תאריכי הצגת נתונים</h2>
        </div>

        <fieldset className="divide-y divide-gray-200">
          {dateFilterOptions.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center justify-between gap-4 px-4 py-4 sm:px-6"
            >
              <span className="text-xl font-semibold text-gray-900">{option.label}</span>
              <input
                type="radio"
                name="exercise-statistics-date-filter"
                value={option.value}
                checked={dateFilter === option.value}
                onChange={() => setDateFilter(option.value)}
                className="h-7 w-7 border-gray-400 text-blue-500 focus:ring-blue-500"
              />
            </label>
          ))}
        </fieldset>

        {dateFilter === "custom" && (
          <div className="border-t border-gray-200 px-4 py-4 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
                <span>תאריך התחלה</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(event) => setCustomStartDate(event.target.value)}
                  className="rounded-xl border border-gray-300 px-3 py-2 text-base text-gray-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
                <span>תאריך סיום</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(event) => setCustomEndDate(event.target.value)}
                  className="rounded-xl border border-gray-300 px-3 py-2 text-base text-gray-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </label>
            </div>

            {rangeError && <p className="mt-3 text-sm text-red-700">{rangeError}</p>}
          </div>
        )}
      </section>

      {!loading && !error && exercises.length > 0 && !rangeError && filteredExercises.length > 0 && (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold text-gray-900">
              סטטיסטיקות ביצוע תרגולים של {selectedRangeLabel}
            </h2>
            {selectedPatient && (
              <p className="text-sm font-medium text-gray-700">
                מטופל/ת נבחר/ה: {selectedPatient.username}
              </p>
            )}
            <p className="text-sm text-gray-600">{selectedRangeLabel}</p>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-gray-100">
            <div className="grid grid-cols-[1.3fr_1fr_1fr] gap-4 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 sm:grid-cols-[1.6fr_1fr_1fr] sm:px-6">
              <p className="text-right">שם התרגיל</p>
              <p className="text-center">חזרות שנעשו / סך החזרות</p>
              <p className="text-center">חזרות שנעשו באחוזים</p>
            </div>

            <div className="divide-y divide-gray-100">
              {exerciseSummaries.map((summary) => (
                <div
                  key={summary.exerciseName}
                  className="grid grid-cols-[1.3fr_1fr_1fr] gap-4 px-4 py-3 text-lg font-semibold text-gray-900 sm:grid-cols-[1.6fr_1fr_1fr] sm:px-6"
                >
                  <p className="text-right">{summary.exerciseName}</p>
                  <p className="text-center">
                    {summary.completedReps}/{summary.plannedReps}
                  </p>
                  <p className="text-center">{summary.completionRate}%</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {loading && (
        <p className="mt-8 text-center text-lg text-gray-600">טוען נתונים...</p>
      )}

      {error && (
        <p className="mt-8 rounded-md bg-red-50 p-3 text-center text-red-700">{error}</p>
      )}

      {!loading && !error && exercises.length === 0 && (
        <p className="mt-8 text-center text-lg text-gray-600">
          {user?.role === "clinician" && patients.length === 0
            ? "לא נמצאו מטופלים להצגה"
            : "אין עדיין נתוני תרגול להצגה"}
        </p>
      )}

      {!loading && !error && exercises.length > 0 && !rangeError && filteredExercises.length === 0 && (
        <p className="mt-8 text-center text-lg text-gray-600">
          אין נתוני תרגול להצגה בטווח התאריכים שנבחר
        </p>
      )}

      {!loading && !error && exercises.length > 0 && !rangeError && filteredExercises.length > 0 && (
        <div className="mt-6 flex flex-col gap-6">
          {filteredExercises.map((series) => (
            <ExerciseStatisticsChart key={series.exerciseName} series={series} />
          ))}
        </div>
      )}
    </main>
  );
}
