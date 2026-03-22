import { verifyToken } from "@clerk/backend";
import { z } from "zod";

const verifiedTokenSchema = z.object({
  sub: z.string().min(1),
});

const verifiedTokenErrorsSchema = z.object({
  errors: z.array(z.unknown()).optional(),
});

function extractBearerToken(authorizationHeader: string | undefined) {
  if (!authorizationHeader) return null;

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;

  return token;
}

export async function getAuthenticatedUserIdFromHeader(
  authorizationHeader: string | undefined,
) {
  const token = extractBearerToken(authorizationHeader);
  if (!token) return null;

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing CLERK_SECRET_KEY");
  }

  try {
    const verified = await verifyToken(token, { secretKey });
    const errorResult = verifiedTokenErrorsSchema.safeParse(verified);
    if (errorResult.success && (errorResult.data.errors?.length ?? 0) > 0) {
      return null;
    }

    const payloadResult = verifiedTokenSchema.safeParse(verified);
    if (!payloadResult.success) return null;

    return payloadResult.data.sub;
  } catch {
    return null;
  }
}
