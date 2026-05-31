import { useState } from "react";
import { Metronome } from "~/components/Metronome";
import {
  allBackgrounds,
  allExPositions,
  type Background,
  type Position,
} from "~/data/content";

export type TreatmentPlanExerciseDraft = {
  exerciseName: string;
  numberOfSeconds: number | "";
  numberOfRepetions: number | "";
  metronomeBpm: number;
  position: Position;
  background: Background;
  recomendedVAS: number;
};

type TreatmentPlanExerciseCardProps = {
  exercise: TreatmentPlanExerciseDraft;
  exerciseIndex: number;
  onChange: (exercise: TreatmentPlanExerciseDraft) => void;
};

export function TreatmentPlanExerciseCard({
  exercise,
  exerciseIndex,
  onChange,
}: TreatmentPlanExerciseCardProps) {
  const [metronomeRunning, setMetronomeRunning] = useState(false);

  function getNumberInputValue(value: string) {
    if (value === "") {
      return "";
    }

    return Number(value);
  }

  function handleRequiredNumberInvalid(event: React.FormEvent<HTMLInputElement>) {
    if (event.currentTarget.validity.valueMissing) {
      event.currentTarget.setCustomValidity("This field is required");
    }
  }

  function clearValidationMessage(event: React.FormEvent<HTMLInputElement>) {
    event.currentTarget.setCustomValidity("");
  }

  return (
    <section className="rounded-2xl border border-black bg-white p-4 shadow-sm sm:p-6">
      <h3 className="text-right text-2xl font-bold text-gray-900">{exercise.exerciseName}</h3>

      <div className="mt-6 space-y-6">
        <label className="block pt-2 text-right">
          <span className="text-lg font-semibold text-gray-900">משך (שניות):</span>
          <input
            id={`treatment-plan-exercise-${exerciseIndex}-seconds`}
            type="number"
            min={1}
            max={600}
            required
            value={exercise.numberOfSeconds}
            onInvalid={handleRequiredNumberInvalid}
            onInput={clearValidationMessage}
            onChange={(event) =>
              onChange({
                ...exercise,
                numberOfSeconds: getNumberInputValue(event.target.value),
              })
            }
            className="mt-2 block w-full rounded-xl border border-gray-300 px-3 py-2 text-right text-xl text-gray-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>

        <label className="block pt-6 text-right">
          <span className="text-lg font-semibold text-gray-900">מספר חזרות:</span>
          <input
            id={`treatment-plan-exercise-${exerciseIndex}-repetitions`}
            type="number"
            min={1}
            max={50}
            required
            value={exercise.numberOfRepetions}
            onInvalid={handleRequiredNumberInvalid}
            onInput={clearValidationMessage}
            onChange={(event) =>
              onChange({
                ...exercise,
                numberOfRepetions: getNumberInputValue(event.target.value),
              })
            }
            className="mt-2 block w-full rounded-xl border border-gray-300 px-3 py-2 text-right text-xl text-gray-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>

        <div className="pt-6">
          <Metronome
            bpm={exercise.metronomeBpm}
            isRunning={metronomeRunning}
            onBpmChange={(nextBpm) => {
              setMetronomeRunning(true);
              onChange({
                ...exercise,
                metronomeBpm: nextBpm,
              });
            }}
          />

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setMetronomeRunning((current) => !current)}
              className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
            >
              {metronomeRunning ? "עצור מטרונום" : "הפעל מטרונום"}
            </button>
          </div>
        </div>

        <label className="block pt-6 text-right">
          <span className="text-lg font-semibold text-gray-900">מנח:</span>
          <select
            value={exercise.position}
            onChange={(event) =>
              onChange({
                ...exercise,
                position: event.target.value as Position,
              })
            }
            className="mt-2 block w-full rounded-xl border border-gray-300 px-3 py-2 text-right text-base text-gray-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            {allExPositions.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
        </label>

        <label className="block pt-6 text-right">
          <span className="text-lg font-semibold text-gray-900">סביבת תרגול:</span>
          <select
            value={exercise.background}
            onChange={(event) =>
              onChange({
                ...exercise,
                background: event.target.value as Background,
              })
            }
            className="mt-2 block w-full rounded-xl border border-gray-300 px-3 py-2 text-right text-base text-gray-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            {allBackgrounds.map((background) => (
              <option key={background} value={background}>
                {background}
              </option>
            ))}
          </select>
        </label>

        <div className="pt-6">
          <p className="text-right text-lg font-semibold text-gray-900">
            VAS רצוי: {exercise.recomendedVAS}
          </p>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={exercise.recomendedVAS}
            onChange={(event) =>
              onChange({
                ...exercise,
                recomendedVAS: Number(event.target.value),
              })
            }
            className="mt-4 h-2 w-full cursor-pointer accent-blue-500"
          />
        </div>
      </div>
    </section>
  );
}
