import { apiFetch } from "./api";

export type WebPushResult =
  | "enabled"
  | "permission-denied"
  | "unsupported"
  | "ios-install-required";

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

function isIosBrowserWithoutHomeScreenInstall() {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as NavigatorWithStandalone).standalone === true;
  return isIos && !isStandalone;
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const decoded = window.atob(base64);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function supportsWebPush() {
  return (
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function enableWebPush(): Promise<WebPushResult> {
  if (!supportsWebPush()) {
    return "unsupported";
  }

  if (isIosBrowserWithoutHomeScreenInstall()) {
    return "ios-install-required";
  }

  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
  if (permission !== "granted") {
    return "permission-denied";
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  const keyResponse = await apiFetch("/api/push-subscriptions");
  if (!keyResponse.ok) {
    throw new Error("Failed to load push notification configuration");
  }

  const keyResult = (await keyResponse.json()) as { publicKey?: unknown };
  if (typeof keyResult.publicKey !== "string") {
    throw new Error("Invalid push notification configuration");
  }

  let subscription = await registration.pushManager.getSubscription();
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(keyResult.publicKey),
  });

  const saveResponse = await apiFetch("/api/push-subscriptions", {
    method: "POST",
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
  if (!saveResponse.ok) {
    throw new Error("Failed to save push subscription");
  }

  return "enabled";
}

export async function sendTestWebPush() {
  const enableResult = await enableWebPush();
  if (enableResult !== "enabled") {
    return enableResult;
  }

  const response = await apiFetch("/api/push-test", { method: "POST" });
  if (!response.ok) {
    throw new Error("Failed to send test push notification");
  }

  return "enabled";
}
