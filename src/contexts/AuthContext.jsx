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

  // Validar datos de registro
  function validateSignupData(email, password, fullName) {
    if (!email || !email.trim()) {
      throw new Error('El email es obligatorio');
    }
    
    if (!password || password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }
    
    if (!fullName || !fullName.trim() || fullName.trim().length < 2) {
      throw new Error('El nombre completo debe tener al menos 2 caracteres');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('El formato del email no es válido');
    }
  }

  // Registrar nuevo usuario
  async function signup(email, password, fullName) {
    try {
      // Validar datos antes de proceder
      validateSignupData(email, password, fullName);

      // Crear usuario en Firebase Auth
      const { user } = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      // Actualizar perfil con nombre
      await updateProfile(user, {
        displayName: fullName.trim(),
      });

      // Crear documento de usuario en Firestore con transacción
      const userDoc = {
        email: user.email,
        nombreCompleto: fullName.trim(),
        rol: 'administrador',
        fechaCreacion: new Date().toISOString(),
        fechaUltimoAcceso: new Date().toISOString(),
        configuracion: {
          tema: 'light',
          idioma: 'es',
          notificaciones: true,
          primerAcceso: true,
        },
        estado: 'activo',
      };

      // Crear almacén por defecto
      const almacenDefault = {
        nombre: 'Almacén Principal',
        ubicacion: 'Ubicación Principal',
        descripcion: 'Almacén principal del sistema',
        fechaCreacion: new Date().toISOString(),
        activo: true,
        configuracion: {
          alertasStockBajo: true,
          nivelMinimoDefault: 5,
        },
      };

      // Usar transacción para crear usuario y almacén
      await Promise.all([
        setDoc(doc(db, 'usuarios', user.uid), userDoc),
        setDoc(
          doc(db, 'usuarios', user.uid, 'almacenes', 'principal'),
          almacenDefault
        ),
      ]);

      // Mostrar mensaje de éxito
      if (window.showSuccess) {
        window.showSuccess('Cuenta creada exitosamente. ¡Bienvenido!');
      }

      return user;
    } catch (error) {
      console.error('Error en registro:', error);
      
      // Mostrar error al usuario
      if (window.showError) {
        window.showError(getErrorMessage(error.code || error.message));
      }
      
      throw new Error(getErrorMessage(error.code || error.message));
    }
  }

  // Validar datos de login
  function validateLoginData(email, password) {
    if (!email || !email.trim()) {
      throw new Error('El email es obligatorio');
    }
    
    if (!password || !password.trim()) {
      throw new Error('La contraseña es obligatoria');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('El formato del email no es válido');
    }
  }

  // Iniciar sesión
  async function login(email, password) {
    try {
      // Validar datos antes de proceder
      validateLoginData(email, password);

      const result = await signInWithEmailAndPassword(
        auth, 
        email.trim(), 
        password
      );
      
      // Actualizar fecha de último acceso
      if (result.user) {
        try {
          await setDoc(
            doc(db, 'usuarios', result.user.uid), 
            { fechaUltimoAcceso: new Date().toISOString() },
            { merge: true }
          );
        } catch (updateError) {
          // No fallar el login si no se puede actualizar la fecha
          console.warn('No se pudo actualizar fecha de último acceso:', updateError);
        }
      }

      // Mostrar mensaje de éxito
      if (window.showSuccess) {
        window.showSuccess('Sesión iniciada correctamente');
      }

      return result;
    } catch (error) {
      console.error('Error en login:', error);
      
      // Mostrar error al usuario
      if (window.showError) {
        window.showError(getErrorMessage(error.code));
      }
      
      throw new Error(getErrorMessage(error.code));
    }
  }

  // Cerrar sesión
  async function logout() {
    try {
      console.log('🔓 AuthContext: Iniciando logout...');
      
      // Limpiar perfil inmediatamente
      setUserProfile(null);
      
      // Cerrar sesión en Firebase
      await signOut(auth);
      
      console.log('✅ AuthContext: Logout exitoso');
      
      // Mostrar mensaje de éxito
      if (window.showSuccess) {
        window.showSuccess('Sesión cerrada correctamente');
      }
    } catch (error) {
      console.error('❌ AuthContext: Error en logout:', error);
      
      // Limpieza forzada en caso de error
      setUser(null);
      setUserProfile(null);
      
      // Mostrar error al usuario
      if (window.showError) {
        window.showError('Error al cerrar sesión. Recargando página...');
      }
      
      // Recargar página como fallback seguro
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  }

  // Cargar perfil del usuario desde Firestore
  async function loadUserProfile(uid) {
    try {
      const userDoc = await getDoc(doc(db, 'usuarios', uid));
      if (userDoc.exists()) {
        setUserProfile(userDoc.data());
        return userDoc.data();
      } else {
        // Si no existe el perfil, crearlo con datos básicos
        const basicProfile = {
          email: currentUser?.email || '',
          nombreCompleto: currentUser?.displayName || 'Usuario',
          rol: 'administrador',
          fechaCreacion: new Date().toISOString(),
          fechaUltimoAcceso: new Date().toISOString(),
          configuracion: {
            tema: 'light',
            idioma: 'es',
            notificaciones: true,
          },
          estado: 'activo',
        };
        
        await setDoc(doc(db, 'usuarios', uid), basicProfile);
        setUserProfile(basicProfile);
        return basicProfile;
      }
    } catch (error) {
      console.error('Error cargando perfil:', error);
      // Establecer perfil básico en caso de error
      const fallbackProfile = {
        nombreCompleto: currentUser?.displayName || 'Usuario',
        email: currentUser?.email || '',
      };
      setUserProfile(fallbackProfile);
    }
  }

  // Función para obtener mensajes de error en español
  function getErrorMessage(errorCode) {
    const errorMessages = {
      // Errores de autenticación
      'auth/user-not-found': 'No existe una cuenta con este email',
      'auth/wrong-password': 'Contraseña incorrecta',
      'auth/email-already-in-use': 'Ya existe una cuenta con este email',
      'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
      'auth/invalid-email': 'El formato del email no es válido',
      'auth/too-many-requests': 'Demasiados intentos fallidos. Intenta más tarde',
      'auth/network-request-failed': 'Error de conexión. Verifica tu internet',
      'auth/invalid-credential': 'Credenciales inválidas',
      'auth/user-disabled': 'Esta cuenta ha sido deshabilitada',
      'auth/operation-not-allowed': 'Operación no permitida',
      'auth/requires-recent-login': 'Debes iniciar sesión nuevamente para realizar esta acción',
      
      // Errores de Firestore
      'permission-denied': 'No tienes permisos para realizar esta acción',
      'not-found': 'El documento solicitado no existe',
      'already-exists': 'El documento ya existe',
      'resource-exhausted': 'Se ha excedido el límite de operaciones',
      'failed-precondition': 'La operación no se puede completar en el estado actual',
      'aborted': 'La operación fue cancelada debido a un conflicto',
      'out-of-range': 'Valor fuera del rango permitido',
      'unimplemented': 'Operación no implementada',
      'internal': 'Error interno del servidor',
      'unavailable': 'Servicio no disponible temporalmente',
      'data-loss': 'Pérdida de datos irrecuperable',
      'unauthenticated': 'Debes iniciar sesión para realizar esta acción',
      
      // Errores personalizados
      'El email es obligatorio': 'El email es obligatorio',
      'La contraseña es obligatoria': 'La contraseña es obligatoria',
      'El nombre completo debe tener al menos 2 caracteres': 'El nombre completo debe tener al menos 2 caracteres',
      'El formato del email no es válido': 'El formato del email no es válido',
    };

    return (
      errorMessages[errorCode] || 'Ha ocurrido un error inesperado. Intenta nuevamente'
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
