import { and, asc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import webPush from "web-push";
import { db } from "./db/index.js";
import {
  pushSubscriptions,
  sessionTimes,
  treatmentPlans,
  users,
} from "./db/schema.js";

type StoredSubscription = {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type ReminderPlan = {
  id: number;
  userId: string;
  sessionsPerDay: number;
  effectiveDate: string;
  effectiveSessionIndex: number;
  createdAt: Date;
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function configureWebPush() {
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT?.trim() ?? "mailto:admin@vestibulon.app",
    getRequiredEnv("VAPID_PUBLIC_KEY"),
    getRequiredEnv("VAPID_PRIVATE_KEY"),
  );
}

function toWebPushSubscription(subscription: StoredSubscription) {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };
}

function isExpiredSubscriptionError(error: unknown) {
  if (!error || typeof error !== "object" || !("statusCode" in error)) {
    return false;
  }
  return error.statusCode === 404 || error.statusCode === 410;
}

async function sendNotification(
  subscription: StoredSubscription,
  payload: object,
) {
  configureWebPush();
  try {
    await webPush.sendNotification(
      toWebPushSubscription(subscription),
      JSON.stringify(payload),
    );
    return true;
  } catch (error) {
    if (isExpiredSubscriptionError(error)) {
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.id, subscription.id));
      return false;
    }
    throw error;
  }
}

export function getVapidPublicKey() {
  return getRequiredEnv("VAPID_PUBLIC_KEY");
}

export async function savePushSubscription(
  userId: string,
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  },
) {
  await db
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        updatedAt: new Date(),
      },
    });
}

export async function sendTestPushNotifications(userId: string) {
  const subscriptions = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  await Promise.all(
    subscriptions.map((subscription) =>
      sendNotification(subscription, {
        title: "בדיקת התראה",
        body: "ההתראות של Vestibulon פועלות בהצלחה",
        tag: "notification-test",
        url: "/schedule",
      }),
    ),
  );

  return subscriptions.length;
}

export async function sendChatPushNotifications(userId: string) {
  const subscriptions = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  await Promise.all(
    subscriptions.map((subscription) =>
      sendNotification(subscription, {
        title: "הודעה חדשה",
        body: "מחכה לך הודעה חדשה ב-Vestibulon",
        tag: "chat-message",
        url: "/messages",
      }),
    ),
  );

  return subscriptions.length;
}

function getLocalDateAndTime(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`,
  };
}

function isSessionActiveForDate(
  plans: ReminderPlan[],
  localDate: string,
  sessionIndex: number,
) {
  const plan =
    plans
      .filter(
        (candidate) =>
          candidate.effectiveDate < localDate ||
          (candidate.effectiveDate === localDate &&
            candidate.effectiveSessionIndex <= sessionIndex),
      )
      .at(-1) ?? null;
  return plan !== null && sessionIndex <= plan.sessionsPerDay;
}

export async function sendDuePracticeReminders(now = new Date()) {
  const rows = await db
    .select({
      id: pushSubscriptions.id,
      userId: pushSubscriptions.userId,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
      lastNotificationKey: pushSubscriptions.lastNotificationKey,
      timeZone: users.timeZone,
      sessionIndex: sessionTimes.sessionIndex,
      localTime: sessionTimes.localTime,
    })
    .from(pushSubscriptions)
    .innerJoin(users, eq(users.workosUserId, pushSubscriptions.userId))
    .innerJoin(
      sessionTimes,
      eq(sessionTimes.userId, pushSubscriptions.userId),
    );

  if (rows.length === 0) {
    return 0;
  }

  const userIds = [...new Set(rows.map((row) => row.userId))];
  const planRows = await db
    .select({
      id: treatmentPlans.id,
      userId: treatmentPlans.patientUserId,
      sessionsPerDay: treatmentPlans.sessionsPerDay,
      effectiveDate: treatmentPlans.effectiveDate,
      effectiveSessionIndex: treatmentPlans.effectiveSessionIndex,
      createdAt: treatmentPlans.createdAt,
    })
    .from(treatmentPlans)
    .where(inArray(treatmentPlans.patientUserId, userIds))
    .orderBy(
      asc(treatmentPlans.patientUserId),
      asc(treatmentPlans.effectiveDate),
      asc(treatmentPlans.effectiveSessionIndex),
      asc(treatmentPlans.createdAt),
      asc(treatmentPlans.id),
    );
  const plansByUser = new Map<string, ReminderPlan[]>();
  for (const plan of planRows) {
    const userPlans = plansByUser.get(plan.userId) ?? [];
    userPlans.push(plan);
    plansByUser.set(plan.userId, userPlans);
  }

  let sent = 0;
  for (const row of rows) {
    const local = getLocalDateAndTime(now, row.timeZone);
    if (
      row.localTime.slice(0, 5) !== local.time ||
      !isSessionActiveForDate(
        plansByUser.get(row.userId) ?? [],
        local.date,
        row.sessionIndex,
      )
    ) {
      continue;
    }

    const notificationKey = `${local.date}:${row.sessionIndex}`;
    const claimed = await db
      .update(pushSubscriptions)
      .set({ lastNotificationKey: notificationKey, updatedAt: new Date() })
      .where(
        and(
          eq(pushSubscriptions.id, row.id),
          or(
            isNull(pushSubscriptions.lastNotificationKey),
            ne(pushSubscriptions.lastNotificationKey, notificationKey),
          ),
        ),
      )
      .returning();
    if (claimed.length === 0) {
      continue;
    }

    const didSend = await sendNotification(row, {
      title: "הגיע הזמן לתרגל!",
      body: `יש להשלים את התרגול של השעה ${row.localTime.slice(0, 5)}`,
      tag: notificationKey,
      url: "/select-exercise",
    });
    if (didSend) {
      sent += 1;
    }
  }

  return sent;
}
