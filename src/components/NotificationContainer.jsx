import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';

const NotificationContainer = () => {
  const [notifications, setNotifications] = useState([]);

  // Función global para agregar notificaciones
  window.addNotification = (notification) => {
    const id = Date.now() + Math.random();
    const newNotification = {
      id,
      type: 'info',
      title: '',
      message: '',
      duration: 5000,
      persistent: false,
      ...notification,
    };

    setNotifications((prev) => [...prev, newNotification]);

    // Auto-eliminar si no es persistente
    if (!newNotification.persistent && newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  };

  // Métodos de conveniencia globales
  window.showSuccess = (message, options = {}) => {
    return window.addNotification({
      type: 'success',
      title: 'Éxito',
      message,
      ...options,
    });
  };

  window.showError = (message, options = {}) => {
    return window.addNotification({
      type: 'error',
      title: 'Error',
      message,
      duration: 7000,
      ...options,
    });
  };

  window.showWarning = (message, options = {}) => {
    return window.addNotification({
      type: 'warning',
      title: 'Advertencia',
      message,
      duration: 6000,
      ...options,
    });
  };

  window.showInfo = (message, options = {}) => {
    return window.addNotification({
      type: 'info',
      title: 'Información',
      message,
      ...options,
    });
  };

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getStyles = (type) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`
            ${getStyles(notification.type)}
            border rounded-lg p-4 shadow-lg backdrop-blur-sm
            animate-fade-in transition-all duration-300 ease-out
            transform translate-x-0 opacity-100
          `}
          style={{
            animation: 'slideInRight 0.3s ease-out',
          }}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              {getIcon(notification.type)}
            </div>
            <div className="flex-1 min-w-0">
              {notification.title && (
                <p className="font-semibold text-sm">{notification.title}</p>
              )}
              <p className={`text-sm ${notification.title ? 'mt-1' : ''}`}>
                {notification.message}
              </p>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// Estilos para la animación
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);

export default NotificationContainer;