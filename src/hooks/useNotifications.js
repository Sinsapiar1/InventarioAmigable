import { useState, useCallback, useEffect } from 'react';

// Hook para sistema de notificaciones global
export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);

  // Agregar notificación
  const addNotification = useCallback((notification) => {
    const id = Date.now() + Math.random();
    const newNotification = {
      id,
      type: 'info', // info, success, warning, error
      title: '',
      message: '',
      duration: 5000,
      persistent: false,
      ...notification
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto-eliminar si no es persistente
    if (!newNotification.persistent && newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  }, []);

  // Eliminar notificación
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  }, []);

  // Limpiar todas las notificaciones
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Métodos de conveniencia
  const showSuccess = useCallback((message, options = {}) => {
    return addNotification({
      type: 'success',
      title: 'Éxito',
      message,
      ...options
    });
  }, [addNotification]);

  const showError = useCallback((message, options = {}) => {
    return addNotification({
      type: 'error',
      title: 'Error',
      message,
      duration: 7000,
      ...options
    });
  }, [addNotification]);

  const showWarning = useCallback((message, options = {}) => {
    return addNotification({
      type: 'warning',
      title: 'Advertencia',
      message,
      duration: 6000,
      ...options
    });
  }, [addNotification]);

  const showInfo = useCallback((message, options = {}) => {
    return addNotification({
      type: 'info',
      title: 'Información',
      message,
      ...options
    });
  }, [addNotification]);

  return {
    notifications,
    addNotification,
    removeNotification,
    clearNotifications,
    showSuccess,
    showError,
    showWarning,
    showInfo
  };
};

// Hook para validaciones robustas
export const useValidation = () => {
  const [errors, setErrors] = useState({});
  const [isValid, setIsValid] = useState(true);

  // Reglas de validación
  const validationRules = {
    required: (value, fieldName) => {
      if (!value || (typeof value === 'string' && !value.trim())) {
        return `${fieldName} es obligatorio`;
      }
      return null;
    },

    email: (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (value && !emailRegex.test(value)) {
        return 'Formato de email inválido';
      }
      return null;
    },

    minLength: (value, min) => {
      if (value && value.length < min) {
        return `Debe tener al menos ${min} caracteres`;
      }
      return null;
    },

    maxLength: (value, max) => {
      if (value && value.length > max) {
        return `No puede tener más de ${max} caracteres`;
      }
      return null;
    },

    number: (value) => {
      if (value && isNaN(Number(value))) {
        return 'Debe ser un número válido';
      }
      return null;
    },

    positiveNumber: (value) => {
      const num = Number(value);
      if (value && (isNaN(num) || num <= 0)) {
        return 'Debe ser un número mayor a 0';
      }
      return null;
    },

    sku: (value) => {
      if (value && !/^[A-Z0-9-]+$/.test(value)) {
        return 'SKU solo puede contener letras mayúsculas, números y guiones';
      }
      return null;
    }
  };

  // Validar un campo específico
  const validateField = useCallback((fieldName, value, rules) => {
    const fieldErrors = [];

    rules.forEach(rule => {
      let error = null;

      if (typeof rule === 'string') {
        // Regla simple
        error = validationRules[rule]?.(value, fieldName);
      } else if (typeof rule === 'object') {
        // Regla con parámetros
        const { type, ...params } = rule;
        if (type === 'minLength') {
          error = validationRules.minLength(value, params.min);
        } else if (type === 'maxLength') {
          error = validationRules.maxLength(value, params.max);
        }
      } else if (typeof rule === 'function') {
        // Regla personalizada
        error = rule(value, fieldName);
      }

      if (error) {
        fieldErrors.push(error);
      }
    });

    return fieldErrors;
  }, []);

  // Validar múltiples campos
  const validate = useCallback((formData, validationSchema) => {
    const newErrors = {};
    let formIsValid = true;

    Object.keys(validationSchema).forEach(fieldName => {
      const rules = validationSchema[fieldName];
      const value = formData[fieldName];
      const fieldErrors = validateField(fieldName, value, rules);

      if (fieldErrors.length > 0) {
        newErrors[fieldName] = fieldErrors;
        formIsValid = false;
      }
    });

    setErrors(newErrors);
    setIsValid(formIsValid);

    return formIsValid;
  }, [validateField]);

  // Limpiar errores
  const clearErrors = useCallback(() => {
    setErrors({});
    setIsValid(true);
  }, []);

  // Limpiar error de un campo específico
  const clearFieldError = useCallback((fieldName) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  return {
    errors,
    isValid,
    validate,
    validateField,
    clearErrors,
    clearFieldError
  };
};

// Hook para manejo de estado de carga
export const useLoading = () => {
  const [loading, setLoading] = useState(false);
  const [loadingStates, setLoadingStates] = useState({});

  // Iniciar carga global
  const startLoading = useCallback(() => {
    setLoading(true);
  }, []);

  // Terminar carga global
  const stopLoading = useCallback(() => {
    setLoading(false);
  }, []);

  // Iniciar carga específica
  const startSpecificLoading = useCallback((key) => {
    setLoadingStates(prev => ({ ...prev, [key]: true }));
  }, []);

  // Terminar carga específica
  const stopSpecificLoading = useCallback((key) => {
    setLoadingStates(prev => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });
  }, []);

  // Wrapper para funciones async
  const withLoading = useCallback(async (asyncFunction, loadingKey = null) => {
    try {
      if (loadingKey) {
        startSpecificLoading(loadingKey);
      } else {
        startLoading();
      }

      const result = await asyncFunction();
      return result;
    } finally {
      if (loadingKey) {
        stopSpecificLoading(loadingKey);
      } else {
        stopLoading();
      }
    }
  }, [startLoading, stopLoading, startSpecificLoading, stopSpecificLoading]);

  // Verificar si está cargando
  const isLoading = useCallback((key = null) => {
    if (key) {
      return loadingStates[key] || false;
    }
    return loading;
  }, [loading, loadingStates]);

  return {
    loading,
    loadingStates,
    startLoading,
    stopLoading,
    startSpecificLoading,
    stopSpecificLoading,
    withLoading,
    isLoading
  };
};

// Hook para manejo de errores global
export const useErrorHandler = () => {
  const [errors, setErrors] = useState([]);

  // Agregar error
  const addError = useCallback((error) => {
    const errorObject = {
      id: Date.now() + Math.random(),
      message: typeof error === 'string' ? error : error.message,
      timestamp: new Date().toISOString(),
      type: 'error'
    };

    setErrors(prev => [...prev, errorObject]);
    
    // Log del error para debugging
    console.error('Error capturado:', error);

    return errorObject.id;
  }, []);

  // Remover error
  const removeError = useCallback((id) => {
    setErrors(prev => prev.filter(err => err.id !== id));
  }, []);

  // Limpiar todos los errores
  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // Manejar errores de Firebase
  const handleFirebaseError = useCallback((error) => {
    const firebaseErrorMessages = {
      'permission-denied': 'No tienes permisos para realizar esta acción',
      'not-found': 'El documento solicitado no existe',
      'already-exists': 'El documento ya existe',
      'resource-exhausted': 'Se ha excedido el límite de operaciones',
      'failed-precondition': 'La operación no se puede completar en el estado actual',
      'aborted': 'La operación fue cancelada',
      'out-of-range': 'Valor fuera del rango permitido',
      'unimplemented': 'Operación no implementada',
      'internal': 'Error interno del servidor',
      'unavailable': 'Servicio no disponible temporalmente',
      'data-loss': 'Pérdida de datos irrecuperable'
    };

    const message = firebaseErrorMessages[error.code] || error.message || 'Error desconocido';
    return addError(message);
  }, [addError]);

  return {
    errors,
    addError,
    removeError,
    clearErrors,
    handleFirebaseError
  };
};

// Hook para datos de inventario (reemplaza useProducts existente)
export const useInventoryData = () => {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Filtrar productos
  const filterProducts = useCallback((filters) => {
    return products.filter(product => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (!product.nombre.toLowerCase().includes(searchLower) &&
            !product.sku.toLowerCase().includes(searchLower) &&
            !product.categoria?.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      if (filters.category && product.categoria !== filters.category) {
        return false;
      }

      if (filters.lowStock && (product.cantidadActual || 0) > (product.cantidadMinima || 5)) {
        return false;
      }

      return true;
    });
  }, [products]);

  // Obtener producto por SKU
  const getProductBySku = useCallback((sku) => {
    return products.find(product => product.sku === sku);
  }, [products]);

  // Obtener productos con stock bajo
  const getLowStockProducts = useCallback(() => {
    return products.filter(product => 
      (product.cantidadActual || 0) <= (product.cantidadMinima || 5)
    );
  }, [products]);

  // Calcular estadísticas
  const getStats = useCallback(() => {
    const totalProducts = products.length;
    const lowStockCount = getLowStockProducts().length;
    const totalValue = products.reduce((sum, product) => {
      return sum + ((product.cantidadActual || 0) * (product.precioVenta || 0));
    }, 0);

    const categories = [...new Set(products.map(p => p.categoria).filter(Boolean))];

    return {
      totalProducts,
      lowStockCount,
      totalValue,
      categories: categories.length,
      averageStock: totalProducts > 0 ? 
        products.reduce((sum, p) => sum + (p.cantidadActual || 0), 0) / totalProducts : 0
    };
  }, [products, getLowStockProducts]);

  return {
    products,
    movements,
    loading,
    lastUpdated,
    setProducts,
    setMovements,
    setLoading,
    setLastUpdated,
    filterProducts,
    getProductBySku,
    getLowStockProducts,
    getStats
  };
};

export default {
  useNotifications,
  useValidation,
  useLoading,
  useErrorHandler,
  useInventoryData
};