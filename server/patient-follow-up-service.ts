import { and, asc, count, eq, isNotNull } from "drizzle-orm";
import { db } from "./db/index.js";
import {
  conversations,
  messages,
  patientAppUsageIntervals,
  patientPracticeReviews,
  practiceReviewNotifications,
} from "./db/schema.js";

export async function getPatientFollowUp(patientUserId: string) {
  const [reviewPushes, messagePushes, reviews, usageIntervals] =
    await Promise.all([
      db
        .select({ sentAt: practiceReviewNotifications.sentAt })
        .from(practiceReviewNotifications)
        .where(
          and(
            eq(practiceReviewNotifications.patientUserId, patientUserId),
            isNotNull(practiceReviewNotifications.sentAt),
          ),
        ),
      db
        .select({ sentAt: messages.patientPushSentAt })
        .from(conversations)
        .innerJoin(messages, eq(messages.conversationId, conversations.id))
        .where(
          and(
            eq(conversations.patientUserId, patientUserId),
            eq(messages.senderUserId, conversations.clinicianUserId),
            isNotNull(messages.patientPushSentAt),
          ),
        ),
      db
        .select({ total: count() })
        .from(patientPracticeReviews)
        .where(eq(patientPracticeReviews.patientUserId, patientUserId)),
      db
        .select({
          startedAt: patientAppUsageIntervals.startedAt,
          endedAt: patientAppUsageIntervals.endedAt,
        })
        .from(patientAppUsageIntervals)
        .where(eq(patientAppUsageIntervals.patientUserId, patientUserId))
        .orderBy(asc(patientAppUsageIntervals.startedAt)),
    ]);

  const notifications = [
    ...reviewPushes.flatMap(({ sentAt }) =>
      sentAt ? [{ kind: "review" as const, sentAt }] : [],
    ),
    ...messagePushes.flatMap(({ sentAt }) =>
      sentAt ? [{ kind: "message" as const, sentAt }] : [],
    ),
  ].sort((left, right) => left.sentAt.getTime() - right.sentAt.getTime());

  let totalUsageMs = 0;
  let coveredUntil = Number.NEGATIVE_INFINITY;
  for (const { startedAt, endedAt } of usageIntervals) {
    const start = Math.max(startedAt.getTime(), coveredUntil);
    const end = endedAt.getTime();
    totalUsageMs += Math.max(0, end - start);
    coveredUntil = Math.max(coveredUntil, end);
  }

  return {
    notifications,
    appUsageSeconds: Math.floor(totalUsageMs / 1000),
    totalReviews: reviews[0]?.total ?? 0,
  };
}
