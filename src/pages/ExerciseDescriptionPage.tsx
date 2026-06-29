import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "~/auth/AuthProvider";
import {
  applyGenderToText,
  getExerciseTemplateByName,
  type Gender,
} from "~/data/content";
import { apiFetch } from "~/lib/api";
import {
  type ApiPrescribedExercise,
  getZodErrorMessage,
  prescribedExerciseRouteParamsSchema,
  prescribedExercisesResponseSchema,
} from "~/lib/validation";

export function ExerciseDescriptionPage() {
  const { isLoading, user } = useAuth();
  const { prescribedExerciseId } = useParams<{ prescribedExerciseId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [prescribedExercise, setPrescribedExercise] = useState<ApiPrescribedExercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const practiceTimeKey = searchParams.get("practiceTimeKey");

  const routeParamsResult = useMemo(
    () => prescribedExerciseRouteParamsSchema.safeParse({ prescribedExerciseId }),
    [prescribedExerciseId],
  );
  const parsedPrescribedExerciseId = routeParamsResult.success
    ? routeParamsResult.data.prescribedExerciseId
    : null;

  useEffect(() => {
    if (isLoading) return;
    if (!user || parsedPrescribedExerciseId === null) {
      setLoading(false);
      setPrescribedExercise(null);
      return;
    }

    async function fetchPrescribedExercise() {
      try {
        setLoading(true);
        setError(null);

        const response = await apiFetch("/api/prescribed-exercises");

        if (!response.ok) {
          throw new Error("Failed to fetch prescribed exercises");
        }

        const dataResult = prescribedExercisesResponseSchema.safeParse(
          await response.json(),
        );
        if (!dataResult.success) {
          throw new Error(
            getZodErrorMessage(dataResult.error, "Invalid prescribed exercises response"),
          );
        }

        const selectedPrescribedExercise =
          dataResult.data.find((item) => item.id === parsedPrescribedExerciseId) ?? null;
        setPrescribedExercise(selectedPrescribedExercise);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    void fetchPrescribedExercise();
  }, [isLoading, parsedPrescribedExerciseId, user]);

  const exerciseTemplate = useMemo(() => {
    if (!prescribedExercise) return null;
    return getExerciseTemplateByName(prescribedExercise.exerciseName);
  }, [prescribedExercise]);

  const gender = useMemo<Gender>(() => {
    return user?.gender ?? "male";
  }, [user?.gender]);

  const renderedExerciseDescription = useMemo(() => {
    if (!exerciseTemplate) return "";
    return applyGenderToText(
      exerciseTemplate.exTextDescriptionTemplate,
      gender,
    );
  }, [exerciseTemplate, gender]);

  if (loading) {
    return (
      <main
        dir="rtl"
        className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-4xl bg-white px-4 py-8 sm:px-5"
      >
        <p className="text-center text-lg text-gray-700">טוען תרגיל...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main
        dir="rtl"
        className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-4xl bg-white px-4 py-8 sm:px-5"
      >
        <p className="rounded-md bg-red-50 p-3 text-center text-sm text-red-700">
          אירעה שגיאה בטעינת פרטי התרגיל: {error}
        </p>
      </main>
    );
  }

  if (!prescribedExercise || !exerciseTemplate) {
    return (
      <main
        dir="rtl"
        className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-4xl bg-white px-4 py-8 sm:px-5"
      >
        <p className="text-center text-lg text-gray-700">
          לא נמצאו פרטי תרגיל להצגה.
        </p>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-4xl bg-white px-4 py-8 sm:px-5"
    >
      <h1 className="text-center text-4xl font-bold text-gray-900">
        תרגיל {prescribedExercise.exerciseName}
      </h1>

      <div className="mt-10 flex justify-center">
        <button
          type="button"
          onClick={() => {
            const nextUrl =
              practiceTimeKey === null
                ? `/workout/${prescribedExercise.id}`
                : `/workout/${prescribedExercise.id}?practiceTimeKey=${encodeURIComponent(practiceTimeKey)}`;
            void navigate(nextUrl);
          }}
          className="rounded-lg bg-green-500 px-12 py-4 text-4xl font-bold text-white transition hover:bg-green-600"
        >
          בואו נתחיל!
        </button>
      </div>

      <section className="mt-10 text-right text-3xl leading-relaxed font-semibold text-gray-900">
        <p>מנח: {prescribedExercise.position}</p>
        <p>סביבת תרגול: {prescribedExercise.background}</p>
        <p>משך: {prescribedExercise.numberOfSeconds}</p>
        <p>מספר חזרות: {prescribedExercise.numberOfRepetions}</p>
        <p>עוצמת סימפטומים: עד {prescribedExercise.recomendedVAS} מתוך 10</p>
      </section>

      <section
        className="mt-8 text-right text-2xl leading-relaxed font-semibold text-gray-900"
        dangerouslySetInnerHTML={{
          __html: renderedExerciseDescription,
        }}
      />

      <img
        src={exerciseTemplate.exImage}
        alt={`איור עבור ${prescribedExercise.exerciseName}`}
        className="mt-10 w-full rounded-md object-contain"
      />
    </main>
  );
}
