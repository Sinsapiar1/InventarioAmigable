import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  onSnapshot,
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
} from 'lucide-react';

const Dashboard = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProductos: 0,
    productosConStockBajo: 0,
    valorTotalInventario: 0,
    movimientosHoy: 0,
  });
  const [recentProducts, setRecentProducts] = useState([]);
  const [recentMovements, setRecentMovements] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);

  // Cargar datos del dashboard
  useEffect(() => {
    if (!currentUser) return;

    const loadDashboardData = async () => {
      try {
        await Promise.all([
          loadStats(),
          loadRecentProducts(),
          loadRecentMovements(),
          loadLowStockProducts(),
        ]);
      } catch (error) {
        console.error('Error cargando dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();

    // Suscribirse a cambios en tiempo real para productos
    const productosRef = collection(
      db,
      'usuarios',
      currentUser.uid,
      'almacenes',
      'principal',
      'productos'
    );
    const unsubscribe = onSnapshot(productosRef, () => {
      loadStats();
      loadRecentProducts();
      loadLowStockProducts();
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Cargar estadísticas generales
  const loadStats = async () => {
    try {
      // Productos del almacén principal
      const productosRef = collection(
        db,
        'usuarios',
        currentUser.uid,
        'almacenes',
        'principal',
        'productos'
      );
      const productosSnapshot = await getDocs(productosRef);

      let totalProductos = 0;
      let valorTotal = 0;
      let stockBajo = 0;

      productosSnapshot.forEach((doc) => {
        const data = doc.data();
        totalProductos++;

        // Calcular valor total (cantidad * precio de venta)
        const valorProducto =
          (data.cantidadActual || 0) * (data.precioVenta || 0);
        valorTotal += valorProducto;

        // Productos con stock bajo (menos de cantidadMinima)
        if ((data.cantidadActual || 0) <= (data.cantidadMinima || 5)) {
          stockBajo++;
        }
      });

      // Movimientos de hoy
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const movimientosRef = collection(db, 'movimientos');
      const movimientosQuery = query(
        movimientosRef,
        where('usuarioId', '==', currentUser.uid),
        where('fecha', '>=', hoy.toISOString())
      );
      const movimientosSnapshot = await getDocs(movimientosQuery);

      setStats({
        totalProductos,
        productosConStockBajo: stockBajo,
        valorTotalInventario: valorTotal,
        movimientosHoy: movimientosSnapshot.size,
      });
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  // Cargar productos recientes
  const loadRecentProducts = async () => {
    try {
      const productosRef = collection(
        db,
        'usuarios',
        currentUser.uid,
        'almacenes',
        'principal',
        'productos'
      );
      const productosQuery = query(
        productosRef,
        orderBy('fechaCreacion', 'desc'),
        limit(5)
      );
      const snapshot = await getDocs(productosQuery);

      const productos = [];
      snapshot.forEach((doc) => {
        productos.push({
          id: doc.id,
          ...doc.data(),
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
        orderBy('fecha', 'desc'),
        limit(5)
      );
      const snapshot = await getDocs(movimientosQuery);

      const movimientos = [];
      snapshot.forEach((doc) => {
        movimientos.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      setRecentMovements(movimientos);
    } catch (error) {
      console.error('Error cargando movimientos recientes:', error);
    }
  };

  // Cargar productos con stock bajo
  const loadLowStockProducts = async () => {
    try {
      const productosRef = collection(
        db,
        'usuarios',
        currentUser.uid,
        'almacenes',
        'principal',
        'productos'
      );
      const snapshot = await getDocs(productosRef);

      const productosStockBajo = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if ((data.cantidadActual || 0) <= (data.cantidadMinima || 5)) {
          productosStockBajo.push({
            id: doc.id,
            ...data,
          });
        }
      });

      setLowStockProducts(productosStockBajo);
    } catch (error) {
      console.error('Error cargando productos con stock bajo:', error);
    }
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

  // Formatear fecha
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Resumen general de tu inventario</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button className="btn-primary flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Acción Rápida</span>
          </button>
        </div>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Productos */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Total Productos
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalProductos}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
            <span className="text-green-600">Activos</span>
          </div>
        </div>

        {/* Stock Bajo */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Stock Bajo</p>
              <p className="text-2xl font-bold text-orange-600">
                {stats.productosConStockBajo}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-orange-600">Requieren atención</span>
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

        {/* Movimientos Hoy */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Movimientos Hoy
              </p>
              <p className="text-2xl font-bold text-purple-600">
                {stats.movimientosHoy}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-purple-600">Actividad del día</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Productos Recientes */}
        <div className="card">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Productos Recientes
              </h3>
              <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                Ver todos
              </button>
            </div>
          </div>
          <div className="p-6">
            {recentProducts.length > 0 ? (
              <div className="space-y-4">
                {recentProducts.map((producto) => (
                  <div
                    key={producto.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        {producto.nombre}
                      </h4>
                      <p className="text-sm text-gray-600">
                        SKU: {producto.sku}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {producto.cantidadActual}
                      </p>
                      <p className="text-xs text-gray-500">unidades</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No hay productos registrados</p>
              </div>
            )}
          </div>
        </div>

        {/* Productos con Stock Bajo */}
        <div className="card">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Alertas de Stock
              </h3>
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <div className="p-6">
            {lowStockProducts.length > 0 ? (
              <div className="space-y-4">
                {lowStockProducts.map((producto) => (
                  <div
                    key={producto.id}
                    className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        {producto.nombre}
                      </h4>
                      <p className="text-sm text-gray-600">
                        SKU: {producto.sku}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-orange-600">
                        {producto.cantidadActual}
                      </p>
                      <p className="text-xs text-orange-500">
                        Min: {producto.cantidadMinima || 5}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-green-600 font-medium">
                  Todo el stock está en niveles óptimos
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Movimientos Recientes */}
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Movimientos Recientes
            </h3>
            <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              Ver historial completo
            </button>
          </div>
        </div>
        <div className="overflow-hidden">
          {recentMovements.length > 0 ? (
            <div className="overflow-x-auto">
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
                  {recentMovements.map((movimiento) => (
                    <tr key={movimiento.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {movimiento.productoSKU}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            movimiento.tipoMovimiento === 'entrada'
                              ? 'bg-green-100 text-green-800'
                              : movimiento.tipoMovimiento === 'salida'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {movimiento.tipoMovimiento === 'entrada' && (
                            <ArrowUp className="w-3 h-3 mr-1" />
                          )}
                          {movimiento.tipoMovimiento === 'salida' && (
                            <ArrowDown className="w-3 h-3 mr-1" />
                          )}
                          {movimiento.subTipo}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {movimiento.cantidad}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(movimiento.fecha)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No hay movimientos registrados</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
