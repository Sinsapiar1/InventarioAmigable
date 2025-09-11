import { useState, useCallback } from 'react';

// Hook para manejar diálogos de confirmación
export const useConfirm = () => {
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    type: 'warning',
    details: null,
    onConfirm: null,
    loading: false,
  });

  const showConfirm = useCallback(({
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    type = 'warning',
    details = null,
    onConfirm,
  }) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        title,
        message,
        confirmText,
        cancelText,
        type,
        details,
        onConfirm: async () => {
          setConfirmState(prev => ({ ...prev, loading: true }));
          try {
            if (onConfirm) {
              await onConfirm();
            }
            resolve(true);
          } catch (error) {
            console.error('Error en confirmación:', error);
            resolve(false);
          } finally {
            setConfirmState(prev => ({ ...prev, isOpen: false, loading: false }));
          }
        },
        loading: false,
      });
    });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmState(prev => ({ ...prev, isOpen: false, loading: false }));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (confirmState.onConfirm) {
      await confirmState.onConfirm();
    }
  }, [confirmState.onConfirm]);

  // Métodos de conveniencia
  const confirmDelete = useCallback((itemName, onConfirm, details = null) => {
    return showConfirm({
      title: 'Eliminar elemento',
      message: `¿Estás seguro de que deseas eliminar "${itemName}"?`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      type: 'danger',
      details,
      onConfirm,
    });
  }, [showConfirm]);

  const confirmAction = useCallback((title, message, onConfirm, options = {}) => {
    return showConfirm({
      title,
      message,
      onConfirm,
      ...options,
    });
  }, [showConfirm]);

  const confirmSave = useCallback((onConfirm, hasChanges = true) => {
    if (!hasChanges) {
      return Promise.resolve(true);
    }

    return showConfirm({
      title: 'Guardar cambios',
      message: '¿Deseas guardar los cambios realizados?',
      confirmText: 'Guardar',
      cancelText: 'Descartar',
      type: 'info',
      onConfirm,
    });
  }, [showConfirm]);

  const confirmDiscard = useCallback((onConfirm) => {
    return showConfirm({
      title: 'Descartar cambios',
      message: 'Tienes cambios sin guardar. ¿Estás seguro de que deseas descartarlos?',
      confirmText: 'Descartar',
      cancelText: 'Continuar editando',
      type: 'warning',
      onConfirm,
    });
  }, [showConfirm]);

  return {
    // Estado del diálogo
    confirmState,
    
    // Funciones principales
    showConfirm,
    closeConfirm,
    handleConfirm,
    
    // Métodos de conveniencia
    confirmDelete,
    confirmAction,
    confirmSave,
    confirmDiscard,
  };
};

export default useConfirm;