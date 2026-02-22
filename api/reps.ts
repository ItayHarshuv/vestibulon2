import { and, eq } from "drizzle-orm";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUserIdFromHeader } from "./auth.js";
import { db } from "./db/index.js";
import { reps } from "./db/schema.js";

type CreateRepBody = {
  exerciseName?: unknown;
};

type UpdateRepBody = {
  repId?: unknown;
  numberOfSeconds?: unknown;
  bpmEndOfRep?: unknown;
  flagPaused?: unknown;
  dizziness?: unknown;
  nausea?: unknown;
  generalDifficulty?: unknown;
  general_difficulty?: unknown;
};

function parseCreateBody(body: unknown): CreateRepBody {
  if (!body || typeof body !== "object") return {};
  return body as CreateRepBody;
}

function parseUpdateBody(body: unknown): UpdateRepBody {
  if (!body || typeof body !== "object") return {};
  return body as UpdateRepBody;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,PATCH,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const authenticatedUserId = await getAuthenticatedUserIdFromHeader(
      req.headers.authorization,
    );

    if (!authenticatedUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (req.method === "POST") {
      const body = parseCreateBody(req.body);
      const exerciseName =
        typeof body.exerciseName === "string" ? body.exerciseName.trim() : "";

      if (!exerciseName) {
        res.status(400).json({ error: "Missing exerciseName" });
        return;
      }

      const now = new Date();

      const inserted = await db
        .insert(reps)
        .values({
          userId: authenticatedUserId,
          exerciseName,
          startTime: now,
        })
        .returning({
          id: reps.id,
          startTime: reps.startTime,
        });

      const createdRep = inserted[0];
      if (!createdRep) {
        res.status(500).json({ error: "Failed to create rep" });
        return;
      }

      res.status(201).json(createdRep);
      return;
    }

    if (req.method === "PATCH") {
      const body = parseUpdateBody(req.body);
      const repId =
        typeof body.repId === "number" && Number.isInteger(body.repId)
          ? body.repId
          : null;

      if (repId === null) {
        res.status(400).json({ error: "repId is required" });
        return;
      }

      const hasNumberOfSeconds = body.numberOfSeconds !== undefined;
      const hasBpmEndOfRep = body.bpmEndOfRep !== undefined;
      const hasFlagPaused = body.flagPaused !== undefined;
      const hasDizziness = body.dizziness !== undefined;
      const hasNausea = body.nausea !== undefined;
      const hasGeneralDifficulty =
        body.generalDifficulty !== undefined || body.general_difficulty !== undefined;

      if (
        !hasNumberOfSeconds &&
        !hasBpmEndOfRep &&
        !hasFlagPaused &&
        !hasDizziness &&
        !hasNausea &&
        !hasGeneralDifficulty
      ) {
        res.status(400).json({
          error: "At least one updatable field is required",
        });
        return;
      }

      const valuesToUpdate: {
        endTime?: Date;
        bpmEndOfRep?: number;
        flagPaused?: boolean;
        dizziness?: number;
        nausea?: number;
        generalDifficulty?: number;
      } = {};

      if (hasNumberOfSeconds) {
        const numberOfSeconds =
          typeof body.numberOfSeconds === "number" &&
          Number.isInteger(body.numberOfSeconds) &&
          body.numberOfSeconds >= 0
            ? body.numberOfSeconds
            : null;

        if (numberOfSeconds === null) {
          res.status(400).json({ error: "numberOfSeconds must be a non-negative integer" });
          return;
        }

        const repRows = await db
          .select({
            startTime: reps.startTime,
          })
          .from(reps)
          .where(and(eq(reps.id, repId), eq(reps.userId, authenticatedUserId)))
          .limit(1);

        const repRow = repRows[0];
        if (!repRow?.startTime) {
          res.status(404).json({ error: "Rep not found" });
          return;
        }

        valuesToUpdate.endTime = new Date(
          repRow.startTime.getTime() + numberOfSeconds * 1000,
        );
      }

      if (hasBpmEndOfRep) {
        const bpmEndOfRep =
          typeof body.bpmEndOfRep === "number" && Number.isInteger(body.bpmEndOfRep)
            ? body.bpmEndOfRep
            : null;

        if (bpmEndOfRep === null) {
          res.status(400).json({ error: "bpmEndOfRep must be an integer" });
          return;
        }

        valuesToUpdate.bpmEndOfRep = bpmEndOfRep;
      }

      if (hasFlagPaused) {
        if (typeof body.flagPaused !== "boolean") {
          res.status(400).json({ error: "flagPaused must be a boolean" });
          return;
        }

        valuesToUpdate.flagPaused = body.flagPaused;
      }

      if (hasDizziness) {
        const dizziness =
          typeof body.dizziness === "number" &&
          Number.isInteger(body.dizziness) &&
          body.dizziness >= 0 &&
          body.dizziness <= 10
            ? body.dizziness
            : null;

        if (dizziness === null) {
          res.status(400).json({ error: "dizziness must be an integer between 0 and 10" });
          return;
        }

        valuesToUpdate.dizziness = dizziness;
      }

      if (hasNausea) {
        const nausea =
          typeof body.nausea === "number" &&
          Number.isInteger(body.nausea) &&
          body.nausea >= 0 &&
          body.nausea <= 10
            ? body.nausea
            : null;

        if (nausea === null) {
          res.status(400).json({ error: "nausea must be an integer between 0 and 10" });
          return;
        }

        valuesToUpdate.nausea = nausea;
      }

      if (hasGeneralDifficulty) {
        const generalDifficultyInput =
          body.generalDifficulty !== undefined
            ? body.generalDifficulty
            : body.general_difficulty;
        const generalDifficulty =
          typeof generalDifficultyInput === "number" &&
          Number.isInteger(generalDifficultyInput) &&
          generalDifficultyInput >= 0 &&
          generalDifficultyInput <= 10
            ? generalDifficultyInput
            : null;

        if (generalDifficulty === null) {
          res
            .status(400)
            .json({ error: "general_difficulty must be an integer between 0 and 10" });
          return;
        }

        valuesToUpdate.generalDifficulty = generalDifficulty;
      }

      const updated = await db
        .update(reps)
        .set(valuesToUpdate)
        .where(and(eq(reps.id, repId), eq(reps.userId, authenticatedUserId)))
        .returning({ id: reps.id });

      if (updated.length === 0) {
        res.status(404).json({ error: "Rep not found" });
        return;
      }

      res.status(200).json({
        id: repId,
        ...valuesToUpdate,
      });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error handling reps endpoint:", error);
    res.status(500).json({ error: "Failed to handle reps endpoint" });
  }
}
