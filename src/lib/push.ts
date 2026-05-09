// Notificações locais nativas — sem servidor, sem VAPID.
// Usa Notification API + Service Worker registrado para garantir suporte em mobile.

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch (e) {
    console.error("SW register failed", e);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted") return "granted";
  return await Notification.requestPermission();
}

export function getNotificationPermission(): NotificationPermission {
  if (typeof Notification === "undefined") return "denied";
  return Notification.permission;
}

export async function showLocalNotification(title: string, body: string, url = "/agenda") {
  if (getNotificationPermission() !== "granted") return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) {
    reg.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: [200, 100, 200],
      data: { url },
      tag: `agenda-${Date.now()}`,
    } as NotificationOptions);
  } else {
    new Notification(title, { body, icon: "/icon-192.png" });
  }
}
