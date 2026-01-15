/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope;

// Precache all static assets
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Take control immediately
self.skipWaiting();
clientsClaim();

// Handle push notification event
self.addEventListener('push', (event: PushEvent) => {
  console.log('[Service Worker] Push notification received', event);

  // Parse notification data
  const data = event.data?.json();
  const title = data?.title || 'Milena CRM';
  const options: NotificationOptions = {
    body: data?.body || '',
    icon: data?.icon || '/android-chrome-192x192.png',
    badge: data?.badge || '/favicon-32x32.png',
    tag: data?.tag || 'default',
    data: data?.data || {},
    requireInteraction: data?.requireInteraction || false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification click event
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  console.log('[Service Worker] Notification clicked', event);

  // Don't close the notification automatically - let user close it manually
  // This prevents notifications from disappearing for other users
  // event.notification.close();

  // Get the URL to open from notification data
  const urlToOpen = event.notification.data?.url || '/';
  const fullUrl = new URL(urlToOpen, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Check if there's already a window open with this URL
      for (const client of clients) {
        if (client.url === fullUrl && 'focus' in client) {
          return client.focus();
        }
      }

      // If no window is open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(fullUrl);
      }
    })
  );
});

// Log service worker activation
self.addEventListener('activate', () => {
  console.log('[Service Worker] Activated');
});

self.addEventListener('install', () => {
  console.log('[Service Worker] Installed');
});
