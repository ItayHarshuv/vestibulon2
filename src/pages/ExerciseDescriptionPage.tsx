import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "~/auth/AuthProvider";
import {
  applyGenderToText,
  getExerciseTemplateByName,
  type Gender,
} from "~/data/content";
import { apiFetch } from "~/lib/api";
import {
  type ApiProgram,
  getZodErrorMessage,
  programRouteParamsSchema,
  programsResponseSchema,
} from "~/lib/validation";

export function ExerciseDescriptionPage() {
  const { isLoading, user } = useAuth();
  const { programId } = useParams<{ programId: string }>();
  const navigate = useNavigate();
  const [program, setProgram] = useState<ApiProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const routeParamsResult = useMemo(
    () => programRouteParamsSchema.safeParse({ programId }),
    [programId],
  );
  const parsedProgramId = routeParamsResult.success
    ? routeParamsResult.data.programId
    : null;

  useEffect(() => {
    if (isLoading) return;
    if (!user || parsedProgramId === null) {
      setLoading(false);
      setProgram(null);
      return;
    }

    async function fetchProgram() {
      try {
        setLoading(true);
        setError(null);

        const response = await apiFetch("/api/programs");

        if (!response.ok) {
          throw new Error("Failed to fetch programs");
        }

        const dataResult = programsResponseSchema.safeParse(
          await response.json(),
        );
        if (!dataResult.success) {
          throw new Error(
            getZodErrorMessage(dataResult.error, "Invalid programs response"),
          );
        }

        const selectedProgram =
          dataResult.data.find((item) => item.id === parsedProgramId) ?? null;
        setProgram(selectedProgram);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    void fetchProgram();
  }, [isLoading, parsedProgramId, user]);

  const exerciseTemplate = useMemo(() => {
    if (!program) return null;
    return getExerciseTemplateByName(program.exerciseName);
  }, [program]);

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

  if (!program || !exerciseTemplate) {
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
        תרגיל {program.exerciseName}
      </h1>

      <div className="mt-10 flex justify-center">
        <button
          type="button"
          onClick={() => {
            void navigate(`/workout/${program.id}`);
          }}
          className="rounded-lg bg-green-500 px-12 py-4 text-4xl font-bold text-white transition hover:bg-green-600"
        >
          בואו נתחיל!
        </button>
      </div>

      <section className="mt-10 text-right text-3xl leading-relaxed font-semibold text-gray-900">
        <p>מנח: {program.position}</p>
        <p>סביבת תרגול: {program.background}</p>
        <p>משך: {program.numberOfSeconds}</p>
        <p>מספר חזרות: {program.numberOfRepetions}</p>
        <p>עוצמת סימפטומים: עד {program.recomendedVAS} מתוך 10</p>
      </section>

      <section
        className="mt-8 text-right text-2xl leading-relaxed font-semibold text-gray-900"
        dangerouslySetInnerHTML={{
          __html: renderedExerciseDescription,
        }}
      />

      <img
        src={exerciseTemplate.exImage}
        alt={`איור עבור ${program.exerciseName}`}
        className="mt-10 w-full rounded-md object-contain"
      />
    </main>
  );
}
