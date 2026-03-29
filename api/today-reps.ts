import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser, handleOptions, setApiHeaders } from "./auth.js";
import {
  ensureTodayRepsForUser,
  getTodayRepRowsForUser,
  updateTodayRepSessionTimesForUser,
} from "./today-reps-service.js";
import {
  getZodErrorMessage,
  syncTodayRepsBodySchema,
  todayRepsQuerySchema,
  updateTodayRepsScheduleBodySchema,
} from "../src/lib/validation.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res, "GET,POST,PATCH,OPTIONS")) {
    return;
  }

  setApiHeaders(req, res, "GET,POST,PATCH,OPTIONS");

  try {
    const authenticatedUser = await getAuthenticatedUser(req, res);
    if (!authenticatedUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (req.method === "GET") {
      const queryResult = todayRepsQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({ error: getZodErrorMessage(queryResult.error) });
        return;
      }

      await ensureTodayRepsForUser(authenticatedUser.id, queryResult.data.timeZone);

      const rows = await getTodayRepRowsForUser(
        authenticatedUser.id,
        queryResult.data.timeZone,
      );

      res.status(200).json(rows);
      return;
    }

    if (req.method === "PATCH") {
      const bodyResult = updateTodayRepsScheduleBodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({ error: getZodErrorMessage(bodyResult.error) });
        return;
      }

      await updateTodayRepSessionTimesForUser(
        authenticatedUser.id,
        bodyResult.data.timeZone,
        bodyResult.data.sessionTimes,
      );

      const rows = await getTodayRepRowsForUser(
        authenticatedUser.id,
        bodyResult.data.timeZone,
      );

      res.status(200).json(rows);
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const bodyResult = syncTodayRepsBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({ error: getZodErrorMessage(bodyResult.error) });
      return;
    }

    const synced = await ensureTodayRepsForUser(authenticatedUser.id, bodyResult.data.timeZone);

    res.status(200).json(synced);
  } catch (error) {
    console.error("Error syncing today's reps:", error);
    res.status(500).json({ error: "Failed to sync today's reps" });
  }
}
