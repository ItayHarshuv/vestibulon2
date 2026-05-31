import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "~/auth/AuthProvider";
import {
  TreatmentPlanExerciseCard,
  type TreatmentPlanExerciseDraft,
} from "~/components/TreatmentPlanExerciseCard";
import { apiFetch } from "~/lib/api";
import {
  allBackgrounds,
  allExPositions,
  exerciseTemplateNames,
  type ExerciseTemplateName,
} from "~/data/content";
import {
  clinicianPatientsResponseSchema,
  getZodErrorMessage,
  saveTreatmentPlanBodySchema,
  treatmentPlanResponseSchema,
  type ClinicianPatient,
} from "~/lib/validation";

type TabId = "patient" | "exercises" | "configure";

const defaultExerciseDraft = (
  exerciseName: ExerciseTemplateName,
): TreatmentPlanExerciseDraft => ({
  exerciseName,
  numberOfSeconds: "",
  numberOfRepetions: "",
  metronomeBpm: 60,
  position: allExPositions[0],
  background: allBackgrounds[0],
  recomendedVAS: 0,
});

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "patient", label: "בחירת מטופל/ת" },
  { id: "exercises", label: "בחירת תרגילים" },
  { id: "configure", label: "הגדרות תרגילים" },
];

export function ClinicianTreatmentPlanPage() {
  const { isLoading, user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("patient");
  const [patients, setPatients] = useState<ClinicianPatient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [planLoading, setPlanLoading] = useState(false);
  const [numberOfSessions, setNumberOfSessions] = useState<number | "">(1);
  const [selectedExerciseNames, setSelectedExerciseNames] = useState<ExerciseTemplateName[]>(
    [],
  );
  const [exerciseDrafts, setExerciseDrafts] = useState<TreatmentPlanExerciseDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const selectableUsers = useMemo(() => {
    if (!user || user.role !== "clinician") {
      return [];
    }

    return [
      {
        id: user.id,
        username: `${user.username} (אני)`,
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
    if (isLoading || user?.role !== "clinician") {
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
        if (!isCancelled) {
          setPatients([]);
          setSelectedPatientId("");
          setError("לא ניתן לטעון את רשימת המטופלים");
        }
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
    if (!selectedPatientId) {
      setNumberOfSessions("");
      setSelectedExerciseNames([]);
      setExerciseDrafts([]);
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        setPlanLoading(true);
        setError(null);

        const response = await apiFetch(
          `/api/clinician/treatment-plan?userId=${encodeURIComponent(selectedPatientId)}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch treatment plan");
        }

        const parsed = treatmentPlanResponseSchema.safeParse(await response.json());
        if (!parsed.success) {
          throw new Error(getZodErrorMessage(parsed.error, "Invalid treatment plan response"));
        }

        if (isCancelled) {
          return;
        }

        const { numberOfSessions: sessions, exercises } = parsed.data;
        setNumberOfSessions(sessions);

        if (exercises.length > 0) {
          const names = exercises
            .map((exercise) => exercise.exerciseName)
            .filter((name): name is ExerciseTemplateName =>
              (exerciseTemplateNames as readonly string[]).includes(name),
            );
          setSelectedExerciseNames(names);
          setExerciseDrafts(
            exercises.map((exercise) => ({
              exerciseName: exercise.exerciseName,
              numberOfSeconds: exercise.numberOfSeconds,
              numberOfRepetions: exercise.numberOfRepetions,
              metronomeBpm: exercise.metronomeBpm,
              position: exercise.position,
              background: exercise.background,
              recomendedVAS: exercise.recomendedVAS,
            })),
          );
        } else {
          setSelectedExerciseNames([]);
          setExerciseDrafts([]);
        }
      } catch (fetchError) {
        console.error("Error fetching treatment plan:", fetchError);
        if (!isCancelled) {
          setError("לא ניתן לטעון את תכנית הטיפול");
          setNumberOfSessions("");
          setSelectedExerciseNames([]);
          setExerciseDrafts([]);
        }
      } finally {
        if (!isCancelled) {
          setPlanLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [selectedPatientId]);

  useEffect(() => {
    setExerciseDrafts((currentDrafts) => {
      const draftsByName = new Map(
        currentDrafts.map((draft) => [draft.exerciseName, draft]),
      );

      return selectedExerciseNames.map((exerciseName) => {
        const existing = draftsByName.get(exerciseName);
        if (existing) {
          return existing;
        }

        return defaultExerciseDraft(exerciseName);
      });
    });
  }, [selectedExerciseNames]);

  function toggleExerciseSelection(exerciseName: ExerciseTemplateName) {
    setSelectedExerciseNames((current) => {
      if (current.includes(exerciseName)) {
        return current.filter((name) => name !== exerciseName);
      }

      return [...current, exerciseName];
    });
  }

  function showValidationPopup(targetId: string) {
    window.setTimeout(() => {
      const target = document.getElementById(targetId);
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
        return;
      }

      target.focus();
      target.reportValidity();
    }, 0);
  }

  async function handleSave() {
    if (!selectedPatientId) {
      setError("יש לבחור מטופל/ת");
      return;
    }

    if (numberOfSessions === "") {
      setError("יש להזין מספר תרגולים ביום");
      setActiveTab("exercises");
      showValidationPopup("treatment-plan-number-of-sessions");
      return;
    }

    const firstExerciseMissingField = exerciseDrafts.findIndex(
      (exercise) => exercise.numberOfSeconds === "" || exercise.numberOfRepetions === "",
    );
    if (firstExerciseMissingField >= 0) {
      const exercise = exerciseDrafts[firstExerciseMissingField];
      setError("יש למלא את כל השדות המספריים");
      setActiveTab("configure");
      showValidationPopup(
        exercise?.numberOfSeconds === ""
          ? `treatment-plan-exercise-${firstExerciseMissingField}-seconds`
          : `treatment-plan-exercise-${firstExerciseMissingField}-repetitions`,
      );
      return;
    }

    const payload = {
      userId: selectedPatientId,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      numberOfSessions,
      exercises: exerciseDrafts,
    };

    const validation = saveTreatmentPlanBodySchema.safeParse(payload);
    if (!validation.success) {
      setError(getZodErrorMessage(validation.error, "שמירת התכנית נכשלה"));
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const response = await apiFetch("/api/clinician/treatment-plan", {
        method: "POST",
        body: JSON.stringify(validation.data),
      });

      const responseData = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(responseData.error ?? "שמירת התכנית נכשלה");
      }

      void navigate("/clinician-menu", {
        state: {
          successModalMessage: "תכנית הטיפול נשמרה בהצלחה",
        },
      });
    } catch (saveError) {
      console.error("Error saving treatment plan:", saveError);
      setError(saveError instanceof Error ? saveError.message : "שמירת התכנית נכשלה");
    } finally {
      setIsSaving(false);
    }
  }

  const canProceedToExercises = Boolean(selectedPatientId);
  const canProceedToConfigure = selectedExerciseNames.length > 0;

  return (
    <main
      dir="rtl"
      className="mx-auto min-h-[calc(100vh-4rem)] max-w-3xl bg-white px-4 py-6 sm:px-6"
    >
      <Link
        to="/clinician-menu"
        className="inline-flex text-sm font-medium text-blue-600 hover:text-blue-800"
      >
        חזרה לתפריט קלינאים
      </Link>

      <h1 className="mt-4 text-3xl font-bold text-gray-900">
        יצירת / שינוי תכנית טיפול למטופל/ת
      </h1>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <nav className="mt-6 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.id
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "patient" && (
        <>
        <section className="mt-6 rounded-2xl border border-black bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-2xl font-bold text-gray-900">בחירת מטופל/ת</h2>
          <p className="mt-2 text-sm text-gray-600">
            בחר/י מטופל/ת כדי לטעון את תכנית הטיפול הנוכחית שלו/ה.
          </p>

          {patientsLoading ? (
            <p className="mt-4 text-sm text-gray-600">טוען מטופלים...</p>
          ) : selectableUsers.length === 0 ? (
            <p className="mt-4 text-sm text-gray-600">לא נמצאו משתמשים לבחירה.</p>
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

          {planLoading && (
            <p className="mt-4 text-sm text-gray-600">טוען תכנית טיפול...</p>
          )}
        </section>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={!canProceedToExercises}
            onClick={() => setActiveTab("exercises")}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            המשך לבחירת תרגילים
          </button>
        </div>
        </>
      )}

      {activeTab === "exercises" && (
        <>
        <div className="mt-6 px-1">
          <h2 className="text-2xl font-bold text-gray-900">בחירת תרגילים ומספר תרגולים ביום</h2>
          <p className="mt-2 text-sm text-gray-600">
            סמן/י את התרגילים שיכללו בתכנית וקבע/י כמה פעמים ביום המטופל/ת מתרגל/ת.
          </p>
        </div>
        <section className="mt-6 rounded-2xl border border-black bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-4 sm:px-6">
            <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
              <span className="text-lg font-semibold text-gray-900">מספר תרגולים ביום</span>
              <input
                id="treatment-plan-number-of-sessions"
                type="number"
                min={1}
                max={10}
                required
                value={numberOfSessions}
                onInvalid={(event) => {
                  if (event.currentTarget.validity.valueMissing) {
                    event.currentTarget.setCustomValidity("This field is required");
                  }
                }}
                onInput={(event) => {
                  event.currentTarget.setCustomValidity("");
                }}
                onChange={(event) =>
                  setNumberOfSessions(
                    event.target.value === "" ? "" : Number(event.target.value),
                  )
                }
                className="max-w-xs rounded-xl border border-gray-300 px-3 py-2 text-base text-gray-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </label>
          </div>

          <fieldset className="divide-y divide-gray-200">
            {exerciseTemplateNames.map((exerciseName) => (
              <label
                key={exerciseName}
                className="flex cursor-pointer items-center justify-between gap-4 px-4 py-4 sm:px-6"
              >
                <span className="text-lg font-semibold text-gray-900">{exerciseName}</span>
                <input
                  type="checkbox"
                  checked={selectedExerciseNames.includes(exerciseName)}
                  onChange={() => toggleExerciseSelection(exerciseName)}
                  className="h-6 w-6 rounded border-gray-400 text-blue-500 focus:ring-blue-500"
                />
              </label>
            ))}
          </fieldset>
        </section>
        <div className="mt-4 flex flex-wrap justify-between gap-3">
          <button
            type="button"
            onClick={() => setActiveTab("patient")}
            className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            חזרה
          </button>
          <button
            type="button"
            disabled={!canProceedToConfigure}
            onClick={() => setActiveTab("configure")}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            המשך להגדרות תרגילים
          </button>
        </div>
        </>
      )}

      {activeTab === "configure" && (
        <section className="mt-6 space-y-6">
          {exerciseDrafts.length === 0 ? (
            <p className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-gray-600 shadow-sm">
              יש לבחור לפחות תרגיל אחד לפני הגדרת הפרמטרים.
            </p>
          ) : (
            exerciseDrafts.map((exercise, index) => (
              <TreatmentPlanExerciseCard
                key={exercise.exerciseName}
                exercise={exercise}
                exerciseIndex={index}
                onChange={(nextExercise) => {
                  setExerciseDrafts((currentDrafts) =>
                    currentDrafts.map((draft, draftIndex) =>
                      draftIndex === index ? nextExercise : draft,
                    ),
                  );
                }}
              />
            ))
          )}

          <div className="flex flex-wrap justify-between gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("exercises")}
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              חזרה
            </button>
            <button
              type="button"
              disabled={isSaving || exerciseDrafts.length === 0 || !selectedPatientId}
              onClick={() => {
                void handleSave();
              }}
              className="rounded-lg bg-emerald-500 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "שומר..." : "שמירת תכנית טיפול"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
