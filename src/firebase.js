import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Configuración de Firebase
const firebaseConfig = {
  apiKey: 'AIzaSyBk0R1PyH76HBGqnIu8wpyai3Y3keq_GMc',
  authDomain: 'inventario-pro-9f9e6.firebaseapp.com',
  projectId: 'inventario-pro-9f9e6',
  storageBucket: 'inventario-pro-9f9e6.firebasestorage.app',
  messagingSenderId: '1068233917670',
  appId: '1:1068233917670:web:fc86b65dc4ee01f0f9e727',
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar servicios
export const auth = getAuth(app);
export const db = getFirestore(app);

// Solo para desarrollo - conectar al emulador si está disponible
if (location.hostname === 'localhost') {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
  } catch (error) {
    console.log('Emulator connection failed, using production Firestore');
  }
}

export default app;
