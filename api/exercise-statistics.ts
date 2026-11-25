import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import {
  getAccessibleUserProfile,
  getAuthenticatedUser,
  handleOptions,
  setApiHeaders,
} from "../server/auth.js";
import { db } from "../server/db/index.js";
import {
  patientPracticeReviews,
  practiceReviewNotifications,
} from "../server/db/schema.js";
import { sendPracticeReviewPushNotification } from "../server/web-push-service.js";
import { getExerciseStatisticsForUser } from "../server/exercise-statistics-service.js";
import {
  exerciseStatisticsQuerySchema,
  practiceReviewNotificationRequestSchema,
  practiceReviewViewRequestSchema,
  getZodErrorMessage,
} from "../src/lib/validation.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res, "GET,POST,PATCH,OPTIONS")) {
    return;
  }

  setApiHeaders(req, res, "GET,POST,PATCH,OPTIONS");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET" && req.method !== "POST" && req.method !== "PATCH") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const authenticatedUser = await getAuthenticatedUser(req, res);
    if (!authenticatedUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (req.method !== "GET") {
      if (authenticatedUser.role !== "clinician") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const bodyResult =
        req.method === "PATCH"
          ? practiceReviewViewRequestSchema.safeParse(req.body)
          : practiceReviewNotificationRequestSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({ error: getZodErrorMessage(bodyResult.error) });
        return;
      }

      const patient = await getAccessibleUserProfile(
        authenticatedUser,
        bodyResult.data.userId,
      );
      if (
        patient?.role !== "patient" ||
        patient.clinicianUserId !== authenticatedUser.id
      ) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const review = {
        patientUserId: patient.workosUserId,
        clinicianUserId: authenticatedUser.id,
      };
      if ("viewId" in bodyResult.data) {
        await db
          .insert(patientPracticeReviews)
          .values({ ...review, viewId: bodyResult.data.viewId })
          .onConflictDoNothing();
        res.status(204).end();
        return;
      }

      const { requestId } = bodyResult.data;
      const notification = practiceReviewNotifications;
      const matchingRequest = and(
        eq(notification.patientUserId, review.patientUserId),
        eq(notification.clinicianUserId, review.clinicianUserId),
        eq(notification.requestId, requestId),
      );
      const inserted = await db
        .insert(notification)
        .values({ ...review, requestId })
        .onConflictDoNothing()
        .returning();
      if (inserted.length === 0) {
        const [existing] = await db
          .select({ sentAt: notification.sentAt })
          .from(notification)
          .where(matchingRequest);
        res.status(200).json({ sent: Number(Boolean(existing?.sentAt)) });
        return;
      }

      const sent = await sendPracticeReviewPushNotification(
        review.patientUserId,
        async (sentAt) => {
          await db.update(notification).set({ sentAt }).where(matchingRequest);
        },
      );
      res.status(200).json({ sent: Number(sent > 0) });
      return;
    }

    const queryResult = exerciseStatisticsQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).json({ error: getZodErrorMessage(queryResult.error) });
      return;
    }

    const targetUserId = queryResult.data.userId ?? authenticatedUser.id;
    const accessibleProfile = await getAccessibleUserProfile(
      authenticatedUser,
      targetUserId,
    );
    if (!accessibleProfile) {
      res.status(targetUserId === authenticatedUser.id ? 404 : 403).json({
        error:
          targetUserId === authenticatedUser.id
            ? "User profile not found"
            : "Forbidden",
      });
      return;
    }

    const exercises = await getExerciseStatisticsForUser(
      targetUserId,
      queryResult.data.timeZone,
    );

    res.status(200).json({ exercises });
  } catch (error) {
    console.error("Error handling exercise statistics:", error);
    const message =
      req.method === "GET"
        ? "Failed to fetch exercise statistics"
        : "Failed to record practice review activity";
    res.status(500).json({ error: message });
  }
}
