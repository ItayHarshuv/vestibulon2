import { verifyToken } from "@clerk/backend";

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
    const maybeErrors = (verified as { errors?: unknown }).errors;
    if (Array.isArray(maybeErrors) && maybeErrors.length > 0) return null;

    
    const payload =
      verified && typeof verified === "object"
        ? (verified as {sub?: unknown })
        : null;

    const sub = payload?.sub;
    if (typeof sub !== "string" || !sub) return null;

    return sub;
  } catch (error) {
    return null;
  }
}
