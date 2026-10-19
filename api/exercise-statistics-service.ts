import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "./db/index.js";
import {
  performedReps,
  treatmentPlanExercises,
  treatmentPlans,
} from "./db/schema.js";
import {
  compareDateKeys,
  getDateKeyInTimeZone,
  listDateKeysInclusive,
} from "./timezone-utils.js";

type PlanSnapshot = {
  id: number;
  sessionsPerDay: number;
  effectiveDate: string;
  effectiveSessionIndex: number;
};

export type ExerciseStatisticsDay = {
  date: string;
  plannedReps: number;
  completedReps: number;
  completionPercentage: number;
};

export type ExerciseStatisticsSeries = {
  exerciseName: string;
  startDate: string;
  endDate: string;
  days: ExerciseStatisticsDay[];
};

function resolvePlanForSession(
  plans: PlanSnapshot[],
  dateKey: string,
  sessionIndex: number,
) {
  return (
    plans
      .filter(
        (plan) =>
          plan.effectiveDate < dateKey ||
          (plan.effectiveDate === dateKey &&
            plan.effectiveSessionIndex <= sessionIndex),
      )
      .at(-1) ?? null
  );
}

function getPlannedRepsForDay(
  exerciseName: string,
  plans: PlanSnapshot[],
  exercisesByPlan: Map<
    number,
    Array<{ exerciseName: string; repsPerSession: number }>
  >,
  dateKey: string,
) {
  let plannedReps = 0;
  for (let sessionIndex = 1; sessionIndex <= 10; sessionIndex += 1) {
    const plan = resolvePlanForSession(plans, dateKey, sessionIndex);
    if (!plan || sessionIndex > plan.sessionsPerDay) continue;
    const exercise = (exercisesByPlan.get(plan.id) ?? []).find(
      (candidate) => candidate.exerciseName === exerciseName,
    );
    plannedReps += Math.max(exercise?.repsPerSession ?? 0, 0);
  }
  return plannedReps;
}

export async function getExerciseStatisticsForUser(
  userId: string,
  timeZone: string,
): Promise<ExerciseStatisticsSeries[]> {
  const todayKey = getDateKeyInTimeZone(new Date(), timeZone);

  const planRows = await db
    .select({
      id: treatmentPlans.id,
      sessionsPerDay: treatmentPlans.sessionsPerDay,
      effectiveDate: treatmentPlans.effectiveDate,
      effectiveSessionIndex: treatmentPlans.effectiveSessionIndex,
    })
    .from(treatmentPlans)
    .where(eq(treatmentPlans.patientUserId, userId))
    .orderBy(
      asc(treatmentPlans.effectiveDate),
      asc(treatmentPlans.effectiveSessionIndex),
      asc(treatmentPlans.createdAt),
      asc(treatmentPlans.id),
    );
  const planIds = planRows.map((plan) => plan.id);
  const [exerciseRows, completedRows] = await Promise.all([
    planIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            treatmentPlanId: treatmentPlanExercises.treatmentPlanId,
            exerciseName: treatmentPlanExercises.exerciseCode,
            repsPerSession: treatmentPlanExercises.repsPerSession,
          })
          .from(treatmentPlanExercises)
          .where(inArray(treatmentPlanExercises.treatmentPlanId, planIds))
          .orderBy(asc(treatmentPlanExercises.id)),
    db
      .select({
        exerciseName: treatmentPlanExercises.exerciseCode,
        scheduledDate: performedReps.scheduledDate,
        endTime: performedReps.endTime,
      })
      .from(performedReps)
      .innerJoin(
        treatmentPlanExercises,
        eq(performedReps.treatmentPlanExerciseId, treatmentPlanExercises.id),
      )
      .where(
        and(
          eq(performedReps.patientUserId, userId),
          isNotNull(performedReps.endTime),
        ),
      )
      .orderBy(asc(performedReps.endTime), asc(performedReps.id)),
  ]);
  const exercisesByPlan = new Map<
    number,
    Array<{ exerciseName: string; repsPerSession: number }>
  >();
  const exerciseNames = new Set<string>();
  const startDateByExercise = new Map<string, string>();
  const planById = new Map(planRows.map((plan) => [plan.id, plan]));
  for (const exercise of exerciseRows) {
    const rows = exercisesByPlan.get(exercise.treatmentPlanId) ?? [];
    rows.push(exercise);
    exercisesByPlan.set(exercise.treatmentPlanId, rows);
    exerciseNames.add(exercise.exerciseName);
    const effectiveDate = planById.get(exercise.treatmentPlanId)?.effectiveDate;
    const currentStart = startDateByExercise.get(exercise.exerciseName);
    if (
      effectiveDate &&
      (!currentStart || compareDateKeys(effectiveDate, currentStart) < 0)
    ) {
      startDateByExercise.set(exercise.exerciseName, effectiveDate);
    }
  }

  const completedRepsByExerciseAndDate = new Map<string, Map<string, number>>();

  for (const row of completedRows) {
    if (!row.endTime) {
      continue;
    }

    const dateKey =
      row.scheduledDate ?? getDateKeyInTimeZone(row.endTime, timeZone);
    const exerciseCounts =
      completedRepsByExerciseAndDate.get(row.exerciseName) ?? new Map<string, number>();
    exerciseCounts.set(dateKey, (exerciseCounts.get(dateKey) ?? 0) + 1);
    completedRepsByExerciseAndDate.set(row.exerciseName, exerciseCounts);
    exerciseNames.add(row.exerciseName);
  }

  const sortedExerciseNames = [...exerciseNames].sort((left, right) =>
    left.localeCompare(right, "he"),
  );

  return sortedExerciseNames.map((exerciseName) => {
    const performedRepDates = [
      ...(completedRepsByExerciseAndDate.get(exerciseName)?.keys() ?? []),
    ];
    const firstPerformedRepDate =
      performedRepDates.sort(compareDateKeys)[0] ?? null;
    const prescribedExerciseStartDate =
      startDateByExercise.get(exerciseName) ?? todayKey;
    const startDate =
      firstPerformedRepDate &&
      compareDateKeys(firstPerformedRepDate, prescribedExerciseStartDate) < 0
        ? firstPerformedRepDate
        : prescribedExerciseStartDate;
    const endDate = todayKey;

    const days = listDateKeysInclusive(startDate, endDate).map((dateKey) => {
      const plannedReps = getPlannedRepsForDay(
        exerciseName,
        planRows,
        exercisesByPlan,
        dateKey,
      );
      const completedReps =
        completedRepsByExerciseAndDate.get(exerciseName)?.get(dateKey) ?? 0;
      const completionPercentage =
        plannedReps > 0
          ? Math.min(100, Math.round((completedReps / plannedReps) * 100))
          : 0;

      return {
        date: dateKey,
        plannedReps,
        completedReps,
        completionPercentage,
      };
    });

    return {
      exerciseName,
      startDate,
      endDate,
      days,
    };
  });
}
