import type { VercelRequest, VercelResponse } from "@vercel/node";
import conversationsHandler from "../server/routes/chat/conversations.js";
import messagesHandler from "../server/routes/chat/messages.js";

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown;

const handlers: Record<string, ApiHandler> = {
  conversations: conversationsHandler,
  messages: messagesHandler,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const actionValue = req.query.action;
  const action = Array.isArray(actionValue) ? actionValue[0] : actionValue;
  const actionHandler = action ? handlers[action] : undefined;

  if (!actionHandler) {
    res.status(404).json({ error: "Chat route not found" });
    return;
  }

  await actionHandler(req, res);
}
