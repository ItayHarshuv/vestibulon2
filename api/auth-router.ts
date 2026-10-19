import type { VercelRequest, VercelResponse } from "@vercel/node";
import passwordResetHandler from "../server/routes/auth/password-reset.js";
import sessionHandler from "../server/routes/auth/session.js";
import signInHandler from "../server/routes/auth/sign-in.js";
import signOutHandler from "../server/routes/auth/sign-out.js";
import signUpHandler from "../server/routes/auth/sign-up.js";

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown;

const handlers: Record<string, ApiHandler> = {
  "password-reset": passwordResetHandler,
  session: sessionHandler,
  "sign-in": signInHandler,
  "sign-out": signOutHandler,
  "sign-up": signUpHandler,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const actionValue = req.query.action;
  const action = Array.isArray(actionValue) ? actionValue[0] : actionValue;
  const actionHandler = action ? handlers[action] : undefined;

  if (!actionHandler) {
    res.status(404).json({ error: "Authentication route not found" });
    return;
  }

  await actionHandler(req, res);
}
