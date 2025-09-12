import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
// import { useTheme } from '../contexts/ThemeContext'; // Temporalmente deshabilitado
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import LoadingSpinner from './LoadingSpinner';
import { Settings, Save, AlertTriangle, Check, X, Building, Users, ArrowRight, Sun, Moon } from 'lucide-react';

const SettingsPanel = ({ isOpen, onClose, onOpenWarehouseManager, onOpenFriendsManager }) => {
  const { currentUser, userProfile, loadUserProfile } = useAuth();
  // const { theme, toggleTheme, isDark } = useTheme(); // Temporalmente deshabilitado
  const [isDark, setIsDark] = useState(false); // Tema simple temporal
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    stockMinimoGlobal: 5,
    alertasAutomaticas: true,
    alertasEmail: false,
    alertasStockBajo: true,
    alertasStockCero: true,
  });

  // Cargar configuración actual
  useEffect(() => {
    if (isOpen && userProfile) {
      loadCurrentSettings();
    }
  }, [isOpen, userProfile]);

  const loadCurrentSettings = async () => {
    try {
      setLoading(true);
      
      // Cargar configuración desde el perfil del usuario
      if (userProfile?.configuracion) {
        setSettings({
          stockMinimoGlobal: userProfile.configuracion.nivelMinimoDefault || 5,
          alertasAutomaticas: userProfile.configuracion.alertasStockBajo ?? true,
          alertasEmail: userProfile.configuracion.alertasEmail ?? false,
          alertasStockBajo: userProfile.configuracion.alertasStockBajo ?? true,
          alertasStockCero: userProfile.configuracion.alertasStockCero ?? true,
        });
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      
      // Actualizar configuración en el perfil del usuario
      const userRef = doc(db, 'usuarios', currentUser.uid);
      
      await updateDoc(userRef, {
        'configuracion.nivelMinimoDefault': settings.stockMinimoGlobal,
        'configuracion.alertasAutomaticas': settings.alertasAutomaticas,
        'configuracion.alertasEmail': settings.alertasEmail,
        'configuracion.alertasStockCero': settings.alertasStockCero,
        fechaActualizacion: new Date().toISOString(),
      });

      // Recargar perfil del usuario
      await loadUserProfile(currentUser.uid);

      if (window.showSuccess) {
        window.showSuccess('Configuración guardada correctamente');
      }

      onClose();
    } catch (error) {
      console.error('Error guardando configuración:', error);
      if (window.showError) {
        window.showError('Error al guardar la configuración');
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="settings-modal bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-auto max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Settings className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Configuración del Sistema
                </h3>
                <p className="text-sm text-gray-600">
                  Personaliza el comportamiento de tu inventario
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={saving}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="lg" text="Cargando configuración..." />
            </div>
          ) : (
            <>
              {/* Stock Crítico */}
              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-4">Stock Crítico</h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      Nivel mínimo global (por defecto)
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="number"
                        value={settings.stockMinimoGlobal}
                        onChange={(e) => handleSettingChange('stockMinimoGlobal', parseInt(e.target.value) || 5)}
                        onWheel={(e) => e.target.blur()}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="1"
                        max="1000"
                      />
                      <span className="text-sm text-gray-600">unidades</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Se aplicará a productos nuevos. Los productos existentes mantienen su configuración individual.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.alertasAutomaticas}
                        onChange={(e) => handleSettingChange('alertasAutomaticas', e.target.checked)}
                        className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-200">Alertas automáticas de stock bajo</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.alertasStockCero}
                        onChange={(e) => handleSettingChange('alertasStockCero', e.target.checked)}
                        className="mr-3 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-200">Alertas críticas de stock en cero</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Información del Usuario */}
              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-4">Información de la Cuenta</h4>
                
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Email:</span>
                    <span className="text-sm font-medium text-gray-900">{currentUser?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Nombre:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {userProfile?.nombreCompleto || 'No configurado'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Rol:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {userProfile?.rol || 'Usuario'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Fecha de registro:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {userProfile?.fechaCreacion 
                        ? new Date(userProfile.fechaCreacion).toLocaleDateString('es-ES')
                        : 'No disponible'
                      }
                    </span>
                  </div>
                </div>

                {/* Información del desarrollador */}
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-center">
                    <p className="text-xs text-blue-600 font-medium">Sistema desarrollado por</p>
                    <p className="text-sm font-bold text-blue-800">Raúl Jaime Pivet Álvarez</p>
                    <p className="text-xs text-blue-600">Full Stack Developer • React + Firebase</p>
                  </div>
                </div>
              </div>

              {/* Tema de la Aplicación */}
              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-4">Apariencia</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                    Tema de la aplicación
                  </label>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-lg border-2 border-blue-500 bg-blue-50 text-blue-700 shadow-md">
                      <div className="flex items-center space-x-3">
                        <Sun className="w-5 h-5" />
                        <div>
                          <div className="font-semibold">Modo Claro</div>
                          <div className="text-xs opacity-75">Actualmente activo</div>
                        </div>
                        <Check className="w-4 h-4 ml-auto" />
                      </div>
                    </div>
                    
                    <div className="p-4 rounded-lg border-2 border-gray-300 text-gray-500">
                      <div className="flex items-center space-x-3">
                        <Moon className="w-5 h-5" />
                        <div>
                          <div className="font-semibold">Modo Oscuro</div>
                          <div className="text-xs opacity-75">Temporalmente deshabilitado</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    El tema se sincroniza entre todos tus dispositivos
                  </p>
                </div>
              </div>

              {/* Acciones Avanzadas */}
              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-4">Gestión Avanzada</h4>
                
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      onClose();
                      onOpenWarehouseManager();
                    }}
                    className="w-full flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <Building className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">Gestión de Almacenes</p>
                        <p className="text-xs text-blue-700">Crear y gestionar múltiples almacenes</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-blue-600" />
                  </button>

                  <button
                    onClick={() => {
                      onClose();
                      onOpenFriendsManager();
                    }}
                    className="w-full flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <Users className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-900">Sistema de Colaboradores</p>
                        <p className="text-xs text-green-700">Transferencias entre usuarios</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-green-600" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 p-6 pt-0 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={saving}
            className="btn-secondary w-full sm:w-auto order-2 sm:order-1"
          >
            Cancelar
          </button>
          <button
            onClick={saveSettings}
            disabled={saving || loading}
            className="btn-primary w-full sm:w-auto order-1 sm:order-2 min-h-[40px] flex items-center justify-center"
          >
            {saving ? (
              <LoadingSpinner size="sm" text="" color="white" />
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Guardar Configuración
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;