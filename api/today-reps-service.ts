import { and, asc, eq } from "drizzle-orm";
import { db } from "./db/index.js";
import { programs, todayReps, userProfiles } from "./db/schema.js";

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

function getDateKeyInTimeZone(date: Date, timeZone: string) {
  const { year, month, day } = getTimeZoneParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getPracticeTimeKeyInTimeZone(date: Date, timeZone: string) {
  const { year, month, day, hour, minute } = getTimeZoneParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}-${String(hour).padStart(2, "0")}-${String(minute).padStart(2, "0")}`;
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
      numberOfSessions: userProfiles.numberOfSessions,
    })
    .from(userProfiles)
    .where(eq(userProfiles.workosUserId, userId))
    .limit(1);

  const numberOfSessions = Math.max(userProfileRows[0]?.numberOfSessions ?? 1, 1);

  const activePrograms = await db
    .select({
      exerciseName: programs.exerciseName,
      numberOfRepetions: programs.numberOfRepetions,
    })
    .from(programs)
    .where(and(eq(programs.userId, userId), eq(programs.active, true)))
    .orderBy(programs.createdAt, programs.id);

  const sessionPracticeTimes = buildPracticeTimes(numberOfSessions, timeZone);
  const scheduledRows = activePrograms.flatMap((program) =>
    sessionPracticeTimes.flatMap((practiceTime) =>
      Array.from({ length: program.numberOfRepetions }, () => ({
        exerciseName: program.exerciseName,
        practiceTime,
      })),
    ),
  );

  const existingTodayRows = existingRows.filter(
    (row) => getDateKeyInTimeZone(row.practiceTime, timeZone) === todayKey,
  );
  const matchesExpectedSchedule =
    existingRows.length === existingTodayRows.length &&
    existingTodayRows.length === scheduledRows.length &&
    existingTodayRows.every((row, index) => {
      const expectedRow = scheduledRows[index];
      return (
        expectedRow !== undefined &&
        row.exerciseName === expectedRow.exerciseName &&
        row.practiceTime.getTime() === expectedRow.practiceTime.getTime()
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
      repId: todayReps.repId,
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

export async function assignRepToTodayRepSlot(
  userId: string,
  exerciseName: string,
  repId: number,
  timeZone: string,
) {
  const now = new Date();
  const scheduledRows = await getTodayRepRowsForUser(userId, timeZone, exerciseName);
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
              latestDuePracticeTimeKey && candidateRow.repId === null,
        ) ?? null
      : null) ??
    scheduledRows.find(
      (candidateRow) => candidateRow.practiceTime > now && candidateRow.repId === null,
    );

  if (!row) {
    return false;
  }

  await db.update(todayReps).set({ repId }).where(eq(todayReps.id, row.id));
  return true;
}
