import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getAccessibleUserProfile,
  getAuthenticatedUser,
  handleOptions,
  setApiHeaders,
} from "./auth.js";
import { getExerciseStatisticsForUser } from "./exercise-statistics-service.js";
import {
  exerciseStatisticsQuerySchema,
  getZodErrorMessage,
} from "../src/lib/validation.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res, "GET,OPTIONS")) {
    return;
  }

  setApiHeaders(req, res, "GET,OPTIONS");

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const authenticatedUser = await getAuthenticatedUser(req, res);
    if (!authenticatedUser) {
      res.status(401).json({ error: "Unauthorized" });
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
          targetUserId === authenticatedUser.id ? "User profile not found" : "Forbidden",
      });
      return;
    }

    const exercises = await getExerciseStatisticsForUser(
      targetUserId,
      queryResult.data.timeZone,
    );

    res.status(200).json({ exercises });
  } catch (error) {
    console.error("Error fetching exercise statistics:", error);
    res.status(500).json({ error: "Failed to fetch exercise statistics" });
  }
}
