/// <reference lib="webworker" />

const sw = /** @type {ServiceWorkerGlobalScope} */ (
  /** @type {unknown} */ (globalThis)
);

sw.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    sw.registration.showNotification(data.title ?? "Vestibulon", {
      body: data.body ?? "הגיע הזמן לתרגל",
      icon: "/icon-192.png",
      badge: "/favicon.webp",
      tag: data.tag ?? "practice-reminder",
      data: {
        url: data.url ?? "/select-exercise",
      },
    }),
  );
});

sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data?.url ?? "/select-exercise",
    sw.location.origin,
  ).href;

  event.waitUntil(
    sw.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        const existingClient = windowClients.find(
          (client) => new URL(client.url).origin === sw.location.origin,
        );
        if (existingClient) {
          return existingClient.navigate(targetUrl).then(() => existingClient.focus());
        }
        return sw.clients.openWindow(targetUrl);
      }),
  );
});
