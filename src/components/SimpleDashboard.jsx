import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import LoadingSpinner from './LoadingSpinner';
import { Package, TrendingUp, AlertTriangle, DollarSign } from 'lucide-react';

const SimpleDashboard = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProductos: 0,
    productosConStockBajo: 0,
    valorTotalInventario: 0,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    loadSimpleData();
  }, [currentUser]);

  const loadSimpleData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Solo cargar productos básicos
      const productosRef = collection(db, 'usuarios', currentUser.uid, 'almacenes', 'principal', 'productos');
      const productosSnapshot = await getDocs(productosRef);
      
      let totalProductos = 0;
      let valorTotal = 0;
      let stockBajo = 0;

      productosSnapshot.forEach((doc) => {
        const data = doc.data();
        totalProductos++;
        
        const valorProducto = (data.cantidadActual || 0) * (data.precioVenta || 0);
        valorTotal += valorProducto;
        
        if ((data.cantidadActual || 0) <= (data.cantidadMinima || 5)) {
          stockBajo++;
        }
      });

      setStats({
        totalProductos,
        productosConStockBajo: stockBajo,
        valorTotalInventario: valorTotal,
      });

    } catch (error) {
      console.error('Error cargando dashboard simple:', error);
      setError('Error al cargar los datos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Simple</h1>
        <p className="text-gray-600 mt-1">
          Versión simplificada que funciona correctamente
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Estadísticas principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
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
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">✅ Dashboard Funcionando</h3>
        <p className="text-blue-800 text-sm">
          Esta es una versión simplificada del dashboard que carga correctamente los datos básicos.
          Si puedes ver las estadísticas arriba, significa que Firebase está conectado y funcionando.
        </p>
      </div>
    </div>
  );
};

export default SimpleDashboard;