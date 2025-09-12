// 🌙 Context para manejo de tema Dark/Light Mode
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe ser usado dentro de ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [theme, setTheme] = useState('light'); // 'light' o 'dark'
  const [loading, setLoading] = useState(true);

  // Cargar tema del usuario al iniciar
  useEffect(() => {
    if (currentUser !== undefined) { // Esperar a que currentUser esté definido
      loadUserTheme();
    }
  }, [currentUser]);

  // Aplicar tema al documento
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Cargar tema guardado del usuario
  const loadUserTheme = async () => {
    try {
      if (!currentUser) {
        // Usuario no logueado: usar tema del localStorage o sistema
        const savedTheme = localStorage.getItem('inventario-theme');
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        setTheme(savedTheme || systemTheme);
        setLoading(false);
        return;
      }

      // Usuario logueado: cargar de Firestore
      const userRef = doc(db, 'usuarios', currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const userTheme = userData.configuracion?.tema || 'light';
        setTheme(userTheme);
        console.log('🎨 Tema cargado del usuario:', userTheme);
      } else {
        // Fallback al tema del sistema
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        setTheme(systemTheme);
      }
    } catch (error) {
      console.error('❌ Error cargando tema:', error);
      // Fallback al tema claro
      setTheme('light');
    } finally {
      setLoading(false);
    }
  };

  // Aplicar tema al documento HTML
  const applyTheme = (newTheme) => {
    const root = document.documentElement;
    
    if (newTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    
    // Guardar en localStorage para usuarios no logueados
    localStorage.setItem('inventario-theme', newTheme);
    
    console.log('🎨 Tema aplicado:', newTheme);
  };

  // Cambiar tema
  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    
    try {
      if (currentUser) {
        // Guardar en Firestore para usuarios logueados
        const userRef = doc(db, 'usuarios', currentUser.uid);
        await updateDoc(userRef, {
          'configuracion.tema': newTheme,
          fechaActualizacion: new Date().toISOString()
        });
        
        console.log('💾 Tema guardado en Firestore:', newTheme);
        
        if (window.showSuccess) {
          window.showSuccess(`🎨 Tema cambiado a ${newTheme === 'dark' ? 'oscuro' : 'claro'}`);
        }
      }
    } catch (error) {
      console.error('❌ Error guardando tema:', error);
      // No revertir el tema local, solo falló el guardado
    }
  };

  // Establecer tema específico
  const setThemeMode = async (newTheme) => {
    if (newTheme !== 'light' && newTheme !== 'dark') {
      console.error('❌ Tema inválido:', newTheme);
      return;
    }

    setTheme(newTheme);
    
    try {
      if (currentUser) {
        const userRef = doc(db, 'usuarios', currentUser.uid);
        await updateDoc(userRef, {
          'configuracion.tema': newTheme,
          fechaActualizacion: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('❌ Error estableciendo tema:', error);
    }
  };

  // Obtener información del tema
  const getThemeInfo = () => {
    return {
      currentTheme: theme,
      isDark: theme === 'dark',
      isLight: theme === 'light',
      loading: loading
    };
  };

  const value = {
    theme,
    toggleTheme,
    setThemeMode,
    getThemeInfo,
    isDark: theme === 'dark',
    isLight: theme === 'light',
    loading
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;