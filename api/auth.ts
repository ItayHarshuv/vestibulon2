import { eq, or } from "drizzle-orm";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AuthenticateWithSessionCookieFailureReason,
  WorkOS,
} from "@workos-inc/node";
import { db } from "./db/index.js";
import { userProfiles } from "./db/schema.js";
import type { Gender } from "../src/data/content.js";

const DEFAULT_SESSION_COOKIE_NAME = "vestibulon_session";
const ACCESS_CONTROL_HEADERS = "Content-Type, Authorization, X-Requested-With";
const DEFAULT_ALLOWED_CROSS_ORIGINS = ["capacitor://localhost"];

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

let workos: WorkOS | null = null;

export function getSessionCookieName() {
  return process.env.APP_SESSION_COOKIE_NAME?.trim() ?? DEFAULT_SESSION_COOKIE_NAME;
}

function getCookiePassword() {
  return getRequiredEnv("WORKOS_COOKIE_PASSWORD");
}

function parseCookies(cookieHeader: string | undefined) {
  if (!cookieHeader) return {};

  return Object.fromEntries(
    cookieHeader.split(";").flatMap((entry) => {
      const [rawName, ...rawValue] = entry.trim().split("=");
      if (!rawName || rawValue.length === 0) return [];
      return [[rawName, decodeURIComponent(rawValue.join("="))]];
    }),
  );
}

function isSecureRequest(req: VercelRequest) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (typeof forwardedProto === "string") {
    return forwardedProto.split(",")[0]?.trim() === "https";
  }

  const origin = req.headers.origin;
  return process.env.NODE_ENV === "production" || origin?.startsWith("https://");
}

function getCookieSameSite(req: VercelRequest) {
  const origin = req.headers.origin;
  if (!origin || !req.headers.host) return "Lax";

  try {
    const requestOrigin = new URL(origin);
    const requestHost = requestOrigin.host;
    const isSameHost = requestHost === req.headers.host;
    const isHttpOrigin =
      requestOrigin.protocol === "http:" || requestOrigin.protocol === "https:";

    if (isSameHost && isHttpOrigin) {
      return "Lax";
    }
  } catch {
    return "None";
  }

  return "None";
}

function buildCookie(req: VercelRequest, value: string, maxAge?: number) {
  const sameSite = getCookieSameSite(req);
  const parts = [
    `${getSessionCookieName()}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${sameSite}`,
  ];

  if (isSecureRequest(req) || sameSite === "None") {
    parts.push("Secure");
  }

  if (maxAge !== undefined) {
    parts.push(`Max-Age=${maxAge}`);
  }

  return parts.join("; ");
}

export function setSessionCookie(
  req: VercelRequest,
  res: VercelResponse,
  sessionData: string,
) {
  res.setHeader("Set-Cookie", buildCookie(req, sessionData));
}

export function clearSessionCookie(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Set-Cookie", buildCookie(req, "", 0));
}

function getRequestOrigin(req: VercelRequest) {
  const host = req.headers.host?.trim();
  if (!host) return null;

  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol =
    typeof forwardedProto === "string"
      ? forwardedProto.split(",")[0]?.trim()
      : undefined;

  return `${protocol === "https" ? "https" : "http"}://${host}`;
}

function normalizeOrigin(origin: string) {
  try {
    const url = new URL(origin);
    if (!url.host || url.username || url.password) {
      return null;
    }

    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function getAllowedCrossOrigins() {
  const configuredOrigins =
    process.env.APP_ALLOWED_ORIGINS
      ?.split(",")
      .map((origin) => normalizeOrigin(origin.trim()))
      .filter((origin): origin is string => Boolean(origin)) ?? [];

  return new Set([...DEFAULT_ALLOWED_CROSS_ORIGINS, ...configuredOrigins]);
}

function isAllowedOrigin(req: VercelRequest, origin: string) {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return false;

  if (normalizedOrigin === getRequestOrigin(req)) {
    return true;
  }

  return getAllowedCrossOrigins().has(normalizedOrigin);
}

function appendVaryHeader(res: VercelResponse, value: string) {
  const current = res.getHeader("Vary");
  if (typeof current !== "string" || current.length === 0) {
    res.setHeader("Vary", value);
    return;
  }

  const values = current
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!values.includes(value)) {
    values.push(value);
  }

  res.setHeader("Vary", values.join(", "));
}

export function setApiHeaders(
  req: VercelRequest,
  res: VercelResponse,
  methods: string,
) {
  const origin = req.headers.origin;
  if (origin) {
    appendVaryHeader(res, "Origin");
  }

  if (origin && isAllowedOrigin(req, origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", ACCESS_CONTROL_HEADERS);
}

export function handleOptions(
  req: VercelRequest,
  res: VercelResponse,
  methods: string,
) {
  setApiHeaders(req, res, methods);
  if (req.method !== "OPTIONS") return false;

  res.status(204).end();
  return true;
}

function getRequestIpAddress(req: VercelRequest) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string") {
    return forwardedFor.split(",")[0]?.trim();
  }
  return undefined;
}

function getRequestUserAgent(req: VercelRequest) {
  return req.headers["user-agent"];
}

function getSessionDataFromRequest(req: VercelRequest) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[getSessionCookieName()];
}

export function getAuthenticationOptions(req: VercelRequest) {
  return {
    clientId: getRequiredEnv("WORKOS_CLIENT_ID"),
    ipAddress: getRequestIpAddress(req),
    userAgent: getRequestUserAgent(req),
    session: {
      sealSession: true,
      cookiePassword: getCookiePassword(),
    },
  } as const;
}

export type AuthenticatedUser = {
  id: string;
  username: string;
  email: string;
  gender: Gender | null;
  sessionId: string;
};

async function getUserProfileByWorkosUserId(workosUserId: string) {
  const rows = await db
    .select({
      workosUserId: userProfiles.workosUserId,
      username: userProfiles.username,
      email: userProfiles.email,
      gender: userProfiles.gender,
    })
    .from(userProfiles)
    .where(eq(userProfiles.workosUserId, workosUserId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getUserProfileByUsername(username: string) {
  const rows = await db
    .select({
      workosUserId: userProfiles.workosUserId,
      username: userProfiles.username,
      email: userProfiles.email,
      gender: userProfiles.gender,
    })
    .from(userProfiles)
    .where(eq(userProfiles.username, username))
    .limit(1);

  return rows[0] ?? null;
}

export async function getUserProfileByIdentifier(identifier: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const filters = identifier.includes("@")
    ? [eq(userProfiles.email, normalizedIdentifier)]
    : [
        eq(userProfiles.username, identifier.trim()),
        eq(userProfiles.email, normalizedIdentifier),
      ];

  const rows = await db
    .select({
      workosUserId: userProfiles.workosUserId,
      username: userProfiles.username,
      email: userProfiles.email,
      gender: userProfiles.gender,
    })
    .from(userProfiles)
    .where(filters.length === 1 ? filters[0]! : or(...filters))
    .limit(1);

  return rows[0] ?? null;
}

export function getWorkOS() {
  workos ??= new WorkOS(getRequiredEnv("WORKOS_API_KEY"), {
    clientId: getRequiredEnv("WORKOS_CLIENT_ID"),
  });

  return workos;
}

export async function getAuthenticatedUser(
  req: VercelRequest,
  res?: VercelResponse,
): Promise<AuthenticatedUser | null> {
  const sessionData = getSessionDataFromRequest(req);
  if (!sessionData) return null;

  try {
    const workos = getWorkOS();
    const session = workos.userManagement.loadSealedSession({
      sessionData,
      cookiePassword: getCookiePassword(),
    });

    const authenticated = await session.authenticate();
    if (authenticated.authenticated) {
      const profile = await getUserProfileByWorkosUserId(authenticated.user.id);
      if (!profile) return null;

      return {
        id: authenticated.user.id,
        username: profile.username,
        email: profile.email,
        gender:
          profile.gender === "male" || profile.gender === "female"
            ? profile.gender
            : null,
        sessionId: authenticated.sessionId,
      };
    }

    if (
      authenticated.reason !==
      AuthenticateWithSessionCookieFailureReason.INVALID_JWT
    ) {
      return null;
    }

    const refreshed = await session.refresh({
      cookiePassword: getCookiePassword(),
    });

    if (!refreshed.authenticated || !refreshed.user) {
      return null;
    }

    if (refreshed.sealedSession && res) {
      setSessionCookie(req, res, refreshed.sealedSession);
    }

    const profile = await getUserProfileByWorkosUserId(refreshed.user.id);
    if (!profile) return null;

    return {
      id: refreshed.user.id,
      username: profile.username,
      email: profile.email,
      gender:
        profile.gender === "male" || profile.gender === "female"
          ? profile.gender
          : null,
      sessionId: refreshed.sessionId,
    };
  } catch {
    return null;
  }
}
