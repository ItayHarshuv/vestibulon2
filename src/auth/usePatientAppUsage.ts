import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useEffect, useRef } from "react";
import { apiFetch } from "~/lib/api";

const intervalMs = 30_000;
const maxQueuedIntervals = 120;

export function usePatientAppUsage(patientId: string | undefined) {
  const flush = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!patientId) return;

    const isNative = Capacitor.isNativePlatform();
    let nativeActive = !isNative;
    let pageActive = true;
    let disposed = false;
    let start: { wallTime: number; monotonicTime: number } | null = null;
    const pending = new Map<
      string,
      {
        intervalId: string;
        startedAt: string;
        endedAt: string;
      }
    >();

    function checkpoint(keepTracking: boolean) {
      if (start) {
        const duration = Math.min(
          intervalMs,
          Math.floor(performance.now() - start.monotonicTime),
        );
        if (duration > 0) {
          const intervalId = crypto.randomUUID();
          pending.set(intervalId, {
            intervalId,
            startedAt: new Date(start.wallTime).toISOString(),
            endedAt: new Date(start.wallTime + duration).toISOString(),
          });
          if (pending.size > maxQueuedIntervals) {
            const oldest = pending.keys().next();
            if (!oldest.done) pending.delete(oldest.value);
          }
        }
      }
      start = keepTracking
        ? { wallTime: Date.now(), monotonicTime: performance.now() }
        : null;

      if (pending.size === 0) return;
      const intervals = [...pending.values()];
      void apiFetch("/api/app-usage", {
        method: "POST",
        body: JSON.stringify({ userId: patientId, intervals }),
        keepalive: true,
      })
        .then((response) => {
          if (response.ok || response.status === 400) {
            for (const interval of intervals)
              pending.delete(interval.intervalId);
          }
        })
        .catch(() => {
          // Keep this batch for the next checkpoint while the app is open.
        });
    }

    const isForeground = () =>
      pageActive && nativeActive && document.visibilityState === "visible";
    const updateVisibility = () => {
      if (isForeground()) {
        start ??= { wallTime: Date.now(), monotonicTime: performance.now() };
      } else if (start) {
        checkpoint(false);
      }
    };
    const hidePage = () => {
      pageActive = false;
      updateVisibility();
    };
    const showPage = () => {
      pageActive = true;
      updateVisibility();
    };
    const flushUsage = () => checkpoint(isForeground());

    let nativeListener: ReturnType<typeof CapacitorApp.addListener> | undefined;
    if (isNative) {
      let heardNativeEvent = false;
      nativeListener = CapacitorApp.addListener(
        "appStateChange",
        ({ isActive }) => {
          if (disposed) return;
          heardNativeEvent = true;
          nativeActive = isActive;
          updateVisibility();
        },
      );
      void nativeListener
        .then(() => CapacitorApp.getState())
        .then(({ isActive }) => {
          if (disposed || heardNativeEvent) return;
          nativeActive = isActive;
          updateVisibility();
        })
        .catch((error: unknown) => {
          console.error(
            "Failed to initialize native app usage tracking",
            error,
          );
        });
    }

    flush.current = flushUsage;
    document.addEventListener("visibilitychange", updateVisibility);
    window.addEventListener("pagehide", hidePage);
    window.addEventListener("pageshow", showPage);
    window.addEventListener("online", flushUsage);
    const timer = window.setInterval(flushUsage, intervalMs);
    updateVisibility();

    return () => {
      disposed = true;
      flush.current = null;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", updateVisibility);
      window.removeEventListener("pagehide", hidePage);
      window.removeEventListener("pageshow", showPage);
      window.removeEventListener("online", flushUsage);
      void nativeListener
        ?.then((listener) => listener.remove())
        .catch(() => undefined);
    };
  }, [patientId]);

  return flush;
}
