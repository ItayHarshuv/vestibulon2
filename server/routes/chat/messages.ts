import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getAuthenticatedUser,
  handleOptions,
  setApiHeaders,
} from "../../auth.js";
import {
  ChatAccessError,
  getChatMessages,
  markChatRead,
  sendChatMessage,
} from "../../chat-service.js";
import { sendChatPushNotifications } from "../../web-push-service.js";
import {
  chatMessagesQuerySchema,
  getZodErrorMessage,
  markChatReadBodySchema,
  sendChatMessageBodySchema,
} from "../../../src/lib/validation.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res, "GET,POST,PATCH,OPTIONS")) return;
  setApiHeaders(req, res, "GET,POST,PATCH,OPTIONS");

  if (req.method !== "GET" && req.method !== "POST" && req.method !== "PATCH") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (req.method === "GET") {
      const query = chatMessagesQuerySchema.safeParse(req.query);
      if (!query.success) {
        res.status(400).json({ error: getZodErrorMessage(query.error) });
        return;
      }

      const result = await getChatMessages(
        user,
        query.data.userId,
        query.data.before,
      );
      res.status(200).json(result);
      return;
    }

    if (req.method === "PATCH") {
      const body = markChatReadBodySchema.safeParse(req.body);
      if (!body.success) {
        res.status(400).json({ error: getZodErrorMessage(body.error) });
        return;
      }

      await markChatRead(user, body.data.userId);
      res.status(204).end();
      return;
    }

    const body = sendChatMessageBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: getZodErrorMessage(body.error) });
      return;
    }

    const result = await sendChatMessage(
      user,
      body.data.userId,
      body.data.body,
      body.data.clientMessageId,
    );
    await sendChatPushNotifications(result.recipientUserId).catch((error) => {
      console.error("Error sending chat push notification:", error);
    });
    res.status(201).json({ message: result.message });
  } catch (error) {
    if (error instanceof ChatAccessError) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    console.error("Error handling chat messages:", error);
    res.status(500).json({ error: "Failed to handle chat messages" });
  }
}
