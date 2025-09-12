// 🔔 Componente para solicitar permisos de notificaciones push
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import pushNotificationService, { initPushNotifications, checkPushSupport } from '../services/pushNotifications';
import { Bell, Smartphone, Check, X, AlertTriangle } from 'lucide-react';

const NotificationPermission = () => {
  const { currentUser } = useAuth();
  const [support, setSupport] = useState({ isSupported: false, hasPermission: false, hasToken: false });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle', 'requesting', 'success', 'error'
  const [error, setError] = useState('');

  useEffect(() => {
    checkSupport();
  }, []);

  const checkSupport = () => {
    const supportInfo = checkPushSupport();
    setSupport(supportInfo);
    console.log('📱 Soporte push notifications:', supportInfo);
  };

  const handleEnableNotifications = async () => {
    if (!currentUser) return;

    setLoading(true);
    setStatus('requesting');
    setError('');

    try {
      console.log('🔔 Solicitando permisos de notificación...');
      
      const success = await initPushNotifications(currentUser.uid);
      
      if (success) {
        setStatus('success');
        checkSupport(); // Actualizar estado
        
        if (window.showSuccess) {
          window.showSuccess('🔔 ¡Notificaciones push habilitadas! Recibirás alertas de traspasos.');
        }
      } else {
        setStatus('error');
        setError('No se pudieron habilitar las notificaciones. Verifica los permisos del navegador.');
      }
    } catch (error) {
      console.error('❌ Error habilitando notificaciones:', error);
      setStatus('error');
      setError('Error técnico al configurar notificaciones: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // No mostrar si no hay soporte
  if (!support.isSupported) {
    return null;
  }

  // No mostrar si ya están habilitadas
  if (support.hasPermission && support.hasToken) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
        <div className="flex items-center space-x-2">
          <Check className="w-5 h-5 text-green-600" />
          <span className="text-green-700 text-sm font-medium">
            Notificaciones push habilitadas
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-start space-x-3">
        <Bell className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-blue-800 font-semibold mb-2">
            📲 Habilitar Notificaciones Push
          </h3>
          
          <div className="text-blue-700 text-sm mb-4 space-y-1">
            <p>• Recibe alertas instantáneas de nuevos traspasos</p>
            <p>• Notificaciones de stock bajo y solicitudes de colaboración</p>
            <p>• Funciona aunque la app esté cerrada</p>
            <p>• Completamente gratuito y seguro</p>
          </div>

          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-700 text-sm font-medium">Error</p>
                  <p className="text-red-600 text-xs mt-1">{error}</p>
                  <div className="mt-2">
                    <button
                      onClick={() => window.location.reload()}
                      className="text-xs text-blue-600 hover:text-blue-700 underline"
                    >
                      🔄 Recargar página e intentar nuevamente
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-3">
            <button
              onClick={handleEnableNotifications}
              disabled={loading || status === 'requesting'}
              className="btn-primary flex items-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              ) : (
                <Smartphone className="w-4 h-4" />
              )}
              <span>
                {status === 'requesting' ? 'Configurando...' : 'Habilitar Notificaciones'}
              </span>
            </button>

            {status === 'success' && (
              <div className="flex items-center space-x-2 text-green-600">
                <Check className="w-4 h-4" />
                <span className="text-sm font-medium">¡Configurado!</span>
              </div>
            )}
          </div>

          <p className="text-xs text-blue-600 mt-2">
            💡 Tip: También puedes habilitar esto más tarde en Configuración
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotificationPermission;