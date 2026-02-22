import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useNavigate, useParams } from "react-router-dom";
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
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { programId } = useParams<{ programId: string }>();
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [currentBpm, setCurrentBpm] = useState(120);
  const [activeRepId, setActiveRepId] = useState<number | null>(null);
  const [workoutStartTimestampMs, setWorkoutStartTimestampMs] = useState<number | null>(
    null,
  );
  const hasLoggedCountdownEndRef = useRef(false);
  const hasCreatedRepRef = useRef(false);
  const hasPausedInRepRef = useRef(false);
  const hasNavigatedToFinishRef = useRef(false);
  const fallbackWorkoutStartTimestampRef = useRef<number>(Date.now());

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
    hasCreatedRepRef.current = false;
    hasPausedInRepRef.current = false;
    hasNavigatedToFinishRef.current = false;
    setActiveRepId(null);
    setWorkoutStartTimestampMs(null);
    fallbackWorkoutStartTimestampRef.current = Date.now();
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
    if (!program || !isLoaded || !userId || hasCreatedRepRef.current) return;

    hasCreatedRepRef.current = true;
    const currentExerciseName = program.exerciseName;

    void (async () => {
      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Missing auth token");
        }

        const response = await fetch(getApiUrl("/api/reps"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            exerciseName: currentExerciseName,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create rep record");
        }

        const data = (await response.json()) as { id?: number; startTime?: string };
        setActiveRepId(typeof data.id === "number" ? data.id : null);
        if (typeof data.startTime === "string") {
          const parsedStartTimestamp = Date.parse(data.startTime);
          if (!Number.isNaN(parsedStartTimestamp)) {
            setWorkoutStartTimestampMs(parsedStartTimestamp);
            return;
          }
        }
        setWorkoutStartTimestampMs(fallbackWorkoutStartTimestampRef.current);
      } catch (err) {
        console.error("Error creating rep record:", err);
      }
    })();
  }, [getToken, isLoaded, program, userId]);

  useEffect(() => {
    if (
      !program ||
      remainingSeconds !== 0 ||
      hasLoggedCountdownEndRef.current ||
      hasNavigatedToFinishRef.current
    ) {
      return;
    }

    if (activeRepId === null) return;
    hasLoggedCountdownEndRef.current = true;

    const completedBpm = currentBpm;
    const durationSeconds = program.numberOfSeconds;
    const flagPaused = hasPausedInRepRef.current;

    void (async () => {
      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Missing auth token");
        }

        const response = await fetch(getApiUrl("/api/reps"), {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            repId: activeRepId,
            numberOfSeconds: durationSeconds,
            bpmEndOfRep: completedBpm,
            flagPaused,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to update rep record");
        }
      } catch (err) {
        console.error("Error updating rep record:", err);
      } finally {
        hasNavigatedToFinishRef.current = true;
        navigate(`/workout-finish/${program.id}/${activeRepId}`, {
          state: {
            workoutStartTimestampMs:
              workoutStartTimestampMs ?? fallbackWorkoutStartTimestampRef.current,
          },
        });
      }
    })();
  }, [
    activeRepId,
    currentBpm,
    getToken,
    navigate,
    program,
    remainingSeconds,
    workoutStartTimestampMs,
  ]);

  const exerciseTemplate = useMemo(() => {
    if (!program) return null;
    return getExerciseTemplateByName(program.exerciseName);
  }, [program]);

  const handleMetronomeBpmChange = useCallback(
    (nextBpm: number) => {
      setCurrentBpm(nextBpm);

      if (!program || !userId) return;

      setProgram((previousProgram) => {
        if (!previousProgram) return previousProgram;
        return {
          ...previousProgram,
          metronomeBpmTemp: nextBpm,
        };
      });

      void (async () => {
        try {
          const response = await fetch(getApiUrl("/api/programs"), {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userId,
              programId: program.id,
              metronomeBpmTemp: nextBpm,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to update metronome bpm temp");
          }
        } catch (err) {
          console.error("Error updating metronome bpm temp:", err);
        }
      })();
    },
    [program, userId],
  );

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
        onBpmChange={handleMetronomeBpmChange}
      />

      <img
        src={exerciseTemplate.exImage}
        alt={`איור עבור ${program.exerciseName}`}
        className="mx-auto mt-12 w-full max-w-md object-contain"
      />

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={() =>
            setIsPaused((previousState) => {
              const nextState = !previousState;
              if (nextState) {
                hasPausedInRepRef.current = true;
              }
              return nextState;
            })
          }
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
