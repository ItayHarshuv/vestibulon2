import type { VercelRequest, VercelResponse } from "@vercel/node";
import subscriptionsHandler from "../server/routes/push/subscriptions.js";
import testHandler from "../server/routes/push/test.js";

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown;

const handlers: Record<string, ApiHandler> = {
  subscriptions: subscriptionsHandler,
  test: testHandler,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const actionValue = req.query.action;
  const action = Array.isArray(actionValue) ? actionValue[0] : actionValue;
  const actionHandler = action ? handlers[action] : undefined;

  if (!actionHandler) {
    res.status(404).json({ error: "Push route not found" });
    return;
  }

  await actionHandler(req, res);
}
