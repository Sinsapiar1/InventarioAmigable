import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ProductForm from './components/ProductForm';
import MovementForm from './components/MovementForm';
import InventoryTaking from './components/InventoryTaking';
import LoadingSpinner from './components/LoadingSpinner';
import NotificationContainer from './components/NotificationContainer';
import SettingsPanel from './components/SettingsPanel';
import WarehouseManager from './components/WarehouseManager';
import FriendsManager from './components/FriendsManager';
import {
  Package,
  BarChart3,
  ArrowUpDown,
  Clipboard,
  LogOut,
  User,
  Menu,
  X,
  Bell,
  Settings
} from 'lucide-react';

// Componente principal de la aplicación
function AppContent() {
  const { currentUser, logout, userProfile } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showWarehouseManager, setShowWarehouseManager] = useState(false);
  const [showFriendsManager, setShowFriendsManager] = useState(false);

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Cerrar menú móvil cuando se cambia de vista
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [currentView]);

  // Cerrar menús al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserMenu && !event.target.closest('.user-menu')) {
        setShowUserMenu(false);
      }
      if (isMobileMenuOpen && !event.target.closest('.mobile-menu') && !event.target.closest('.mobile-menu-button')) {
        setIsMobileMenuOpen(false);
      }
      if (showNotifications && !event.target.closest('.notifications-panel')) {
        setShowNotifications(false);
      }
      if (showSettings && !event.target.closest('.settings-panel')) {
        setShowSettings(false);
      }
      if (showQuickActions && !event.target.closest('.quick-actions-panel')) {
        setShowQuickActions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu, isMobileMenuOpen, showNotifications, showSettings, showQuickActions]);

  // Listener para cambios de vista desde componentes
  useEffect(() => {
    const handleChangeView = (event) => {
      setCurrentView(event.detail);
    };

    window.addEventListener('changeView', handleChangeView);
    return () => window.removeEventListener('changeView', handleChangeView);
  }, []);

  // Si no hay usuario autenticado, mostrar login
  if (!currentUser) {
    return <Login />;
  }

  // Función para manejar logout
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // Opciones de navegación
  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, description: 'Resumen general' },
    { id: 'products', label: 'Productos', icon: Package, description: 'Gestión de productos' },
    { id: 'movements', label: 'Movimientos', icon: ArrowUpDown, description: 'Entradas y salidas' },
    { id: 'inventory', label: 'Inventario Físico', icon: Clipboard, description: 'Conteo físico' },
  ];

  // Renderizar contenido según la vista actual
  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'products':
        return <ProductForm />;
      case 'movements':
        return <MovementForm />;
      case 'inventory':
        return <InventoryTaking />;
      default:
        return <Dashboard />;
    }
  };

  // Obtener vista actual
  const currentViewData = navigationItems.find(item => item.id === currentView);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo y botón móvil */}
            <div className="flex items-center space-x-3">
              {/* Botón menú móvil */}
              {isMobile && (
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="mobile-menu-button p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              )}
              
              {/* Logo */}
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    {isMobile ? 'Inventario' : 'Sistema de Inventario Pro'}
                  </h1>
                  {!isMobile && (
                    <p className="text-xs text-gray-500">
                      {userProfile?.nombreCompleto || currentUser.displayName}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Vista actual en móvil */}
            {isMobile && currentViewData && (
              <div className="flex-1 text-center">
                <p className="font-medium text-gray-900">{currentViewData.label}</p>
              </div>
            )}

            {/* Acciones del header */}
            <div className="flex items-center space-x-2">
              {/* Notificaciones */}
              <div className="relative notifications-panel">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors relative"
                  title="Notificaciones"
                >
                  <Bell className="w-5 h-5" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {notifications.length}
                    </span>
                  )}
                </button>

                {/* Panel de Notificaciones */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-40 max-h-96 overflow-y-auto">
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">Notificaciones</h3>
                        {notifications.length > 0 && (
                          <button 
                            onClick={() => setNotifications([])}
                            className="text-sm text-blue-600 hover:text-blue-700"
                          >
                            Limpiar todas
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((notif, index) => (
                          <div key={index} className="p-4 border-b border-gray-100 hover:bg-gray-50">
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0">
                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">{notif.title || 'Notificación'}</p>
                                <p className="text-sm text-gray-600 mt-1">{notif.message}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {new Date().toLocaleDateString('es-ES')}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center">
                          <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-500">No hay notificaciones</p>
                          <p className="text-sm text-gray-400 mt-1">Las notificaciones aparecerán aquí</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Configuración */}
              <div className="relative settings-panel">
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Configuración"
                >
                  <Settings className="w-5 h-5" />
                </button>

              </div>

              {/* Usuario */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="user-menu flex items-center space-x-2 text-gray-700 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <User className="w-5 h-5" />
                  {!isMobile && (
                    <span className="text-sm font-medium">
                      {userProfile?.nombreCompleto?.split(' ')[0] || currentUser.displayName || 'Usuario'}
                    </span>
                  )}
                </button>

                {/* Dropdown del usuario */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-40">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">
                        {userProfile?.nombreCompleto || 'Usuario'}
                      </p>
                      <p className="text-xs text-gray-500">{currentUser.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex relative">
        {/* Overlay para móvil */}
        {isMobile && isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar de navegación */}
        <nav className={`
          ${isMobile ? 'fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out' : 'relative'}
          ${isMobile && !isMobileMenuOpen ? '-translate-x-full' : 'translate-x-0'}
          ${isMobile ? 'w-80' : 'w-64'}
          bg-white shadow-lg border-r border-gray-200 min-h-screen
        `}>

          <div className={`${isMobile ? 'relative z-20' : ''} h-full`}>
            {/* Header del sidebar en móvil */}
            {isMobile && (
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                      <Package className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-gray-900">Inventario Pro</h2>
                      <p className="text-xs text-gray-500">Navegación</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Navegación */}
            <div className="p-4">
              <div className="space-y-2">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => setCurrentView(item.id)}
                      className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg text-left transition-all duration-200 group ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700'}`} />
                      <div className="flex-1">
                        <span className="font-medium">{item.label}</span>
                        {isMobile && (
                          <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                        )}
                      </div>
                      {isActive && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Información del almacén */}
            <div className="mt-auto p-4 border-t border-gray-200">
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-900 mb-1">
                  Almacén Activo
                </h4>
                <p className="text-xs text-gray-600">Almacén Principal</p>
                <div className="mt-2 flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-600">Conectado</span>
                </div>
              </div>

              {/* Stats rápidas en móvil */}
              {isMobile && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-500">Productos</p>
                    <p className="text-lg font-semibold text-gray-900">--</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-500">Alertas</p>
                    <p className="text-lg font-semibold text-orange-600">--</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* Contenido principal */}
        <main className={`flex-1 ${isMobile ? 'w-full' : 'ml-0'}`}>
          <div className="p-4 sm:p-6">
            <div className="max-w-7xl mx-auto">
              {renderContent()}
            </div>
          </div>
        </main>
      </div>

      {/* Navegación inferior en móvil */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30">
          <div className="grid grid-cols-4 gap-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className={`flex flex-col items-center justify-center py-2 px-1 transition-colors ${
                    isActive
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-5 h-5 mb-1" />
                  <span className="text-xs font-medium">{item.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Padding bottom para la navegación móvil */}
      {isMobile && <div className="h-16"></div>}

      {/* Contenedor de notificaciones */}
      <NotificationContainer />

      {/* Panel de Configuración */}
      <SettingsPanel 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)}
        onOpenWarehouseManager={() => setShowWarehouseManager(true)}
        onOpenFriendsManager={() => setShowFriendsManager(true)}
      />

      {/* Gestor de Almacenes */}
      <WarehouseManager
        isOpen={showWarehouseManager}
        onClose={() => setShowWarehouseManager(false)}
      />

      {/* Gestor de Amigos */}
      <FriendsManager
        isOpen={showFriendsManager}
        onClose={() => setShowFriendsManager(false)}
      />
    </div>
  );
}

// Componente principal con Provider
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;