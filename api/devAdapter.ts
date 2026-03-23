import type { IncomingMessage, ServerResponse } from "node:http";
import type { VercelRequest, VercelResponse } from "@vercel/node";

type VercelApiHandler = (req: VercelRequest, res: VercelResponse) => unknown;

function toSingleOrArray(values: string[]): string | string[] {
  return values.length === 1 ? values[0]! : values;
}

function buildQuery(url: URL): VercelRequest["query"] {
  const grouped = new Map<string, string[]>();

  for (const [key, value] of url.searchParams.entries()) {
    const current = grouped.get(key);
    if (current) {
      current.push(value);
      continue;
    }

    grouped.set(key, [value]);
  }

  return Object.fromEntries(
    Array.from(grouped.entries()).map(([key, values]) => [key, toSingleOrArray(values)]),
  );
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of req) {
    chunks.push(
      typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Uint8Array),
    );
  }

  const rawBody = Buffer.concat(chunks).toString("utf8").trim();
  if (!rawBody) return undefined;

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    // Keep parity with serverless handlers that treat invalid bodies as absent.
    return undefined;
  }
}

function withVercelResponse(res: ServerResponse): VercelResponse {
  const vercelRes = res as VercelResponse;

  vercelRes.status = (statusCode: number) => {
    res.statusCode = statusCode;
    return vercelRes;
  };

  vercelRes.json = (body: unknown) => {
    if (!res.getHeader("Content-Type")) {
      res.setHeader("Content-Type", "application/json");
    }
    res.end(JSON.stringify(body));
    return vercelRes;
  };

  return vercelRes;
}

export async function callVercelApiHandler(
  req: IncomingMessage,
  res: ServerResponse,
  handler: VercelApiHandler,
) {
  const requestUrl = new URL(req.url ?? "/", "http://localhost");
  const vercelReq = req as VercelRequest;

  vercelReq.query = buildQuery(requestUrl);
  vercelReq.body = await readJsonBody(req);

  const vercelRes = withVercelResponse(res);
  await handler(vercelReq, vercelRes);
}
