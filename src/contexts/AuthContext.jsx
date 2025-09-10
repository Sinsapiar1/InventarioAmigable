import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

// Crear contexto
const AuthContext = createContext();

// Hook personalizado para usar el contexto
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
}

// Provider del contexto
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  // Registrar nuevo usuario
  async function signup(email, password, fullName) {
    try {
      // Crear usuario en Firebase Auth
      const { user } = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Actualizar perfil con nombre
      await updateProfile(user, {
        displayName: fullName,
      });

      // Crear documento de usuario en Firestore
      const userDoc = {
        email: user.email,
        nombreCompleto: fullName,
        rol: 'administrador', // Por defecto administrador
        fechaCreacion: new Date().toISOString(),
        configuracion: {
          tema: 'light',
          idioma: 'es',
          notificaciones: true,
        },
      };

      await setDoc(doc(db, 'usuarios', user.uid), userDoc);

      // Crear almacén por defecto
      const almacenDefault = {
        nombre: 'Almacén Principal',
        ubicacion: 'Ubicación Principal',
        fechaCreacion: new Date().toISOString(),
        activo: true,
      };

      await setDoc(
        doc(db, 'usuarios', user.uid, 'almacenes', 'principal'),
        almacenDefault
      );

      return user;
    } catch (error) {
      console.error('Error en registro:', error);
      throw new Error(getErrorMessage(error.code));
    }
  }

  // Iniciar sesión
  async function login(email, password) {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result;
    } catch (error) {
      console.error('Error en login:', error);
      throw new Error(getErrorMessage(error.code));
    }
  }

  // Cerrar sesión
  async function logout() {
    try {
      await signOut(auth);
      setUserProfile(null);
    } catch (error) {
      console.error('Error en logout:', error);
      throw new Error('Error al cerrar sesión');
    }
  }

  // Cargar perfil del usuario desde Firestore
  async function loadUserProfile(uid) {
    try {
      const userDoc = await getDoc(doc(db, 'usuarios', uid));
      if (userDoc.exists()) {
        setUserProfile(userDoc.data());
        return userDoc.data();
      }
    } catch (error) {
      console.error('Error cargando perfil:', error);
    }
  }

  // Función para obtener mensajes de error en español
  function getErrorMessage(errorCode) {
    const errorMessages = {
      'auth/user-not-found': 'Usuario no encontrado',
      'auth/wrong-password': 'Contraseña incorrecta',
      'auth/email-already-in-use': 'El email ya está en uso',
      'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
      'auth/invalid-email': 'Email inválido',
      'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde',
      'auth/network-request-failed': 'Error de conexión. Verifica tu internet',
      'auth/invalid-credential': 'Credenciales inválidas',
      'auth/user-disabled': 'Esta cuenta ha sido deshabilitada',
    };

    return (
      errorMessages[errorCode] || 'Ha ocurrido un error. Intenta nuevamente'
    );
  }

  // Efecto para escuchar cambios en la autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        // Cargar perfil del usuario cuando se autentica
        await loadUserProfile(user.uid);
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });

    return unsubscribe; // Limpiar suscripción
  }, []);

  // Valores que provee el contexto
  const value = {
    currentUser,
    userProfile,
    login,
    signup,
    logout,
    loading,
    loadUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
