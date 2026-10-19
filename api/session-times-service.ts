import { and, asc, eq, inArray, lte, or } from "drizzle-orm";
import { db } from "./db/index.js";
import { sessionTimes, treatmentPlans, users } from "./db/schema.js";
import { buildDefaultSessionTimes } from "./timezone-utils.js";

function normalizeLocalTime(value: string) {
  return value.slice(0, 5);
}

export async function getLatestSessionsPerDay(userId: string) {
  const rows = await db
    .select({ sessionsPerDay: treatmentPlans.sessionsPerDay })
    .from(treatmentPlans)
    .where(eq(treatmentPlans.patientUserId, userId))
    .orderBy(asc(treatmentPlans.createdAt), asc(treatmentPlans.id));
  return rows.at(-1)?.sessionsPerDay ?? 0;
}

export async function ensureSessionTimesForUser(
  userId: string,
  requiredCount: number,
  timeZone: string,
) {
  await db
    .update(users)
    .set({ timeZone })
    .where(eq(users.workosUserId, userId));

  const count = Math.min(Math.max(requiredCount, 0), 10);
  if (count === 0) return [];

  const existing = await db
    .select()
    .from(sessionTimes)
    .where(eq(sessionTimes.userId, userId))
    .orderBy(asc(sessionTimes.sessionIndex));
  const existingIndexes = new Set(existing.map((row) => row.sessionIndex));
  const usedTimes = new Set(existing.map((row) => normalizeLocalTime(row.localTime)));
  const defaults = buildDefaultSessionTimes(count);
  const values: Array<{
    userId: string;
    sessionIndex: number;
    localTime: string;
  }> = [];

  for (let sessionIndex = 1; sessionIndex <= count; sessionIndex += 1) {
    if (existingIndexes.has(sessionIndex)) continue;
    let localTime = defaults[sessionIndex - 1] ?? "08:00";
    let minutes =
      Number(localTime.slice(0, 2)) * 60 + Number(localTime.slice(3, 5));
    while (usedTimes.has(localTime)) {
      minutes = (minutes + 15) % (24 * 60);
      localTime = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    }
    usedTimes.add(localTime);
    values.push({ userId, sessionIndex, localTime });
  }

  if (values.length > 0) {
    await db.insert(sessionTimes).values(values).onConflictDoNothing();
  }

  return db
    .select()
    .from(sessionTimes)
    .where(
      and(
        eq(sessionTimes.userId, userId),
        inArray(
          sessionTimes.sessionIndex,
          Array.from({ length: count }, (_, index) => index + 1),
        ),
      ),
    )
    .orderBy(asc(sessionTimes.sessionIndex));
}

export async function getSessionTimesForUser(userId: string, timeZone: string) {
  const count = await getLatestSessionsPerDay(userId);
  return ensureSessionTimesForUser(userId, count, timeZone);
}

export async function updateSessionTimesForUser(
  userId: string,
  timeZone: string,
  localTimes: string[],
) {
  const expectedCount = await getLatestSessionsPerDay(userId);
  if (localTimes.length !== expectedCount) {
    throw new Error("Session times count must match the current treatment plan");
  }

  const normalizedTimes = localTimes.map(normalizeLocalTime);
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ timeZone })
      .where(eq(users.workosUserId, userId));
    await tx
      .delete(sessionTimes)
      .where(
        and(
          eq(sessionTimes.userId, userId),
          or(
            lte(sessionTimes.sessionIndex, expectedCount),
            inArray(sessionTimes.localTime, normalizedTimes),
          ),
        ),
      );
    if (normalizedTimes.length > 0) {
      await tx.insert(sessionTimes).values(
        normalizedTimes.map((localTime, index) => ({
          userId,
          sessionIndex: index + 1,
          localTime,
        })),
      );
    }
  });

  return getSessionTimesForUser(userId, timeZone);
}
