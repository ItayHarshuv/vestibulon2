import { eq } from "drizzle-orm";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser, handleOptions, setApiHeaders } from "./auth.js";
import { db } from "./db/index.js";
import { userProfiles } from "./db/schema.js";
import {
  getZodErrorMessage,
  updateProfileSchema,
} from "../src/lib/validation.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res, "PATCH,OPTIONS")) {
    return;
  }

  setApiHeaders(req, res, "PATCH,OPTIONS");

  if (req.method !== "PATCH") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const bodyResult = updateProfileSchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({ error: getZodErrorMessage(bodyResult.error) });
      return;
    }

    const updated = await db
      .update(userProfiles)
      .set({ gender: bodyResult.data.gender })
      .where(eq(userProfiles.workosUserId, user.id))
      .returning({
        workosUserId: userProfiles.workosUserId,
        username: userProfiles.username,
        email: userProfiles.email,
        gender: userProfiles.gender,
      });

    const updatedProfile = updated[0];
    if (!updatedProfile) {
      res.status(404).json({ error: "User profile not found" });
      return;
    }

    res.status(200).json({
      user: {
        id: updatedProfile.workosUserId,
        username: updatedProfile.username,
        email: updatedProfile.email,
        gender:
          updatedProfile.gender === "male" || updatedProfile.gender === "female"
            ? updatedProfile.gender
            : null,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
}
