import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import {
  getAuthenticatedUser,
  handleOptions,
  setApiHeaders,
} from "../server/auth.js";
import { db } from "../server/db/index.js";
import { patientAppUsageIntervals } from "../server/db/schema.js";

const bodySchema = z.object({
  userId: z.string().min(1),
  intervals: z
    .array(
      z.object({
        intervalId: z.string().uuid(),
        startedAt: z.string().datetime(),
        endedAt: z.string().datetime(),
      }),
    )
    .min(1)
    .max(120),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res, "POST,OPTIONS")) return;
  setApiHeaders(req, res, "POST,OPTIONS");
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid usage intervals" });
      return;
    }
    if (user.role !== "patient" || user.id !== parsed.data.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const now = Date.now();
    const intervals = parsed.data.intervals.map((interval) => ({
      patientUserId: user.id,
      intervalId: interval.intervalId,
      startedAt: new Date(interval.startedAt),
      endedAt: new Date(interval.endedAt),
    }));
    if (
      intervals.some(({ startedAt, endedAt }) => {
        const duration = endedAt.getTime() - startedAt.getTime();
        return (
          duration <= 0 || duration > 30_000 || endedAt.getTime() > now + 60_000
        );
      })
    ) {
      res
        .status(400)
        .json({ error: "Invalid usage interval duration or timestamp" });
      return;
    }

    await db
      .insert(patientAppUsageIntervals)
      .values(intervals)
      .onConflictDoNothing();
    res.status(204).end();
  } catch (error) {
    console.error("Error recording app usage:", error);
    res.status(500).json({ error: "Failed to record app usage" });
  }
}
