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
      this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      
      if (!this.isSupported) {
        console.log('📱 Push notifications no soportadas en este navegador');
        return;
      }

      // Esperar a que el DOM esté listo
      if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
      }

      // Registrar Service Worker PRIMERO
      await this.registerServiceWorker();
      
      // DESPUÉS inicializar Firebase Messaging
      this.messaging = getMessaging();
      
      console.log('🔧 Push Notification Service inicializado correctamente');
    } catch (error) {
      console.error('❌ Error inicializando push notifications:', error);
      this.isSupported = false;
    }
  }

  // Registrar Service Worker
  async registerServiceWorker() {
    try {
      // Verificar si ya está registrado
      const existingRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
      
      if (existingRegistration) {
        console.log('🔧 Service Worker ya registrado:', existingRegistration);
        
        // Esperar a que esté activo
        if (existingRegistration.installing) {
          await new Promise(resolve => {
            existingRegistration.installing.addEventListener('statechange', () => {
              if (existingRegistration.installing.state === 'activated') {
                resolve();
              }
            });
          });
        }
        
        return existingRegistration;
      }

      // Registrar nuevo Service Worker
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      
      console.log('🔧 Service Worker registrado exitosamente:', registration);
      
      // Esperar a que esté listo
      await navigator.serviceWorker.ready;
      console.log('✅ Service Worker listo para uso');
      
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

      // Verificar que el Service Worker esté activo
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration || !registration.active) {
        throw new Error('Service Worker no está activo. Intenta recargar la página.');
      }

      console.log('🔧 Service Worker verificado, obteniendo token...');

      const token = await getToken(this.messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration
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
      console.log('🔧 Iniciando configuración push para usuario:', userId);
      
      if (!this.isSupported) {
        throw new Error('Push notifications no soportadas en este navegador/dispositivo');
      }

      // Verificar que el servicio esté inicializado
      if (!this.messaging) {
        console.log('🔄 Reinicializando servicio...');
        await this.init();
        
        if (!this.messaging) {
          throw new Error('No se pudo inicializar Firebase Messaging');
        }
      }

      // Solicitar permisos
      console.log('🔔 Solicitando permisos...');
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        throw new Error('Permisos de notificación denegados por el usuario');
      }

      // Obtener token
      console.log('🔑 Obteniendo token FCM...');
      const token = await this.getDeviceToken();
      if (!token) {
        throw new Error('No se pudo obtener token FCM del dispositivo');
      }

      // Guardar en perfil de usuario
      console.log('💾 Guardando token en perfil...');
      await this.saveTokenToUser(userId, token);

      // Configurar listener
      this.setupForegroundListener();

      console.log('🎉 Push notifications configuradas exitosamente para usuario:', userId);
      return true;
    } catch (error) {
      console.error('❌ Error configurando push notifications:', error);
      throw error; // Propagar error para mejor debugging
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