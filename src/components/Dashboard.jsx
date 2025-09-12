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
// import NotificationPermission from './NotificationPermission'; // Temporalmente deshabilitado
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
  X,
  ArrowRight,
  Download
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
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [allProducts, setAllProducts] = useState([]);

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
      // Cargar movimientos
      const movimientosRef = collection(db, 'movimientos');
      const snapshot = await getDocs(movimientosRef);
      
      // Cargar solicitudes de traspaso para obtener información adicional
      const solicitudesRef = collection(db, 'solicitudes-traspaso');
      const solicitudesSnapshot = await getDocs(solicitudesRef);
      
      // Crear mapa de solicitudes por producto y fecha para enriquecer información
      const solicitudesMap = new Map();
      solicitudesSnapshot.forEach((doc) => {
        const solicitud = doc.data();
        if (solicitud.usuarioDestinoId === currentUser.uid) {
          const key = `${solicitud.productoSKU}_${solicitud.cantidad}`;
          solicitudesMap.set(key, solicitud);
        }
      });
      
      const movimientos = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Filtrar por usuario y almacén activo
        if (data.usuarioId === currentUser.uid && data.almacenId === activeWarehouse) {
          let enrichedData = { ...data };
          
          // Enriquecer traspasos externos con información de solicitud
          if (data.subTipo === 'Traspaso externo aprobado' && data.tipoMovimiento === 'entrada') {
            const key = `${data.productoSKU}_${data.cantidad}`;
            const solicitud = solicitudesMap.get(key);
            if (solicitud) {
              enrichedData.usuarioOrigenNombre = solicitud.usuarioOrigenNombre;
              enrichedData.usuarioOrigenEmail = solicitud.usuarioOrigenEmail;
              enrichedData.almacenOrigenNombre = solicitud.almacenOrigenNombre;
            }
          }
          
          movimientos.push({
            id: doc.id,
            ...enrichedData,
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

  // Cargar todos los productos del almacén activo
  const loadAllProducts = async () => {
    if (!currentUser || !activeWarehouse) return;

    try {
      const productosRef = collection(
        db,
        'usuarios',
        currentUser.uid,
        'almacenes',
        activeWarehouse,
        'productos'
      );
      const snapshot = await getDocs(productosRef);

      const productos = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        productos.push({
          id: doc.id,
          ...data,
          fechaCreacion: data.fechaCreacion ? new Date(data.fechaCreacion) : new Date(),
          fechaActualizacion: data.fechaActualizacion ? new Date(data.fechaActualizacion) : new Date()
        });
      });

      // Ordenar por fecha de creación (más recientes primero)
      productos.sort((a, b) => b.fechaCreacion - a.fechaCreacion);
      
      setAllProducts(productos);
    } catch (error) {
      console.error('Error cargando todos los productos:', error);
    }
  };

  // Función para mostrar todos los productos
  const handleShowAllProducts = async () => {
    setShowAllProducts(true);
    await loadAllProducts();
  };

  // Exportar todos los productos
  const exportAllProducts = () => {
    const csvData = allProducts.map((product) => ({
      SKU: product.sku,
      Nombre: product.nombre,
      Categoria: product.categoria,
      StockActual: product.cantidadActual,
      StockMinimo: product.cantidadMinima,
      PrecioCompra: product.precioCompra || 0,
      PrecioVenta: product.precioVenta || 0,
      FechaCreacion: product.fechaCreacion.toLocaleDateString('es-ES'),
      UltimaActualizacion: product.fechaActualizacion.toLocaleDateString('es-ES'),
      Almacen: getActiveWarehouse()?.nombre || 'N/A',
      CreadoPor: product.creadoPor || 'N/A'
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map((row) => Object.values(row).map(val => `"${val}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `productos_${getActiveWarehouse()?.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Exportar historial completo
  const exportFullHistory = () => {
    const csvData = fullHistory.map((movement) => {
      const { origenDestino, usuarioInfo, detallesInteligentes } = getMovementDetails(movement);
      
      return {
        Fecha: movement.fecha.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        Producto: movement.productoNombre,
        SKU: movement.productoSKU,
        Operacion: movement.tipoMovimiento,
        SubTipo: movement.subTipo,
        Cantidad: `${movement.tipoMovimiento === 'entrada' ? '+' : movement.tipoMovimiento === 'salida' ? '-' : '±'}${movement.cantidad}`,
        StockAnterior: movement.stockAnterior !== undefined ? movement.stockAnterior : 'N/A',
        StockNuevo: movement.stockNuevo !== undefined ? movement.stockNuevo : 'N/A',
        OrigenDestino: origenDestino,
        UsuarioInfo: usuarioInfo,
        Razon: movement.razon || '',
        Observaciones: movement.observaciones || '',
        DetallesCompletos: detallesInteligentes,
        CreadoPor: movement.creadoPor,
        Almacen: getActiveWarehouse()?.nombre || 'N/A'
      };
    });

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map((row) => Object.values(row).map(val => `"${val}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial_completo_${getActiveWarehouse()?.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Generar información inteligente de origen/destino
  const getMovementDetails = (movement) => {
    const { subTipo, razon, observaciones, tipoMovimiento, creadoPor, usuarioOrigenNombre, usuarioOrigenEmail, almacenOrigenNombre } = movement;
    
    let origenDestino = '';
    let usuarioInfo = '';
    let detallesInteligentes = '';
    
    // Información inteligente según el tipo de movimiento
    if (subTipo.includes('traspaso') || subTipo.includes('Traspaso')) {
      if (subTipo.includes('externo')) {
        // Traspaso externo - extraer información específica
        if (tipoMovimiento === 'entrada') {
          // Si es entrada, alguien me envió algo
          let usuarioOrigen = 'Colaborador';
          let almacenOrigen = '';
          
          // Usar información enriquecida si está disponible
          if (usuarioOrigenNombre) {
            usuarioOrigen = usuarioOrigenNombre;
            almacenOrigen = almacenOrigenNombre ? ` (${almacenOrigenNombre})` : '';
          } else {
            // Fallback: intentar extraer desde otros campos
            if (observaciones && observaciones.trim()) {
              usuarioOrigen = observaciones.trim();
            } else if (razon && razon.includes('→')) {
              const partes = razon.split('→');
              usuarioOrigen = partes[0]?.trim() || 'Colaborador';
            }
          }
          
          origenDestino = `De: ${usuarioOrigen}${almacenOrigen}`;
          usuarioInfo = usuarioOrigenEmail ? `Email: ${usuarioOrigenEmail}` : 'Traspaso aprobado';
          detallesInteligentes = `Recibido de ${usuarioOrigen} • Traspaso externo aprobado`;
        } else {
          // Si es salida, yo envié algo
          let usuarioDestino = 'Colaborador';
          
          if (observaciones && observaciones.trim()) {
            usuarioDestino = observaciones.trim();
          } else if (razon && razon.includes('→')) {
            const partes = razon.split('→');
            usuarioDestino = partes[1]?.trim() || 'Colaborador';
          }
          
          origenDestino = `Para: ${usuarioDestino}`;
          usuarioInfo = `Enviado por: ${creadoPor}`;
          detallesInteligentes = `Enviado a ${usuarioDestino} • ${razon || 'Traspaso externo'}`;
        }
      } else if (subTipo.includes('interno')) {
        if (tipoMovimiento === 'entrada') {
          origenDestino = razon.includes('desde') 
            ? `De: ${razon.split('desde ')[1]?.trim() || 'Otro almacén'}`
            : 'De: Otro almacén';
          usuarioInfo = 'Traspaso interno';
        } else {
          origenDestino = 'Para: Otro almacén';
          usuarioInfo = `Por: ${creadoPor}`;
        }
        detallesInteligentes = `Traspaso entre mis almacenes • ${observaciones || 'Movimiento interno'}`;
      } else if (subTipo === 'Traspaso a otro almacén') {
        // Traspaso interno - detectar por subTipo específico
        if (tipoMovimiento === 'salida') {
          origenDestino = 'Para: Mi otro almacén';
          usuarioInfo = `Por: ${creadoPor}`;
          detallesInteligentes = `Enviado a mi otro almacén • ${razon || 'Traspaso interno'}`;
        } else {
          origenDestino = 'De: Mi otro almacén';
          usuarioInfo = 'Traspaso interno';
          detallesInteligentes = `Recibido de mi otro almacén • ${razon || 'Traspaso interno'}`;
        }
      } else if (subTipo === 'Traspaso desde otro almacén') {
        origenDestino = 'De: Mi otro almacén';
        usuarioInfo = 'Traspaso interno';
        detallesInteligentes = `Recibido de mi otro almacén • ${razon || 'Traspaso interno'}`;
      } else {
        origenDestino = 'Traspaso interno';
        usuarioInfo = `Por: ${creadoPor}`;
        detallesInteligentes = `${subTipo} • ${razon || 'Entre almacenes'}`;
      }
    } else if (subTipo.includes('importacion')) {
      origenDestino = 'Importación masiva';
      usuarioInfo = `Por: ${creadoPor}`;
      detallesInteligentes = `Creado/actualizado por import • ${observaciones || 'Sin comentarios'}`;
    } else if (subTipo.includes('inventario')) {
      origenDestino = 'Toma de inventario';
      usuarioInfo = `Por: ${creadoPor}`;
      detallesInteligentes = `Ajuste físico • ${observaciones || 'Conteo manual'}`;
    } else if (subTipo.includes('proveedor')) {
      origenDestino = 'Proveedor';
      usuarioInfo = `Registrado por: ${creadoPor}`;
      detallesInteligentes = `Compra • ${observaciones || 'Sin detalles'}`;
    } else if (subTipo.includes('cliente')) {
      origenDestino = 'Cliente';
      usuarioInfo = `Registrado por: ${creadoPor}`;
      detallesInteligentes = tipoMovimiento === 'entrada' 
        ? `Devolución de cliente • ${observaciones || ''}`
        : `Venta a cliente • ${observaciones || ''}`;
    } else if (subTipo.includes('ajuste')) {
      origenDestino = 'Ajuste manual';
      usuarioInfo = `Por: ${creadoPor}`;
      detallesInteligentes = `${tipoMovimiento === 'entrada' ? 'Corrección positiva' : 'Corrección negativa'} • ${razon}`;
    } else {
      origenDestino = 'Sistema';
      usuarioInfo = `Por: ${creadoPor}`;
      detallesInteligentes = subTipo;
    }
    
    return { origenDestino, usuarioInfo, detallesInteligentes };
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
      {/* Componente de permisos push - Temporalmente deshabilitado */}
      {/* <NotificationPermission /> */}

      {/* Encabezado con refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-800 dark:text-white mt-1 font-medium">
            <span className="font-semibold text-blue-700 dark:text-blue-100">{getActiveWarehouse().nombre}</span> • Última actualización: {new Date().toLocaleTimeString('es-ES')}
          </p>
          <p className="text-xs text-gray-800 dark:text-white mt-2 hidden sm:block font-medium">
            Sistema desarrollado por <span className="font-semibold text-gray-800 dark:text-white">Raúl Jaime Pivet Álvarez</span> • Full Stack Developer
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
              <div className="absolute right-0 mt-2 w-64 notification-panel rounded-lg z-40">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Acciones Rápidas</h3>
                </div>
                <div className="p-4 space-y-3">
                  <button 
                    onClick={() => {
                      setShowQuickActions(false);
                      // Cambiar a la vista de productos
                      window.dispatchEvent(new CustomEvent('changeView', { detail: 'products' }));
                    }}
                    className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <Package className="w-5 h-5 text-blue-600 dark:text-blue-400 dark:text-blue-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Nuevo Producto</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Agregar producto al inventario</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => {
                      setShowQuickActions(false);
                      window.dispatchEvent(new CustomEvent('changeView', { detail: 'movements' }));
                    }}
                    className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <ArrowUpDown className="w-5 h-5 text-green-900 dark:text-white" />
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
                    className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <Clipboard className="w-5 h-5 text-purple-900 dark:text-white" />
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
                      className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
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
        <div className="stat-card stat-accent-blue">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-800 dark:text-white">Total Productos</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalProductos}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg shadow-blue-500/20 dark:shadow-blue-500/10">
              <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="w-4 h-4 text-green-900 dark:text-white mr-1" />
            <span className="text-green-900 dark:text-white font-black">+{stats.productosCreados} hoy</span>
          </div>
        </div>

        {/* Stock Bajo */}
        <div className="stat-card stat-accent-orange">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-white">Stock Bajo</p>
              <p className="text-2xl font-bold text-orange-900 dark:text-white dark:text-orange-400">{stats.productosConStockBajo}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/30 dark:to-orange-800/30 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-orange-900 dark:text-white" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className={`${stats.productosConStockBajo > 0 ? 'text-orange-900 dark:text-white' : 'text-green-900 dark:text-white'}`}>
              {stats.productosConStockBajo > 0 ? 'Requieren atención' : 'Niveles óptimos'}
            </span>
          </div>
        </div>

        {/* Valor Total */}
        <div className="stat-card stat-accent-green">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-white">Valor Total</p>
              <p className="text-2xl font-bold text-green-900 dark:text-white dark:text-green-400">
                {formatCurrency(stats.valorTotalInventario)}
              </p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-900 dark:text-white" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <ArrowUp className="w-4 h-4 text-green-900 dark:text-white mr-1" />
            <span className="text-green-900 dark:text-white font-black">Inventario total</span>
          </div>
        </div>

        {/* Actividad */}
        <div className="stat-card stat-accent-purple">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-white">Actividad</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-white dark:text-purple-400">{stats.movimientosHoy}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 rounded-lg flex items-center justify-center">
              <BarChart className="w-6 h-6 text-purple-900 dark:text-white" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <Calendar className="w-4 h-4 text-purple-900 dark:text-white mr-1" />
            <span className="text-purple-900 dark:text-white dark:text-purple-400">{stats.movimientosSemana} esta semana</span>
          </div>
        </div>
      </div>

      {/* Contenido principal en dos columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Productos Recientes */}
        <div className="card">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Productos Recientes</h3>
              <button 
                onClick={handleShowAllProducts}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 text-sm font-medium"
              >
                Ver todos
              </button>
            </div>
          </div>
          <div className="p-6">
            {recentProducts.length > 0 ? (
              <div className="space-y-4">
                {recentProducts.slice(0, 5).map((producto) => (
                  <div key={producto.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white">{producto.nombre}</h4>
                      <div className="flex items-center space-x-2 mt-1">
                        <p className="text-sm text-gray-800 dark:text-white">SKU: {producto.sku}</p>
                        <span className="text-gray-400 dark:text-gray-500">•</span>
                        <p className="text-sm text-gray-800 dark:text-white">{producto.categoria}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 dark:text-white">{producto.cantidadActual || 0}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatRelativeDate(producto.fechaCreacion)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No hay productos registrados</p>
                <button className="mt-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 text-sm font-medium">
                  Crear tu primer producto
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Alertas de Stock */}
        <div className="card">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Alertas de Stock</h3>
              <AlertTriangle className="w-5 h-5 text-orange-900 dark:text-white" />
            </div>
          </div>
          <div className="p-6">
            {lowStockProducts.length > 0 ? (
              <div className="space-y-4">
                {lowStockProducts.slice(0, 5).map((producto) => (
                  <div key={producto.id} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white">{producto.nombre}</h4>
                      <p className="text-sm text-gray-800 dark:text-white">SKU: {producto.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-orange-900 dark:text-white dark:text-orange-400">{producto.cantidadActual || 0}</p>
                      <p className="text-xs text-orange-500 dark:text-orange-400">Min: {producto.cantidadMinima || 5}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-6 h-6 text-green-900 dark:text-white" />
                </div>
                <p className="text-green-900 dark:text-white font-medium">Todo el stock está en niveles óptimos</p>
                <p className="text-sm text-gray-500 mt-1">No hay productos con stock bajo</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actividad Reciente */}
      <div className="card">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Actividad Reciente</h3>
            <button 
              onClick={handleShowFullHistory}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 text-sm font-medium"
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
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="table-header">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        Producto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        Cantidad
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        Fecha
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {recentMovements.slice(0, 5).map((movimiento) => (
                      <tr key={movimiento.id} className="table-row">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {movimiento.productoNombre}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {movimiento.productoSKU}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            movimiento.tipoMovimiento === 'entrada' 
                              ? 'bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 text-green-800' 
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
                            ? 'bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 text-green-800' 
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
                        movimiento.tipoMovimiento === 'entrada' ? 'text-green-900 dark:text-white' : 'text-red-600'
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

      {/* Modal de Todos los Productos */}
      {showAllProducts && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 p-4">
          <div className="modal-container w-full max-w-7xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Todos los Productos - {getActiveWarehouse()?.nombre}
                </h2>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={exportAllProducts}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exportar</span>
                  </button>
                  <button
                    onClick={() => setShowAllProducts(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="overflow-auto max-h-[70vh]">
              {allProducts.length > 0 ? (
                <>
                  {/* Vista Desktop */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Producto
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            SKU
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Stock
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Precios
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                            Fechas
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Estado
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {allProducts.map((product) => {
                          const isLowStock = product.cantidadActual <= product.cantidadMinima;
                          
                          return (
                            <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-4 py-3">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {product.nombre}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {product.categoria}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                                {product.sku}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center space-x-2">
                                  <span className={`font-bold ${isLowStock ? 'text-red-600' : 'text-green-900 dark:text-white'}`}>
                                    {product.cantidadActual}
                                  </span>
                                  <span className="text-gray-400">/</span>
                                  <span className="text-sm text-gray-500">
                                    {product.cantidadMinima}
                                  </span>
                                  {isLowStock && (
                                    <AlertTriangle className="w-4 h-4 text-red-500" />
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-sm">
                                  <div className="text-green-900 dark:text-white font-medium">
                                    ${product.precioVenta || 0}
                                  </div>
                                  <div className="text-gray-500 text-xs">
                                    Compra: ${product.precioCompra || 0}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">
                                <div>
                                  <div className="text-xs">
                                    Creado: {product.fechaCreacion.toLocaleDateString('es-ES')}
                                  </div>
                                  <div className="text-xs">
                                    Actualizado: {product.fechaActualizacion.toLocaleDateString('es-ES')}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  isLowStock 
                                    ? 'bg-red-100 text-red-800'
                                    : product.cantidadActual === 0
                                    ? 'bg-gray-100 text-gray-800'
                                    : 'bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 text-green-800'
                                }`}>
                                  {isLowStock ? 'Stock Bajo' : product.cantidadActual === 0 ? 'Sin Stock' : 'Disponible'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Vista Móvil */}
                  <div className="md:hidden space-y-4 p-4">
                    {allProducts.map((product) => {
                      const isLowStock = product.cantidadActual <= product.cantidadMinima;
                      
                      return (
                        <div key={product.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-medium text-gray-900">
                                {product.nombre}
                              </h4>
                              <p className="text-sm text-gray-500">{product.categoria}</p>
                              <p className="text-xs text-gray-400 font-mono mt-1">{product.sku}</p>
                            </div>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              isLowStock 
                                ? 'bg-red-100 text-red-800'
                                : product.cantidadActual === 0
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 text-green-800'
                            }`}>
                              {isLowStock ? 'Stock Bajo' : product.cantidadActual === 0 ? 'Sin Stock' : 'Disponible'}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Stock Actual</p>
                              <p className={`font-bold text-lg ${isLowStock ? 'text-red-600' : 'text-green-900 dark:text-white'}`}>
                                {product.cantidadActual}
                              </p>
                              <p className="text-xs text-gray-500">Mínimo: {product.cantidadMinima}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Precio Venta</p>
                              <p className="font-bold text-lg text-green-900 dark:text-white">
                                ${product.precioVenta || 0}
                              </p>
                              <p className="text-xs text-gray-500">Compra: ${product.precioCompra || 0}</p>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t">
                            <span>
                              Creado: {product.fechaCreacion.toLocaleDateString('es-ES')}
                            </span>
                            <span>
                              Actualizado: {product.fechaActualizacion.toLocaleDateString('es-ES')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No hay productos en este almacén</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Crea tu primer producto para comenzar
                  </p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>Total de productos: {allProducts.length}</span>
                <button
                  onClick={() => setShowAllProducts(false)}
                  className="btn-secondary"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Historial Completo */}
      {showFullHistory && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 p-4">
          <div className="modal-container w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Historial Completo - {getActiveWarehouse()?.nombre}
                </h2>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={exportFullHistory}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exportar</span>
                  </button>
                  <button
                    onClick={() => setShowFullHistory(false)}
                    className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="overflow-auto max-h-[70vh]">
              {fullHistory.length > 0 ? (
                <>
                  {/* Vista Desktop */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="table-header">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider">
                            Fecha
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider">
                            Producto
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider">
                            Operación
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider">
                            Cantidad
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider">
                            Origen/Destino
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider hidden xl:table-cell">
                            Detalles
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {fullHistory.map((movement) => {
                          const { origenDestino, usuarioInfo, detallesInteligentes } = getMovementDetails(movement);
                          
                          return (
                            <tr key={movement.id} className="table-row">
                              <td className="px-3 py-2 whitespace-nowrap text-sm">
                                <div className="text-xs text-gray-900 dark:text-gray-100 font-medium">
                                  {movement.fecha.toLocaleDateString('es-ES', {
                                    day: '2-digit',
                                    month: '2-digit'
                                  })}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {movement.fecha.toLocaleTimeString('es-ES', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div>
                                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[120px]" title={movement.productoNombre}>
                                    {movement.productoNombre}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                                    {movement.productoSKU}
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full w-fit ${
                                    movement.tipoMovimiento === 'entrada' 
                                      ? 'bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 text-green-800'
                                      : movement.tipoMovimiento === 'salida'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {movement.tipoMovimiento}
                                  </span>
                                  <div className="text-xs text-gray-500 mt-1 truncate max-w-[100px]" title={movement.subTipo}>
                                    {movement.subTipo}
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm">
                                <span className={`font-bold ${
                                  movement.tipoMovimiento === 'entrada' 
                                    ? 'text-green-900 dark:text-white'
                                    : movement.tipoMovimiento === 'salida'
                                    ? 'text-red-600'
                                    : 'text-blue-600 dark:text-blue-400'
                                }`}>
                                  {movement.tipoMovimiento === 'entrada' ? '+' : movement.tipoMovimiento === 'salida' ? '-' : '±'}
                                  {movement.cantidad}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <div>
                                  <div 
                                    className="text-sm font-medium text-gray-900 truncate max-w-[140px] cursor-help" 
                                    title={`${origenDestino} - ${usuarioInfo}`}
                                  >
                                    {origenDestino}
                                  </div>
                                  <div 
                                    className="text-xs text-gray-500 truncate max-w-[140px] cursor-help" 
                                    title={usuarioInfo}
                                  >
                                    {usuarioInfo}
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900 max-w-xs hidden xl:table-cell">
                                <div 
                                  className="truncate cursor-help" 
                                  title={`${detallesInteligentes} | Razón: ${movement.razon || 'N/A'} | Observaciones: ${movement.observaciones || 'N/A'}`}
                                >
                                  {detallesInteligentes}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Vista Móvil */}
                  <div className="md:hidden space-y-4 p-4">
                    {fullHistory.map((movement) => {
                      const { origenDestino, usuarioInfo, detallesInteligentes } = getMovementDetails(movement);
                      
                      return (
                        <div key={movement.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-medium text-gray-900 truncate max-w-[200px]">
                                {movement.productoNombre}
                              </h4>
                              <p className="text-sm text-gray-500">{movement.productoSKU}</p>
                            </div>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              movement.tipoMovimiento === 'entrada' 
                                ? 'bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 text-green-800'
                                : movement.tipoMovimiento === 'salida'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {movement.tipoMovimiento}
                            </span>
                          </div>
                          
                          <div className="mb-3">
                            <p className="text-xs text-gray-500 mb-1">Cantidad</p>
                            <p className={`font-bold text-lg ${
                              movement.tipoMovimiento === 'entrada' 
                                ? 'text-green-900 dark:text-white'
                                : movement.tipoMovimiento === 'salida'
                                ? 'text-red-600'
                                : 'text-blue-600 dark:text-blue-400'
                            }`}>
                              {movement.tipoMovimiento === 'entrada' ? '+' : movement.tipoMovimiento === 'salida' ? '-' : '±'}
                              {movement.cantidad} unidades
                            </p>
                          </div>
                          
                          <div className="mb-3">
                            <p className="text-xs text-gray-500 mb-1">Origen/Destino</p>
                            <p className="text-sm font-medium text-gray-900">{origenDestino}</p>
                            <p className="text-xs text-gray-600 mt-1">{usuarioInfo}</p>
                          </div>
                          
                          <div className="mb-3">
                            <p className="text-xs text-gray-500 mb-1">Detalles</p>
                            <p className="text-sm text-gray-700" title={detallesInteligentes}>
                              {detallesInteligentes}
                            </p>
                          </div>
                          
                          <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t">
                            <span>
                              {movement.fecha.toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })} • {movement.fecha.toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <span>{movement.creadoPor}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
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