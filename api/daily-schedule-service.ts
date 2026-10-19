import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "./db/index.js";
import {
  performedReps,
  treatmentPlanExercises,
  treatmentPlans,
} from "./db/schema.js";
import { ensureSessionTimesForUser } from "./session-times-service.js";
import {
  createDateInTimeZone,
  getDateKeyInTimeZone,
  getNextDateKey,
  getPracticeTimeKeyInTimeZone,
} from "./timezone-utils.js";

type PlanRow = {
  id: number;
  sessionsPerDay: number;
  effectiveDate: string;
  effectiveSessionIndex: number;
  createdAt: Date;
};

export type DailyScheduleRow = {
  id: number;
  practiceTime: string;
  exerciseName: string;
  performedRepId: number | null;
  treatmentPlanExerciseId: number;
  sessionIndex: number;
  repIndex: number;
  isSuperseded: boolean;
};

function resolvePlanForSession(
  plans: PlanRow[],
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

export async function getDailyScheduleForUser(
  userId: string,
  timeZone: string,
  dateKey = getDateKeyInTimeZone(new Date(), timeZone),
): Promise<DailyScheduleRow[]> {
  const plans = await db
    .select({
      id: treatmentPlans.id,
      sessionsPerDay: treatmentPlans.sessionsPerDay,
      effectiveDate: treatmentPlans.effectiveDate,
      effectiveSessionIndex: treatmentPlans.effectiveSessionIndex,
      createdAt: treatmentPlans.createdAt,
    })
    .from(treatmentPlans)
    .where(eq(treatmentPlans.patientUserId, userId))
    .orderBy(
      asc(treatmentPlans.effectiveDate),
      asc(treatmentPlans.effectiveSessionIndex),
      asc(treatmentPlans.createdAt),
      asc(treatmentPlans.id),
    );

  if (plans.length === 0) return [];

  const latestPlanVersion = plans.reduce((latest, plan) => {
    const createdAtDifference =
      plan.createdAt.getTime() - latest.createdAt.getTime();
    if (createdAtDifference !== 0) {
      return createdAtDifference > 0 ? plan : latest;
    }
    return plan.id > latest.id ? plan : latest;
  });
  const maxSessions = Math.max(...plans.map((plan) => plan.sessionsPerDay), 1);
  const timeRows = await ensureSessionTimesForUser(userId, maxSessions, timeZone);
  const timeByIndex = new Map(
    timeRows.map((row) => [row.sessionIndex, row.localTime.slice(0, 5)]),
  );
  const applicablePlans = new Map<number, PlanRow>();
  for (let sessionIndex = 1; sessionIndex <= 10; sessionIndex += 1) {
    const plan = resolvePlanForSession(plans, dateKey, sessionIndex);
    if (plan && sessionIndex <= plan.sessionsPerDay) {
      applicablePlans.set(sessionIndex, plan);
    }
  }

  const planIds = [...new Set([...applicablePlans.values()].map((plan) => plan.id))];
  if (planIds.length === 0) return [];

  const [exerciseRows, performedRows] = await Promise.all([
    db
      .select({
        id: treatmentPlanExercises.id,
        treatmentPlanId: treatmentPlanExercises.treatmentPlanId,
        exerciseCode: treatmentPlanExercises.exerciseCode,
        repsPerSession: treatmentPlanExercises.repsPerSession,
      })
      .from(treatmentPlanExercises)
      .where(inArray(treatmentPlanExercises.treatmentPlanId, planIds))
      .orderBy(asc(treatmentPlanExercises.id)),
    db
      .select({
        id: performedReps.id,
        treatmentPlanExerciseId: performedReps.treatmentPlanExerciseId,
        sessionIndex: performedReps.sessionIndex,
        repIndex: performedReps.repIndex,
      })
      .from(performedReps)
      .where(
        and(
          eq(performedReps.patientUserId, userId),
          eq(performedReps.scheduledDate, dateKey),
        ),
      ),
  ]);

  const performedBySlot = new Map<string, number>();
  for (const row of performedRows) {
    if (
      row.treatmentPlanExerciseId === null ||
      row.sessionIndex === null ||
      row.repIndex === null
    ) {
      continue;
    }
    performedBySlot.set(
      `${row.sessionIndex}:${row.treatmentPlanExerciseId}:${row.repIndex}`,
      row.id,
    );
  }

  const exercisesByPlan = new Map<number, typeof exerciseRows>();
  for (const exercise of exerciseRows) {
    const rows = exercisesByPlan.get(exercise.treatmentPlanId) ?? [];
    rows.push(exercise);
    exercisesByPlan.set(exercise.treatmentPlanId, rows);
  }

  const result: DailyScheduleRow[] = [];
  let syntheticId = 1;
  for (const [sessionIndex, plan] of applicablePlans) {
    const localTime = timeByIndex.get(sessionIndex);
    if (!localTime) continue;
    const practiceTime = createDateInTimeZone(dateKey, localTime, timeZone);
    for (const exercise of exercisesByPlan.get(plan.id) ?? []) {
      for (let repIndex = 1; repIndex <= exercise.repsPerSession; repIndex += 1) {
        result.push({
          id: syntheticId,
          practiceTime: practiceTime.toISOString(),
          exerciseName: exercise.exerciseCode,
          performedRepId:
            performedBySlot.get(`${sessionIndex}:${exercise.id}:${repIndex}`) ??
            null,
          treatmentPlanExerciseId: exercise.id,
          sessionIndex,
          repIndex,
          isSuperseded:
            latestPlanVersion.effectiveDate > dateKey ||
            (latestPlanVersion.effectiveDate === dateKey &&
              sessionIndex < latestPlanVersion.effectiveSessionIndex),
        });
        syntheticId += 1;
      }
    }
  }

  return result;
}

export function selectCurrentSessionIndex(
  rows: DailyScheduleRow[],
  timeZone: string,
  practiceTimeKey?: string,
) {
  if (practiceTimeKey) {
    return (
      rows.find(
        (row) =>
          getPracticeTimeKeyInTimeZone(new Date(row.practiceTime), timeZone) ===
          practiceTimeKey,
      )?.sessionIndex ?? null
    );
  }

  const currentRows = rows.filter((row) => !row.isSuperseded);
  const now = new Date();
  const sessionRows = new Map<number, DailyScheduleRow[]>();
  for (const row of currentRows) {
    const group = sessionRows.get(row.sessionIndex) ?? [];
    group.push(row);
    sessionRows.set(row.sessionIndex, group);
  }
  const sessions = [...sessionRows.entries()].sort(
    (left, right) =>
      new Date(left[1][0]!.practiceTime).getTime() -
      new Date(right[1][0]!.practiceTime).getTime(),
  );
  const due = sessions.filter(
    ([, group]) => new Date(group[0]!.practiceTime) <= now,
  );
  const latestDue = due.at(-1);
  if (latestDue?.[1].some((row) => row.performedRepId === null)) {
    return latestDue[0];
  }
  return (
    sessions.find(
      ([, group]) =>
        new Date(group[0]!.practiceTime) > now &&
        group.some((row) => row.performedRepId === null),
    )?.[0] ?? null
  );
}

export async function getPlanActivationBoundary(
  userId: string,
  timeZone: string,
  nextSessionsPerDay: number,
) {
  const today = getDateKeyInTimeZone(new Date(), timeZone);
  const rows = await getDailyScheduleForUser(userId, timeZone, today);
  if (rows.length === 0) {
    return { effectiveDate: today, effectiveSessionIndex: 1 };
  }
  const currentSessionIndex = selectCurrentSessionIndex(rows, timeZone);
  const maxSessionIndex = Math.max(
    nextSessionsPerDay,
    ...rows.map((row) => row.sessionIndex),
  );
  if (currentSessionIndex !== null && currentSessionIndex < maxSessionIndex) {
    return {
      effectiveDate: today,
      effectiveSessionIndex: currentSessionIndex + 1,
    };
  }
  return {
    effectiveDate: getNextDateKey(today),
    effectiveSessionIndex: 1,
  };
}
