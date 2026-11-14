import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getAuthenticatedUser,
  handleOptions,
  setApiHeaders,
} from "../../auth.js";
import {
  getVapidPublicKey,
  savePushSubscription,
} from "../../web-push-service.js";
import {
  getZodErrorMessage,
  pushSubscriptionBodySchema,
} from "../../../src/lib/validation.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res, "GET,POST,OPTIONS")) return;
  setApiHeaders(req, res, "GET,POST,OPTIONS");

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (req.method === "GET") {
      res.status(200).json({ publicKey: getVapidPublicKey() });
      return;
    }

    if (req.method === "POST") {
      const parsed = pushSubscriptionBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: getZodErrorMessage(parsed.error) });
        return;
      }

      await savePushSubscription(user.id, parsed.data.subscription);
      res.status(204).end();
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling push subscription:", error);
    res.status(500).json({ error: "Failed to handle push subscription" });
  }
}
