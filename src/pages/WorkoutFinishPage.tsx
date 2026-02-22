import { useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { WorkoutStopwatch } from "~/components/WorkoutStopwatch";
import { getApiUrl } from "~/lib/api";

interface SliderQuestionProps {
  label: string;
  value: number | null;
  onChange: (nextValue: number) => void;
}

function SliderQuestion({ label, value, onChange }: SliderQuestionProps) {
  return (
    <section className="mt-8">
      <p className="text-right text-3xl font-semibold text-gray-900">{label}</p>

      <div className="mt-3" dir="ltr">
        <div className="mb-2 flex items-center justify-between text-4xl font-semibold text-gray-900">
          <span>10</span>
          <span>0</span>
        </div>

        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={value ?? 0}
          onChange={(event) => {
            onChange(Number(event.target.value));
          }}
          className="h-2 w-full cursor-pointer accent-blue-500"
        />
      </div>
    </section>
  );
}

export function WorkoutFinishPage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { programId, repId } = useParams<{ programId: string; repId: string }>();
  const location = useLocation();
  const fallbackStartTimestampRef = useRef<number>(Date.now());
  const [dizziness, setDizziness] = useState<number | null>(null);
  const [nausea, setNausea] = useState<number | null>(null);
  const [generalDifficulty, setGeneralDifficulty] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationState = location.state as { workoutStartTimestampMs?: number } | null;
  const workoutStartTimestampMs =
    typeof locationState?.workoutStartTimestampMs === "number"
      ? locationState.workoutStartTimestampMs
      : fallbackStartTimestampRef.current;

  const parsedProgramId = Number(programId);
  const parsedRepId = Number(repId);

  const canContinue = useMemo(
    () =>
      dizziness !== null &&
      nausea !== null &&
      generalDifficulty !== null &&
      !isSubmitting,
    [dizziness, generalDifficulty, isSubmitting, nausea],
  );

  async function handleContinue() {
    if (!canContinue) return;

    if (!Number.isInteger(parsedProgramId) || !Number.isInteger(parsedRepId)) {
      setError("נתוני האימון אינם תקינים.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

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
          repId: parsedRepId,
          dizziness,
          nausea,
          general_difficulty: generalDifficulty,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update rep record");
      }

      await navigate(`/workout-rest/${parsedProgramId}/${parsedRepId}`, {
        state: {
          workoutStartTimestampMs,
        },
      });
    } catch (submitError) {
      console.error("Error updating finish questionnaire:", submitError);
      setError("שמירת התשובות נכשלה. נא לנסות שוב.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-4xl bg-white px-4 py-8 sm:px-5"
    >
      <WorkoutStopwatch
        startTimestampMs={workoutStartTimestampMs}
        prefixText="הזמן שחלף מרגע סיום התרגול:"
      />

      <h1 className="mt-6 text-center text-5xl font-extrabold text-gray-900">
        כל הכבוד! תרגול נהדר! זכית ב 10 נקודות!
      </h1>

      <p className="mt-6 text-center text-2xl font-semibold text-gray-900">
        אשמח לדעת איך הרגשת עכשיו כדי להתאים עבורך את התרגול הבא.
      </p>

      <p className="mt-2 text-center text-2xl font-semibold text-gray-900">
        דרגו מ-0 עד 10 (0-לא קשה בכלל, 10- הכי קשה):
      </p>

      <SliderQuestion
        label="תחושת סחרחורת"
        value={dizziness}
        onChange={setDizziness}
      />

      <SliderQuestion label="תחושת בחילה" value={nausea} onChange={setNausea} />

      <SliderQuestion
        label="קושי כללי בתרגול"
        value={generalDifficulty}
        onChange={setGeneralDifficulty}
      />

      {error && (
        <p className="mt-6 rounded-md bg-red-50 p-3 text-center text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-12 flex justify-center">
        <button
          type="button"
          onClick={() => {
            void handleContinue();
          }}
          disabled={!canContinue}
          className="rounded-lg bg-emerald-300 px-14 py-4 text-4xl font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          המשך
        </button>
      </div>
    </main>
  );
}
