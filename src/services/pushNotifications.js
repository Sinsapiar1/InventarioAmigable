// 📲 Servicio de Notificaciones Push - Inventario Pro
// Maneja FCM tokens, permisos y envío de notificaciones

import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, getDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';

// Clave web de FCM - Obtenida de Firebase Console
const VAPID_KEY = 'BGrxcYhvsILlA6dcwPKbUlAfaU352ZA4HCUh3TIRXzfGw6gGa-0LFxm1GTGCHMdfAXlPfFOfYimrb4QywiVq4gw';

class PushNotificationService {
  constructor() {
    this.messaging = null;
    this.currentToken = null;
    this.isSupported = false;
    this.init();
  }

  // Inicializar servicio
  async init() {
    try {
      // Verificar soporte del navegador
      this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
      
      if (!this.isSupported) {
        console.log('📱 Push notifications no soportadas en este navegador');
        return;
      }

      // Inicializar Firebase Messaging
      this.messaging = getMessaging();
      
      // Registrar Service Worker
      await this.registerServiceWorker();
      
      console.log('🔧 Push Notification Service inicializado');
    } catch (error) {
      console.error('❌ Error inicializando push notifications:', error);
    }
  }

  // Registrar Service Worker
  async registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('🔧 Service Worker registrado:', registration);
      return registration;
    } catch (error) {
      console.error('❌ Error registrando Service Worker:', error);
      throw error;
    }
  }

  // Solicitar permisos al usuario
  async requestPermission() {
    try {
      if (!this.isSupported) {
        throw new Error('Push notifications no soportadas');
      }

      // Solicitar permiso
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        console.log('✅ Permisos de notificación concedidos');
        return true;
      } else {
        console.log('❌ Permisos de notificación denegados');
        return false;
      }
    } catch (error) {
      console.error('❌ Error solicitando permisos:', error);
      return false;
    }
  }

  // Obtener token FCM del dispositivo
  async getDeviceToken() {
    try {
      if (!this.messaging) {
        throw new Error('Messaging no inicializado');
      }

      if (VAPID_KEY === 'PENDIENTE_CONFIGURACION') {
        throw new Error('Clave VAPID no configurada. Contacta al administrador.');
      }

      const token = await getToken(this.messaging, {
        vapidKey: VAPID_KEY
      });

      if (token) {
        this.currentToken = token;
        console.log('🔑 Token FCM obtenido:', token.substring(0, 20) + '...');
        return token;
      } else {
        console.log('❌ No se pudo obtener token FCM');
        return null;
      }
    } catch (error) {
      console.error('❌ Error obteniendo token FCM:', error);
      return null;
    }
  }

  // Guardar token en perfil de usuario
  async saveTokenToUser(userId, token) {
    try {
      const userRef = doc(db, 'usuarios', userId);
      await updateDoc(userRef, {
        fcmToken: token,
        pushNotificationsEnabled: true,
        lastTokenUpdate: new Date().toISOString()
      });
      
      console.log('💾 Token FCM guardado en perfil de usuario');
    } catch (error) {
      console.error('❌ Error guardando token:', error);
    }
  }

  // Configurar listener para mensajes en foreground
  setupForegroundListener(callback) {
    if (!this.messaging) return;

    onMessage(this.messaging, (payload) => {
      console.log('📲 Mensaje push recibido en foreground:', payload);
      
      // Llamar callback personalizado
      if (callback) {
        callback(payload);
      }

      // Mostrar notificación personalizada en la app
      this.showInAppNotification(payload);
    });
  }

  // Mostrar notificación dentro de la app
  showInAppNotification(payload) {
    const title = payload.notification?.title || 'Nueva notificación';
    const body = payload.notification?.body || '';
    
    // Integrar con sistema de notificaciones existente
    if (window.showInfo) {
      window.showInfo(`📲 ${title}: ${body}`);
    }
  }

  // Inicializar para un usuario específico
  async initializeForUser(userId) {
    try {
      if (!this.isSupported) {
        console.log('📱 Push notifications no disponibles en este dispositivo');
        return false;
      }

      // Solicitar permisos
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        return false;
      }

      // Obtener token
      const token = await this.getDeviceToken();
      if (!token) {
        return false;
      }

      // Guardar en perfil de usuario
      await this.saveTokenToUser(userId, token);

      // Configurar listener
      this.setupForegroundListener();

      console.log('🎉 Push notifications configuradas exitosamente para usuario:', userId);
      return true;
    } catch (error) {
      console.error('❌ Error configurando push notifications:', error);
      return false;
    }
  }

  // Verificar si el usuario tiene notificaciones habilitadas
  async isEnabledForUser(userId) {
    try {
      const userRef = doc(db, 'usuarios', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return userData.pushNotificationsEnabled === true && userData.fcmToken;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error verificando estado de notificaciones:', error);
      return false;
    }
  }

  // Obtener estado de soporte
  getSupport() {
    return {
      isSupported: this.isSupported,
      hasPermission: Notification.permission === 'granted',
      hasToken: !!this.currentToken
    };
  }
}

// Exportar instancia singleton
const pushNotificationService = new PushNotificationService();
export default pushNotificationService;

// Funciones de utilidad
export const initPushNotifications = (userId) => {
  return pushNotificationService.initializeForUser(userId);
};

export const checkPushSupport = () => {
  return pushNotificationService.getSupport();
};

export const isPushEnabledForUser = (userId) => {
  return pushNotificationService.isEnabledForUser(userId);
};

// Función para enviar notificación push a un usuario específico
export const sendPushNotification = async (userId, title, body, data = {}) => {
  try {
    console.log('📲 Enviando push notification a usuario:', userId);
    
    // Obtener token FCM del usuario
    const userRef = doc(db, 'usuarios', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.log('❌ Usuario no encontrado:', userId);
      return false;
    }

    const userData = userDoc.data();
    const fcmToken = userData.fcmToken;
    
    if (!fcmToken || !userData.pushNotificationsEnabled) {
      console.log('📱 Usuario no tiene push notifications habilitadas:', userId);
      return false;
    }

    // Crear notificación en Firestore para trigger de Cloud Function
    const notificationData = {
      userId: userId,
      fcmToken: fcmToken,
      title: title,
      body: body,
      data: data,
      sent: false,
      createdAt: new Date().toISOString(),
      type: 'push'
    };

    // Guardar en colección especial para Cloud Functions
    await addDoc(collection(db, 'push-notifications'), notificationData);
    
    console.log('📲 Push notification programada para envío');
    return true;
  } catch (error) {
    console.error('❌ Error enviando push notification:', error);
    return false;
  }
};

console.log('📲 Push Notification Service cargado');