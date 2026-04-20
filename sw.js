
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : { title: 'Notificación SIGAI', body: 'Nueva alerta del sistema.' };
  
  const options = {
    body: data.body,
    icon: '/icon.png', // Placeholder
    badge: '/badge.png', // Placeholder
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
