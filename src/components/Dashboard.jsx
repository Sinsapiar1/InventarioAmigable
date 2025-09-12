import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWarehouse } from '../contexts/WarehouseContext';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../firebase';
import LoadingSpinner from './LoadingSpinner';
import { 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  DollarSign,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Eye,
  Plus,
  Search,
  RefreshCw,
  Calendar,
  BarChart,
  Clipboard,
  X
} from 'lucide-react';

const Dashboard = () => {
  const { currentUser } = useAuth();
  const { activeWarehouse, getActiveWarehouse } = useWarehouse();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalProductos: 0,
    productosConStockBajo: 0,
    valorTotalInventario: 0,
    movimientosHoy: 0,
    movimientosSemana: 0,
    productosCreados: 0
  });
  const [recentProducts, setRecentProducts] = useState([]);
  const [recentMovements, setRecentMovements] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [error, setError] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [fullHistory, setFullHistory] = useState([]);

  // Cargar datos al montar el componente
  useEffect(() => {
    if (!currentUser) return;
    loadDashboardData();
  }, [currentUser]);

  // Recargar datos cuando cambia el almacén activo
  useEffect(() => {
    if (currentUser && activeWarehouse) {
      loadDashboardData();
    }
  }, [activeWarehouse]);

  // Auto-refresh del dashboard cada 30 segundos (menos molesto)
  useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(() => {
      // Solo recargar estadísticas, no todo
      loadStats();
    }, 30000); // Cada 30 segundos

    return () => clearInterval(interval);
  }, [currentUser]);

  // Cargar todos los datos del dashboard
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Cargar cada función individualmente para que si una falla, las otras continúen
      const results = await Promise.allSettled([
        loadStats(),
        loadRecentProducts(),
        loadRecentMovements(),
        loadLowStockProducts()
      ]);
      
      // Verificar si alguna función falló
      const failedOperations = results.filter(result => result.status === 'rejected');
      if (failedOperations.length > 0) {
        console.warn('Algunas operaciones fallaron:', failedOperations);
        // Mostrar advertencia pero no error completo
        if (failedOperations.length === results.length) {
          setError('Error al cargar algunos datos del dashboard');
        }
      }
      
    } catch (error) {
      console.error('Error cargando dashboard:', error);
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Cargar estadísticas generales
  const loadStats = async () => {
    try {
      // Obtener productos del almacén activo
      const productosRef = collection(db, 'usuarios', currentUser.uid, 'almacenes', activeWarehouse, 'productos');
      const productosSnapshot = await getDocs(productosRef);
      
      let totalProductos = 0;
      let valorTotal = 0;
      let stockBajo = 0;
      let productosCreados = 0;

      // Fecha de hoy para comparaciones
      const hoy = new Date();
      const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
      const inicioSemana = new Date(hoy.getTime() - (7 * 24 * 60 * 60 * 1000));

      productosSnapshot.forEach((doc) => {
        const data = doc.data();
        totalProductos++;
        
        // Calcular valor total
        const valorProducto = (data.cantidadActual || 0) * (data.precioVenta || 0);
        valorTotal += valorProducto;
        
        // Productos con stock bajo
        if ((data.cantidadActual || 0) <= (data.cantidadMinima || 5)) {
          stockBajo++;
        }

        // Productos creados hoy
        if (data.fechaCreacion) {
          const fechaCreacion = new Date(data.fechaCreacion);
          if (fechaCreacion >= inicioHoy) {
            productosCreados++;
          }
        }
      });

      // Obtener movimientos SIN where clause para evitar errores de índices
      let movimientosHoy = 0;
      let movimientosSemana = 0;

      try {
        const movimientosRef = collection(db, 'movimientos');
        const movimientosSnapshot = await getDocs(movimientosRef);

        movimientosSnapshot.forEach((doc) => {
          const data = doc.data();
          // Filtrar por usuario en el cliente
          if (data.usuarioId === currentUser.uid && data.fecha) {
            try {
              const fechaMovimiento = new Date(data.fecha);
              if (!isNaN(fechaMovimiento.getTime())) {
                if (fechaMovimiento >= inicioHoy) {
                  movimientosHoy++;
                }
                if (fechaMovimiento >= inicioSemana) {
                  movimientosSemana++;
                }
              }
            } catch (dateError) {
              console.warn('Error procesando fecha de movimiento:', data.fecha);
            }
          }
        });
      } catch (movError) {
        console.warn('Error cargando movimientos para estadísticas:', movError);
        // Continuar sin movimientos si hay error
        movimientosHoy = 0;
        movimientosSemana = 0;
      }

      setStats({
        totalProductos,
        productosConStockBajo: stockBajo,
        valorTotalInventario: valorTotal,
        movimientosHoy,
        movimientosSemana,
        productosCreados
      });

    } catch (error) {
      console.error('Error cargando estadísticas:', error);
      // No hacer throw, establecer valores por defecto
      setStats({
        totalProductos: 0,
        productosConStockBajo: 0,
        valorTotalInventario: 0,
        movimientosHoy: 0,
        movimientosSemana: 0,
        productosCreados: 0
      });
    }
  };

  // Cargar productos recientes
  const loadRecentProducts = async () => {
    try {
      const productosRef = collection(db, 'usuarios', currentUser.uid, 'almacenes', activeWarehouse, 'productos');
      const productosQuery = query(productosRef, orderBy('fechaCreacion', 'desc'), limit(5));
      const snapshot = await getDocs(productosQuery);
      
      const productos = [];
      snapshot.forEach((doc) => {
        productos.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setRecentProducts(productos);
    } catch (error) {
      console.error('Error cargando productos recientes:', error);
    }
  };

  // Cargar movimientos recientes (SIN consultas complejas que requieren índices)
  const loadRecentMovements = async () => {
    try {
      // Obtener TODOS los movimientos y filtrar en el cliente
      const movimientosRef = collection(db, 'movimientos');
      const snapshot = await getDocs(movimientosRef);
      
      const movimientos = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Filtrar por usuario en el cliente
        if (data.usuarioId === currentUser.uid) {
          movimientos.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      // Ordenar por fecha en el cliente y tomar solo 5
      movimientos.sort((a, b) => {
        if (!a.fecha || !b.fecha) return 0;
        return new Date(b.fecha) - new Date(a.fecha);
      });
      
      setRecentMovements(movimientos.slice(0, 5));
    } catch (error) {
      console.error('Error cargando movimientos recientes:', error);
      // Si falla, establecer array vacío
      setRecentMovements([]);
    }
  };

  // Cargar productos con stock bajo
  const loadLowStockProducts = async () => {
    try {
      const productosRef = collection(db, 'usuarios', currentUser.uid, 'almacenes', activeWarehouse, 'productos');
      const snapshot = await getDocs(productosRef);
      
      const productosStockBajo = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if ((data.cantidadActual || 0) <= (data.cantidadMinima || 5)) {
          productosStockBajo.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      setLowStockProducts(productosStockBajo.slice(0, 5)); // Solo 5 para el dashboard
    } catch (error) {
      console.error('Error cargando productos con stock bajo:', error);
    }
  };

  // Refrescar datos manualmente
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  // Cargar historial completo con más detalles
  const loadFullHistory = async () => {
    if (!currentUser || !activeWarehouse) return;

    try {
      const movimientosRef = collection(db, 'movimientos');
      const snapshot = await getDocs(movimientosRef);
      
      const movimientos = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Filtrar por usuario y almacén activo
        if (data.usuarioId === currentUser.uid && data.almacenId === activeWarehouse) {
          movimientos.push({
            id: doc.id,
            ...data,
            fecha: data.fecha ? new Date(data.fecha) : new Date()
          });
        }
      });

      // Ordenar por fecha (más recientes primero)
      movimientos.sort((a, b) => b.fecha - a.fecha);
      
      setFullHistory(movimientos);
    } catch (error) {
      console.error('Error cargando historial completo:', error);
    }
  };

  // Función para mostrar historial completo
  const handleShowFullHistory = async () => {
    setShowFullHistory(true);
    await loadFullHistory();
  };

  // Formatear números a moneda
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Formatear fecha relativa
  const formatRelativeDate = (dateString) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) return 'Hoy';
      if (diffDays === 2) return 'Ayer';
      if (diffDays <= 7) return `Hace ${diffDays - 1} días`;
      
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return 'Fecha inválida';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Cargando dashboard..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado con refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            <span className="font-medium text-blue-600">{getActiveWarehouse().nombre}</span> • Última actualización: {new Date().toLocaleTimeString('es-ES')}
          </p>
          <p className="text-xs text-gray-400 mt-2 hidden sm:block">
            Sistema desarrollado por <span className="font-medium text-gray-500">Raúl Jaime Pivet Álvarez</span> • Full Stack Developer
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm">Actualizar</span>
          </button>
          <div className="relative quick-actions-panel">
            <button 
              onClick={() => setShowQuickActions(!showQuickActions)}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Acción Rápida</span>
            </button>

            {/* Modal de Acciones Rápidas */}
            {showQuickActions && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-40">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Acciones Rápidas</h3>
                </div>
                <div className="p-4 space-y-3">
                  <button 
                    onClick={() => {
                      setShowQuickActions(false);
                      // Cambiar a la vista de productos
                      window.dispatchEvent(new CustomEvent('changeView', { detail: 'products' }));
                    }}
                    className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <Package className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Nuevo Producto</p>
                      <p className="text-xs text-gray-500">Agregar producto al inventario</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => {
                      setShowQuickActions(false);
                      window.dispatchEvent(new CustomEvent('changeView', { detail: 'movements' }));
                    }}
                    className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <ArrowUpDown className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Registrar Movimiento</p>
                      <p className="text-xs text-gray-500">Entrada o salida de productos</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => {
                      setShowQuickActions(false);
                      window.dispatchEvent(new CustomEvent('changeView', { detail: 'inventory' }));
                    }}
                    className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <Clipboard className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Toma de Inventario</p>
                      <p className="text-xs text-gray-500">Conteo físico de productos</p>
                    </div>
                  </button>

                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <button 
                      onClick={() => {
                        setShowQuickActions(false);
                        handleRefresh();
                      }}
                      className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <RefreshCw className="w-5 h-5 text-gray-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Actualizar Datos</p>
                        <p className="text-xs text-gray-500">Refrescar información</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mensaje de error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Estadísticas principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Total Productos */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Productos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalProductos}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
            <span className="text-green-600">+{stats.productosCreados} hoy</span>
          </div>
        </div>

        {/* Stock Bajo */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Stock Bajo</p>
              <p className="text-2xl font-bold text-orange-600">{stats.productosConStockBajo}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className={`${stats.productosConStockBajo > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {stats.productosConStockBajo > 0 ? 'Requieren atención' : 'Niveles óptimos'}
            </span>
          </div>
        </div>

        {/* Valor Total */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Valor Total</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(stats.valorTotalInventario)}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <ArrowUp className="w-4 h-4 text-green-600 mr-1" />
            <span className="text-green-600">Inventario total</span>
          </div>
        </div>

        {/* Actividad */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Actividad</p>
              <p className="text-2xl font-bold text-purple-600">{stats.movimientosHoy}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <BarChart className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <Calendar className="w-4 h-4 text-purple-600 mr-1" />
            <span className="text-purple-600">{stats.movimientosSemana} esta semana</span>
          </div>
        </div>
      </div>

      {/* Contenido principal en dos columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Productos Recientes */}
        <div className="card">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Productos Recientes</h3>
              <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                Ver todos
              </button>
            </div>
          </div>
          <div className="p-6">
            {recentProducts.length > 0 ? (
              <div className="space-y-4">
                {recentProducts.slice(0, 5).map((producto) => (
                  <div key={producto.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{producto.nombre}</h4>
                      <div className="flex items-center space-x-2 mt-1">
                        <p className="text-sm text-gray-600">SKU: {producto.sku}</p>
                        <span className="text-gray-400">•</span>
                        <p className="text-sm text-gray-600">{producto.categoria}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{producto.cantidadActual || 0}</p>
                      <p className="text-xs text-gray-500">{formatRelativeDate(producto.fechaCreacion)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No hay productos registrados</p>
                <button className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
                  Crear tu primer producto
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Alertas de Stock */}
        <div className="card">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Alertas de Stock</h3>
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <div className="p-6">
            {lowStockProducts.length > 0 ? (
              <div className="space-y-4">
                {lowStockProducts.slice(0, 5).map((producto) => (
                  <div key={producto.id} className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{producto.nombre}</h4>
                      <p className="text-sm text-gray-600">SKU: {producto.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-orange-600">{producto.cantidadActual || 0}</p>
                      <p className="text-xs text-orange-500">Min: {producto.cantidadMinima || 5}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-green-600 font-medium">Todo el stock está en niveles óptimos</p>
                <p className="text-sm text-gray-500 mt-1">No hay productos con stock bajo</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actividad Reciente */}
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Actividad Reciente</h3>
            <button 
              onClick={handleShowFullHistory}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Ver historial completo
            </button>
          </div>
        </div>
        <div className="overflow-hidden">
          {recentMovements.length > 0 ? (
            <>
              {/* Vista de tabla para desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Producto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cantidad
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentMovements.slice(0, 5).map((movimiento) => (
                      <tr key={movimiento.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {movimiento.productoNombre}
                          </div>
                          <div className="text-sm text-gray-500">
                            {movimiento.productoSKU}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            movimiento.tipoMovimiento === 'entrada' 
                              ? 'bg-green-100 text-green-800' 
                              : movimiento.tipoMovimiento === 'salida'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {movimiento.tipoMovimiento === 'entrada' && <ArrowUp className="w-3 h-3 mr-1" />}
                            {movimiento.tipoMovimiento === 'salida' && <ArrowDown className="w-3 h-3 mr-1" />}
                            {movimiento.subTipo}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {movimiento.tipoMovimiento === 'entrada' ? '+' : '-'}{movimiento.cantidad}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatRelativeDate(movimiento.fecha)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Vista de lista para móvil */}
              <div className="md:hidden space-y-3 p-4">
                {recentMovements.slice(0, 5).map((movimiento) => (
                  <div
                    key={movimiento.id}
                    className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {movimiento.productoNombre}
                        </h4>
                        <p className="text-xs text-gray-500">{movimiento.productoSKU}</p>
                      </div>
                      <div className="flex items-center space-x-2 ml-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          movimiento.tipoMovimiento === 'entrada' 
                            ? 'bg-green-100 text-green-800' 
                            : movimiento.tipoMovimiento === 'salida'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {movimiento.tipoMovimiento === 'entrada' && <ArrowUp className="w-3 h-3 mr-1" />}
                          {movimiento.tipoMovimiento === 'salida' && <ArrowDown className="w-3 h-3 mr-1" />}
                          {movimiento.subTipo}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className={`font-medium ${
                        movimiento.tipoMovimiento === 'entrada' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {movimiento.tipoMovimiento === 'entrada' ? '+' : '-'}{movimiento.cantidad}
                      </span>
                      <span className="text-gray-500 text-xs">
                        {formatRelativeDate(movimiento.fecha)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
            
          ) : (
            <div className="text-center py-12">
              <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No hay movimientos registrados</p>
              <p className="text-sm text-gray-400 mt-1">Los movimientos aparecerán aquí una vez que empieces a usar el sistema</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Historial Completo */}
      {showFullHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Historial Completo - {getActiveWarehouse()?.nombre}
                </h2>
                <button
                  onClick={() => setShowFullHistory(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="overflow-auto max-h-[70vh]">
              {fullHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fecha
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Producto
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tipo
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Detalle
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Cantidad
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Stock
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Usuario
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Razón
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {fullHistory.map((movement) => (
                        <tr key={movement.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {movement.fecha.toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {movement.productoNombre}
                              </div>
                              <div className="text-sm text-gray-500">
                                SKU: {movement.productoSKU}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              movement.tipoMovimiento === 'entrada' 
                                ? 'bg-green-100 text-green-800'
                                : movement.tipoMovimiento === 'salida'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {movement.tipoMovimiento}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {movement.subTipo}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={
                              movement.tipoMovimiento === 'entrada' 
                                ? 'text-green-600 font-medium'
                                : movement.tipoMovimiento === 'salida'
                                ? 'text-red-600 font-medium'
                                : 'text-blue-600 font-medium'
                            }>
                              {movement.tipoMovimiento === 'entrada' ? '+' : movement.tipoMovimiento === 'salida' ? '-' : '±'}
                              {movement.cantidad}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {movement.stockAnterior} → {movement.stockNuevo}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {movement.creadoPor}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                            {movement.razon}
                            {movement.observaciones && (
                              <div className="text-xs text-gray-500 mt-1">
                                {movement.observaciones}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No hay movimientos registrados</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Los movimientos aparecerán aquí una vez que empieces a usar el sistema
                  </p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>Total de movimientos: {fullHistory.length}</span>
                <button
                  onClick={() => setShowFullHistory(false)}
                  className="btn-secondary"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;