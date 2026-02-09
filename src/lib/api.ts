import { Capacitor } from "@capacitor/core";

function joinUrl(base: string, path: string) {
  return new URL(path, base.endsWith("/") ? base : `${base}/`).toString();
}

/**
 * Returns a fetchable URL for both web + native builds.
 *
 * - Web dev: uses same-origin (http://localhost:5173) so Vite middleware can serve `/api/*`.
 * - Native (iOS/Android): requires `VITE_API_BASE_URL` (an https origin, e.g. https://myapp.vercel.app)
 *   because the webview origin is `capacitor://localhost` which cannot be used with `fetch()`.
 */
export function getApiUrl(path: string) {
  const isNative = Capacitor.isNativePlatform();

  const envBase =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "";

  if (isNative) {
    if (!envBase) {
      throw new Error(
        "Missing VITE_API_BASE_URL (set it to an https URL like https://<your-app>.vercel.app)",
      );
    }
    return joinUrl(envBase, path);
  }

  const origin = window.location.origin;
  if (origin.startsWith("http://") || origin.startsWith("https://")) {
    return joinUrl(origin, path);
  }

  if (envBase) return joinUrl(envBase, path);

  // Last-resort fallback (shouldn't happen in normal web usage)
  return path;
}

