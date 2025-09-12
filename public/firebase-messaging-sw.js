// 📲 Service Worker para Firebase Cloud Messaging
// Este archivo maneja las notificaciones push en background

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Configuración de Firebase (exacta de tu firebase.js)
const firebaseConfig = {
  apiKey: 'AIzaSyBk0R1PyH76HBGqnIu8wpyai3Y3keq_GMc',
  authDomain: 'inventario-pro-9f9e6.firebaseapp.com',
  projectId: 'inventario-pro-9f9e6',
  storageBucket: 'inventario-pro-9f9e6.firebasestorage.app',
  messagingSenderId: '1068233917670',
  appId: '1:1068233917670:web:fc86b65dc4ee01f0f9e727'
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Inicializar Messaging
const messaging = firebase.messaging();

// Manejar mensajes en background (cuando la app está cerrada)
messaging.onBackgroundMessage((payload) => {
  console.log('📲 Mensaje push recibido en background:', payload);

  const notificationTitle = payload.notification?.title || 'Inventario Pro';
  const notificationOptions = {
    body: payload.notification?.body || 'Nueva notificación',
    icon: '/vite.svg', // Usar tu ícono
    badge: '/vite.svg',
    tag: 'inventario-notification',
    data: payload.data || {},
    actions: [
      {
        action: 'open',
        title: 'Abrir App'
      },
      {
        action: 'close',
        title: 'Cerrar'
      }
    ],
    requireInteraction: true // Mantener visible hasta que el usuario interactúe
  };

  // Mostrar notificación
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Manejar clics en notificaciones
self.addEventListener('notificationclick', (event) => {
  console.log('📱 Clic en notificación:', event);
  
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    // Abrir o enfocar la app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Si la app ya está abierta, enfocarla
          for (const client of clientList) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              return client.focus();
            }
          }
          
          // Si no está abierta, abrirla
          if (clients.openWindow) {
            return clients.openWindow('/');
          }
        })
    );
  }
});

console.log('🔧 Service Worker de Firebase Messaging cargado correctamente');