import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
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
  Eye,
  Plus,
  Search,
  RefreshCw,
  Calendar,
  BarChart
} from 'lucide-react';

const Dashboard = () => {
  const { currentUser } = useAuth();
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

  // Cargar datos al montar el componente
  useEffect(() => {
    if (!currentUser) return;
    loadDashboardData();
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
      // Obtener productos
      const productosRef = collection(db, 'usuarios', currentUser.uid, 'almacenes', 'principal', 'productos');
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

      // Obtener todos los movimientos del usuario y filtrar en el cliente
      const movimientosRef = collection(db, 'movimientos');
      const movimientosQuery = query(
        movimientosRef,
        where('usuarioId', '==', currentUser.uid)
      );
      const movimientosSnapshot = await getDocs(movimientosQuery);

      let movimientosHoy = 0;
      let movimientosSemana = 0;

      movimientosSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.fecha) {
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
      const productosRef = collection(db, 'usuarios', currentUser.uid, 'almacenes', 'principal', 'productos');
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

  // Cargar movimientos recientes
  const loadRecentMovements = async () => {
    try {
      const movimientosRef = collection(db, 'movimientos');
      const movimientosQuery = query(
        movimientosRef,
        where('usuarioId', '==', currentUser.uid),
        limit(10)
      );
      const snapshot = await getDocs(movimientosQuery);
      
      const movimientos = [];
      snapshot.forEach((doc) => {
        movimientos.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Ordenar en el cliente y tomar solo 5
      movimientos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
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
      const productosRef = collection(db, 'usuarios', currentUser.uid, 'almacenes', 'principal', 'productos');
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
            Resumen general de tu inventario • Última actualización: {new Date().toLocaleTimeString('es-ES')}
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
          <button className="btn-primary flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Acción Rápida</span>
          </button>
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
            <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
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
    </div>
  );
};

export default Dashboard;