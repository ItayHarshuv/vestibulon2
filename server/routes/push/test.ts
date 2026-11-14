import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getAuthenticatedUser,
  handleOptions,
  setApiHeaders,
} from "../../auth.js";
import { sendTestPushNotifications } from "../../web-push-service.js";

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

    const sent = await sendTestPushNotifications(user.id);
    res.status(200).json({ sent });
  } catch (error) {
    console.error("Error sending test push notification:", error);
    res.status(500).json({ error: "Failed to send test push notification" });
  }
}
