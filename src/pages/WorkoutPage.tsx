import { useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useParams } from "react-router-dom";
import { Metronome } from "~/components/Metronome";
import { getExerciseTemplateByName } from "~/data/content";
import { getApiUrl } from "~/lib/api";

interface Program {
  id: number;
  exerciseName: string;
  numberOfSeconds: number;
  numberOfRepetions: number;
  metronomeBpm: number;
  metronomeBpmTemp: number | null;
}

export function WorkoutPage() {
  const { user, isLoaded } = useUser();
  const { programId } = useParams<{ programId: string }>();
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [currentBpm, setCurrentBpm] = useState(120);
  const hasLoggedCountdownEndRef = useRef(false);

  const userId = user?.id;
  const parsedProgramId = Number(programId);

  useEffect(() => {
    if (!isLoaded) return;
    if (!userId || !Number.isInteger(parsedProgramId)) {
      setProgram(null);
      setLoading(false);
      return;
    }

    const currentUserId = userId;

    async function fetchProgram() {
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
        const selectedProgram =
          data.find((item) => item.id === parsedProgramId) ?? null;
        setProgram(selectedProgram);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    void fetchProgram();
  }, [isLoaded, parsedProgramId, userId]);

  useEffect(() => {
    if (!program) return;

    setRemainingSeconds(program.numberOfSeconds);
    setCurrentBpm(program.metronomeBpmTemp ?? program.metronomeBpm);
    setIsPaused(false);
    hasLoggedCountdownEndRef.current = false;
  }, [program]);

  useEffect(() => {
    if (!program || isPaused || remainingSeconds <= 0) return;

    const timerId = window.setInterval(() => {
      setRemainingSeconds((previousSeconds) => Math.max(0, previousSeconds - 1));
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [isPaused, program, remainingSeconds]);

  useEffect(() => {
    if (!program || remainingSeconds !== 0 || hasLoggedCountdownEndRef.current) {
      return;
    }

    hasLoggedCountdownEndRef.current = true;
    console.log("end of countdown");
  }, [program, remainingSeconds]);

  const exerciseTemplate = useMemo(() => {
    if (!program) return null;
    return getExerciseTemplateByName(program.exerciseName);
  }, [program]);

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
          אירעה שגיאה בטעינת התרגיל: {error}
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

  const isCountdownRunning = !isPaused && remainingSeconds > 0;

  return (
    <main
      dir="rtl"
      className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-4xl bg-white px-4 py-8 sm:px-5"
    >
      <h1 className="text-center text-4xl font-bold text-gray-900">
        {program.exerciseName}
      </h1>

      <p className="mt-6 text-center text-3xl font-semibold text-gray-900">
        תרגול 0 מתוך {program.numberOfRepetions}
      </p>

      <p className="mt-6 text-center text-5xl font-bold text-gray-900">
        {remainingSeconds}
      </p>

      <Metronome
        bpm={currentBpm}
        isRunning={isCountdownRunning}
        onBpmChange={setCurrentBpm}
      />

      <img
        src={exerciseTemplate.exImage}
        alt={`איור עבור ${program.exerciseName}`}
        className="mx-auto mt-12 w-full max-w-md object-contain"
      />

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={() => setIsPaused((previousState) => !previousState)}
          disabled={remainingSeconds === 0}
          className={`rounded-lg px-10 py-4 text-3xl font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
            isPaused ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"
          }`}
        >
          {isPaused ? "המשך תרגול" : "השהייה"}
        </button>
      </div>
    </main>
  );
}
