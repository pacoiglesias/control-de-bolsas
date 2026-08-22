/**
 * firebase-messaging-sw.js
 *
 * Service Worker para la recepción de Notificaciones Web Push PWA en segundo plano
 * de Control Bolsas ERP (Firebase Cloud Messaging).
 */

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDJxQ01MIPPVJImil2vMSkmJlz8x25NMhM',
  authDomain: 'control-de-bolsas-89c88.firebaseapp.com',
  projectId: 'control-de-bolsas-89c88',
  storageBucket: 'control-de-bolsas-89c88.firebasestorage.app',
  messagingSenderId: '530396814626',
  appId: '1:530396814626:web:26b6cc74aadd4efcee997b',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[FCM-SW] Notificación Push recibida en segundo plano:', payload);

  const title = payload.notification?.title || payload.data?.title || 'Control Bolsas ERP';
  const body = payload.notification?.body || payload.data?.body || 'Nueva actualización del sistema';
  const icon = payload.notification?.icon || '/pwa-192x192.png';
  const clickAction = payload.data?.click_action || payload.data?.url || '/';

  const notificationOptions = {
    body,
    icon,
    badge: '/favicon.ico',
    tag: payload.data?.tag || 'control-bolsas-alert',
    vibrate: [200, 100, 200],
    data: {
      url: clickAction,
      dateOfArrival: Date.now(),
    },
    actions: [
      { action: 'open', title: 'Abrir ERP' },
      { action: 'close', title: 'Descartar' },
    ],
  };

  return self.registration.showNotification(title, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
