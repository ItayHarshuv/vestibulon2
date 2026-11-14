import { timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendDuePracticeReminders } from "../../server/web-push-service.js";

function isAuthorized(req: VercelRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = req.headers.authorization;
  if (!secret || typeof authorization !== "string") {
    return false;
  }

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const sent = await sendDuePracticeReminders();
    res.status(200).json({ sent });
  } catch (error) {
    console.error("Error sending due practice reminders:", error);
    res.status(500).json({ error: "Failed to send practice reminders" });
  }
}
