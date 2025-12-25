// /public/sw.js
const CACHE_NAME = 'darsinurse-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js'
];

// Install event
self.addEventListener('install', event => {
  console.log('🔧 Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
      .catch(err => console.error('Cache error:', err))
  );
});

// Activate event
self.addEventListener('activate', event => {
  console.log('✓ Service Worker activated');
  event.waitUntil(self.clients.claim());
});

// Fetch event (for offline support)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
      .catch(() => new Response('Offline', { status: 503 }))
  );
});

// Handle push notifications dari server
self.addEventListener('push', event => {
  console.log('📨 Push notification received:', event.data);
  
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body,
      icon: data.icon || '/icon-192x192.png',
      badge: data.badge || '/badge-72x72.png',
      tag: data.tag,
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: data.data || {}
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  console.log('✓ Notification clicked:', event.notification.tag);
  event.notification.close();

  // Focus window or open app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Cek apakah window sudah terbuka
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // Jika belum terbuka, buka window baru
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', event => {
  console.log('✗ Notification closed:', event.notification.tag);
});