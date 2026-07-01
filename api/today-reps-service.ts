import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "./db/index.js";
import { prescribedExercises, todayReps, users } from "./db/schema.js";

function getTimeZoneParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter(
        (part): part is Intl.DateTimeFormatPart & {
          type: "year" | "month" | "day" | "hour" | "minute" | "second";
        } =>
          part.type === "year" ||
          part.type === "month" ||
          part.type === "day" ||
          part.type === "hour" ||
          part.type === "minute" ||
          part.type === "second",
      )
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year ?? 0,
    month: values.month ?? 0,
    day: values.day ?? 0,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

export function getDateKeyInTimeZone(date: Date, timeZone: string) {
  const { year, month, day } = getTimeZoneParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getPracticeTimeKeyInTimeZone(date: Date, timeZone: string) {
  const { year, month, day, hour, minute } = getTimeZoneParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}-${String(hour).padStart(2, "0")}-${String(minute).padStart(2, "0")}`;
}

function getDistinctSessionPracticeTimes(
  rows: { practiceTime: Date }[],
  timeZone: string,
) {
  const practiceTimesByKey = new Map<string, Date>();

  for (const row of rows) {
    const practiceTimeKey = getPracticeTimeKeyInTimeZone(row.practiceTime, timeZone);
    if (!practiceTimesByKey.has(practiceTimeKey)) {
      practiceTimesByKey.set(practiceTimeKey, row.practiceTime);
    }
  }

  return [...practiceTimesByKey.values()].sort(
    (left, right) => left.getTime() - right.getTime(),
  );
}

function getTodaySessionGroups(
  rows: { id: number; practiceTime: Date }[],
  timeZone: string,
) {
  const groupsByKey = new Map<
    string,
    {
      practiceTime: Date;
      rowIds: number[];
    }
  >();

  for (const row of rows) {
    const practiceTimeKey = getPracticeTimeKeyInTimeZone(row.practiceTime, timeZone);
    const existingGroup = groupsByKey.get(practiceTimeKey);
    if (existingGroup) {
      existingGroup.rowIds.push(row.id);
      continue;
    }

    groupsByKey.set(practiceTimeKey, {
      practiceTime: row.practiceTime,
      rowIds: [row.id],
    });
  }

  return [...groupsByKey.values()].sort(
    (left, right) => left.practiceTime.getTime() - right.practiceTime.getTime(),
  );
}

function compareScheduledRows(
  left: { exerciseName: string; practiceTime: Date },
  right: { exerciseName: string; practiceTime: Date },
) {
  const timeDifference = left.practiceTime.getTime() - right.practiceTime.getTime();
  if (timeDifference !== 0) {
    return timeDifference;
  }

  return left.exerciseName.localeCompare(right.exerciseName);
}

// Convert a wall-clock time in the given timezone into a UTC Date for storage.
function createDateInTimeZone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const observed = getTimeZoneParts(new Date(utcGuess), timeZone);
  const offsetMs =
    Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
    ) - utcGuess;

  return new Date(utcGuess - offsetMs);
}

function roundToQuarterHour(totalMinutes: number) {
  return Math.round(totalMinutes / 15) * 15;
}

function buildPracticeTimes(totalSessions: number, timeZone: string) {
  if (totalSessions === 0) {
    return [];
  }

  const { year, month, day } = getTimeZoneParts(new Date(), timeZone);
  const startMinutes = 8 * 60;
  const endMinutes = 20 * 60;

  if (totalSessions === 1) {
    return [createDateInTimeZone(year, month, day, 8, 0, timeZone)];
  }

  return Array.from({ length: totalSessions }, (_, index) => {
    const totalSpanMinutes = endMinutes - startMinutes;
    const plannedMinutes =
      index === 0
        ? startMinutes
        : index === totalSessions - 1
          ? endMinutes
          : roundToQuarterHour(
              startMinutes + (totalSpanMinutes * index) / (totalSessions - 1),
            );

    return createDateInTimeZone(
      year,
      month,
      day,
      Math.floor(plannedMinutes / 60),
      plannedMinutes % 60,
      timeZone,
    );
  });
}

function parseSessionTime(sessionTime: string) {
  const [hour, minute] = sessionTime.split(":").map(Number);
  return { hour: hour ?? 0, minute: minute ?? 0 };
}

export async function ensureTodayRepsForUser(
  userId: string,
  timeZone: string,
) {
  getTimeZoneParts(new Date(), timeZone);
  const todayKey = getDateKeyInTimeZone(new Date(), timeZone);

  const existingRows = await db
    .select({
      exerciseName: todayReps.exerciseName,
      practiceTime: todayReps.practiceTime,
    })
    .from(todayReps)
    .where(eq(todayReps.userId, userId))
    .orderBy(asc(todayReps.practiceTime), asc(todayReps.id));

  const userProfileRows = await db
    .select({
      numberOfSessions: users.numberOfSessions,
    })
    .from(users)
    .where(eq(users.workosUserId, userId))
    .limit(1);

  const numberOfSessions = Math.max(userProfileRows[0]?.numberOfSessions ?? 1, 1);

  const activePrescribedExercises = await db
    .select({
      exerciseName: prescribedExercises.exerciseName,
      numberOfRepetions: prescribedExercises.numberOfRepetions,
    })
    .from(prescribedExercises)
    .where(and(eq(prescribedExercises.userId, userId), eq(prescribedExercises.active, true)))
    .orderBy(prescribedExercises.createdAt, prescribedExercises.id);

  const existingTodayRows = existingRows.filter(
    (row) => getDateKeyInTimeZone(row.practiceTime, timeZone) === todayKey,
  );
  const existingTodaySessionPracticeTimes = getDistinctSessionPracticeTimes(
    existingTodayRows,
    timeZone,
  );
  const sessionPracticeTimes =
    existingTodaySessionPracticeTimes.length === numberOfSessions
      ? existingTodaySessionPracticeTimes
      : buildPracticeTimes(numberOfSessions, timeZone);
  const scheduledRows = activePrescribedExercises.flatMap((prescribedExercise) =>
    sessionPracticeTimes.flatMap((practiceTime) =>
      Array.from({ length: prescribedExercise.numberOfRepetions }, () => ({
        exerciseName: prescribedExercise.exerciseName,
        practiceTime,
      })),
    ),
  );
  const sortedExistingTodayRows = [...existingTodayRows].sort(compareScheduledRows);
  const sortedScheduledRows = [...scheduledRows].sort(compareScheduledRows);
  const matchesExpectedSchedule =
    existingRows.length === existingTodayRows.length &&
    sortedExistingTodayRows.length === sortedScheduledRows.length &&
    sortedExistingTodayRows.every((row, index) => {
      const expectedRow = sortedScheduledRows[index];
      return (
        row.exerciseName === expectedRow?.exerciseName &&
        row.practiceTime.getTime() === expectedRow?.practiceTime.getTime()
      );
    });

  if (matchesExpectedSchedule) {
    return { recreated: false, rowsCreated: 0 };
  }

  await db.delete(todayReps).where(eq(todayReps.userId, userId));

  if (scheduledRows.length === 0) {
    return { recreated: true, rowsCreated: 0 };
  }

  await db.insert(todayReps).values(
    scheduledRows.map((row) => ({
      userId,
      exerciseName: row.exerciseName,
      practiceTime: row.practiceTime,
    })),
  );

  return { recreated: true, rowsCreated: scheduledRows.length };
}

export async function getTodayRepRowsForUser(
  userId: string,
  timeZone: string,
  exerciseName?: string,
) {
  const rows = await db
    .select({
      id: todayReps.id,
      practiceTime: todayReps.practiceTime,
      exerciseName: todayReps.exerciseName,
      performedRepId: todayReps.performedRepId,
    })
    .from(todayReps)
    .where(eq(todayReps.userId, userId))
    .orderBy(asc(todayReps.practiceTime), asc(todayReps.id));

  const todayKey = getDateKeyInTimeZone(new Date(), timeZone);

  return rows.filter((row) => {
    if (getDateKeyInTimeZone(row.practiceTime, timeZone) !== todayKey) {
      return false;
    }

    if (exerciseName && row.exerciseName !== exerciseName) {
      return false;
    }

    return true;
  });
}

export async function assignPerformedRepToTodayRepSlot(
  userId: string,
  exerciseName: string,
  performedRepId: number,
  timeZone: string,
  practiceTimeKey?: string,
) {
  const now = new Date();
  const scheduledRows = await getTodayRepRowsForUser(userId, timeZone, exerciseName);
  if (practiceTimeKey) {
    const targetedRow =
      scheduledRows.find(
        (candidateRow) =>
          getPracticeTimeKeyInTimeZone(candidateRow.practiceTime, timeZone) ===
            practiceTimeKey && candidateRow.performedRepId === null,
      ) ?? null;

    if (!targetedRow) {
      return false;
    }

    await db
      .update(todayReps)
      .set({ performedRepId })
      .where(eq(todayReps.id, targetedRow.id));
    return true;
  }

  const pastOrCurrentRows = scheduledRows.filter((row) => row.practiceTime <= now);
  const latestScheduledRow = pastOrCurrentRows[pastOrCurrentRows.length - 1];
  const latestDuePracticeTimeKey = latestScheduledRow
    ? getPracticeTimeKeyInTimeZone(latestScheduledRow.practiceTime, timeZone)
    : null;
  const row =
    (latestDuePracticeTimeKey
      ? scheduledRows.find(
          (candidateRow) =>
            getPracticeTimeKeyInTimeZone(candidateRow.practiceTime, timeZone) ===
              latestDuePracticeTimeKey && candidateRow.performedRepId === null,
        ) ?? null
      : null) ??
    scheduledRows.find(
      (candidateRow) => candidateRow.practiceTime > now && candidateRow.performedRepId === null,
    );

  if (!row) {
    return false;
  }

  await db.update(todayReps).set({ performedRepId }).where(eq(todayReps.id, row.id));
  return true;
}

function getCurrentSessionCutoffPracticeTime(
  rows: { practiceTime: Date; performedRepId: number | null }[],
  timeZone: string,
  now: Date,
) {
  const scheduledRows = [...rows].sort(
    (left, right) => left.practiceTime.getTime() - right.practiceTime.getTime(),
  );
  const pastOrCurrentRows = scheduledRows.filter((row) => row.practiceTime <= now);
  const latestScheduledRow = pastOrCurrentRows[pastOrCurrentRows.length - 1];
  const latestDuePracticeTimeKey = latestScheduledRow
    ? getPracticeTimeKeyInTimeZone(latestScheduledRow.practiceTime, timeZone)
    : null;

  if (latestDuePracticeTimeKey) {
    const latestDuePendingRow = scheduledRows.find(
      (row) =>
        getPracticeTimeKeyInTimeZone(row.practiceTime, timeZone) ===
          latestDuePracticeTimeKey && row.performedRepId === null,
    );

    if (latestDuePendingRow) {
      return latestDuePendingRow.practiceTime;
    }
  }

  const nextPendingRow = scheduledRows.find(
    (row) => row.practiceTime > now && row.performedRepId === null,
  );
  if (nextPendingRow) {
    return nextPendingRow.practiceTime;
  }

  if (latestScheduledRow) {
    return latestScheduledRow.practiceTime;
  }

  return null;
}

export async function applyTreatmentPlanToTodaySchedule(
  userId: string,
  timeZone: string,
) {
  const now = new Date();
  const todayKey = getDateKeyInTimeZone(now, timeZone);

  const existingRows = await db
    .select({
      id: todayReps.id,
      exerciseName: todayReps.exerciseName,
      practiceTime: todayReps.practiceTime,
      performedRepId: todayReps.performedRepId,
    })
    .from(todayReps)
    .where(eq(todayReps.userId, userId))
    .orderBy(asc(todayReps.practiceTime), asc(todayReps.id));

  const todayRows = existingRows.filter(
    (row) => getDateKeyInTimeZone(row.practiceTime, timeZone) === todayKey,
  );

  const userProfileRows = await db
    .select({
      numberOfSessions: users.numberOfSessions,
    })
    .from(users)
    .where(eq(users.workosUserId, userId))
    .limit(1);

  const numberOfSessions = Math.max(userProfileRows[0]?.numberOfSessions ?? 1, 1);

  const activePrescribedExercises = await db
    .select({
      exerciseName: prescribedExercises.exerciseName,
      numberOfRepetions: prescribedExercises.numberOfRepetions,
    })
    .from(prescribedExercises)
    .where(and(eq(prescribedExercises.userId, userId), eq(prescribedExercises.active, true)))
    .orderBy(prescribedExercises.createdAt, prescribedExercises.id);

  if (todayRows.length === 0) {
    await ensureTodayRepsForUser(userId, timeZone);
    return;
  }

  const cutoffPracticeTime = getCurrentSessionCutoffPracticeTime(
    todayRows,
    timeZone,
    now,
  );

  if (!cutoffPracticeTime) {
    return;
  }

  const keptRows = todayRows.filter(
    (row) => row.practiceTime.getTime() <= cutoffPracticeTime.getTime(),
  );
  const keptSessionTimes = getDistinctSessionPracticeTimes(keptRows, timeZone);
  const futureRowIds = todayRows
    .filter((row) => row.practiceTime.getTime() > cutoffPracticeTime.getTime())
    .map((row) => row.id);

  if (futureRowIds.length > 0) {
    await db.delete(todayReps).where(inArray(todayReps.id, futureRowIds));
  }

  const builtSessionTimes = buildPracticeTimes(numberOfSessions, timeZone);
  const futureSessionTimes = builtSessionTimes.filter(
    (practiceTime) => practiceTime.getTime() > cutoffPracticeTime.getTime(),
  );

  const sessionTimesToSchedule =
    keptSessionTimes.length >= numberOfSessions
      ? []
      : futureSessionTimes.slice(
          0,
          Math.max(numberOfSessions - keptSessionTimes.length, 0),
        );

  if (sessionTimesToSchedule.length === 0 || activePrescribedExercises.length === 0) {
    return;
  }

  const scheduledRows = activePrescribedExercises.flatMap((prescribedExercise) =>
    sessionTimesToSchedule.flatMap((practiceTime) =>
      Array.from({ length: prescribedExercise.numberOfRepetions }, () => ({
        userId,
        exerciseName: prescribedExercise.exerciseName,
        practiceTime,
      })),
    ),
  );

  if (scheduledRows.length > 0) {
    await db.insert(todayReps).values(scheduledRows);
  }
}

export async function updateTodayRepSessionTimesForUser(
  userId: string,
  timeZone: string,
  sessionTimes: string[],
) {
  getTimeZoneParts(new Date(), timeZone);
  await ensureTodayRepsForUser(userId, timeZone);

  const todayRows = await getTodayRepRowsForUser(userId, timeZone);
  const sessionGroups = getTodaySessionGroups(todayRows, timeZone);

  if (sessionGroups.length !== sessionTimes.length) {
    throw new Error("Session times count does not match today's schedule");
  }

  if (sessionGroups.length === 0) {
    return { rowsUpdated: 0 };
  }

  const { year, month, day } = getTimeZoneParts(new Date(), timeZone);
  const nextPracticeTimes = [...sessionTimes]
    .sort((left, right) => left.localeCompare(right))
    .map((sessionTime) => {
      const { hour, minute } = parseSessionTime(sessionTime);
      return createDateInTimeZone(year, month, day, hour, minute, timeZone);
    });

  for (const [index, sessionGroup] of sessionGroups.entries()) {
    const nextPracticeTime = nextPracticeTimes[index];
    if (!nextPracticeTime) {
      continue;
    }

    await db
      .update(todayReps)
      .set({ practiceTime: nextPracticeTime })
      .where(
        and(
          eq(todayReps.userId, userId),
          inArray(todayReps.id, sessionGroup.rowIds),
        ),
      );
  }

  return { rowsUpdated: todayRows.length };
}
