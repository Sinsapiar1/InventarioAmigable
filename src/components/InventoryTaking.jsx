import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWarehouse } from '../contexts/WarehouseContext';
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  addDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import LoadingSpinner from './LoadingSpinner';
import {
  Clipboard,
  Search,
  Save,
  AlertTriangle,
  Check,
  X,
  Package,
  Calculator,
  RefreshCw,
  Download,
  Upload,
} from 'lucide-react';

const InventoryTaking = () => {
  const { currentUser } = useAuth();
  const { activeWarehouse, warehouses, getActiveWarehouse } = useWarehouse();
  const [products, setProducts] = useState([]);
  const [inventoryData, setInventoryData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDiscrepancies, setShowDiscrepancies] = useState(false);
  const [inventoryStarted, setInventoryStarted] = useState(false);
  const [inventoryDate, setInventoryDate] = useState('');
  const [inventoryMode, setInventoryMode] = useState('specific'); // 'specific' o 'general'
  const [selectedWarehouse, setSelectedWarehouse] = useState('');

  // Cargar productos al montar el componente
  useEffect(() => {
    if (currentUser && activeWarehouse) {
      setSelectedWarehouse(activeWarehouse);
      loadProducts();
    }
  }, [currentUser, activeWarehouse]);

  // Recargar cuando cambie el modo o almacén seleccionado
  useEffect(() => {
    if (currentUser && inventoryMode) {
      if (inventoryMode === 'specific' && selectedWarehouse) {
        loadProducts();
      } else if (inventoryMode === 'general') {
        loadProducts();
      }
    }
  }, [inventoryMode, selectedWarehouse]);

  // Cargar productos desde Firestore
  const loadProducts = async () => {
    try {
      setLoading(true);
      
      if (inventoryMode === 'specific') {
        // Modo específico: cargar productos de un almacén
        await loadProductsFromWarehouse(selectedWarehouse);
      } else {
        // Modo general: cargar productos de todos los almacenes
        await loadProductsFromAllWarehouses();
      }
    } catch (error) {
      console.error('Error cargando productos:', error);
      setError('Error al cargar los productos');
    } finally {
      setLoading(false);
    }
  };

  // Cargar productos de un almacén específico
  const loadProductsFromWarehouse = async (warehouseId) => {
    if (!warehouseId) {
      console.error('warehouseId is required');
      setProducts([]);
      setInventoryData({});
      return;
    }

    const productosRef = collection(
      db,
      'usuarios',
      currentUser.uid,
      'almacenes',
      warehouseId,
      'productos'
    );
    const snapshot = await getDocs(productosRef);

    const productosData = [];
    const inventoryInitialData = {};

    snapshot.forEach((doc) => {
      const productData = {
        id: doc.id,
        almacenId: warehouseId,
        almacenNombre: warehouses.find(w => w.id === warehouseId)?.nombre || 'Almacén',
        ...doc.data(),
      };
      productosData.push(productData);

      // Inicializar datos de inventario
      inventoryInitialData[doc.id] = {
        cantidadSistema: productData.cantidadActual || 0,
        cantidadFisica: '',
        diferencia: 0,
        checked: false,
        almacenId: warehouseId,
      };
    });

    setProducts(productosData);
    setInventoryData(inventoryInitialData);
  };

  // Cargar productos de todos los almacenes consolidados
  const loadProductsFromAllWarehouses = async () => {
    if (!warehouses || warehouses.length === 0) {
      console.error('No warehouses available');
      setProducts([]);
      setInventoryData({});
      return;
    }

    const allProducts = new Map(); // Para consolidar productos por SKU
    const inventoryInitialData = {};

    // Cargar productos de cada almacén
    for (const warehouse of warehouses) {
      if (!warehouse.id) continue;
      
      try {
        const productosRef = collection(
          db,
          'usuarios',
          currentUser.uid,
          'almacenes',
          warehouse.id,
          'productos'
        );
        const snapshot = await getDocs(productosRef);

      snapshot.forEach((doc) => {
        const productData = doc.data();
        const sku = productData.sku;

        if (allProducts.has(sku)) {
          // Producto existe, agregar información del almacén
          const existingProduct = allProducts.get(sku);
          existingProduct.almacenes.push({
            id: warehouse.id,
            nombre: warehouse.nombre,
            cantidad: productData.cantidadActual || 0,
            docId: doc.id
          });
          existingProduct.cantidadTotal += productData.cantidadActual || 0;
        } else {
          // Producto nuevo
          allProducts.set(sku, {
            id: doc.id, // Usar el primer ID encontrado
            sku: sku,
            nombre: productData.nombre,
            categoria: productData.categoria,
            precioVenta: productData.precioVenta,
            cantidadTotal: productData.cantidadActual || 0,
            almacenes: [{
              id: warehouse.id,
              nombre: warehouse.nombre,
              cantidad: productData.cantidadActual || 0,
              docId: doc.id
            }]
          });
        }
      });
      } catch (error) {
        console.error(`Error loading products from warehouse ${warehouse.id}:`, error);
      }
    }

    // Convertir Map a Array y crear datos de inventario
    const productosData = Array.from(allProducts.values());
    
    productosData.forEach((product) => {
      // Crear entrada de inventario por cada almacén
      product.almacenes.forEach((almacen) => {
        const key = `${product.sku}_${almacen.id}`;
        inventoryInitialData[key] = {
          cantidadSistema: almacen.cantidad,
          cantidadFisica: '',
          diferencia: 0,
          checked: false,
          almacenId: almacen.id,
          almacenNombre: almacen.nombre,
          sku: product.sku,
          nombre: product.nombre,
          docId: almacen.docId
        };
      });
    });

    setProducts(productosData);
    setInventoryData(inventoryInitialData);
  };

  // Iniciar toma de inventario
  const startInventory = () => {
    setInventoryStarted(true);
    setInventoryDate(new Date().toISOString());
    setError('');
    setSuccess('Toma de inventario iniciada. Comienza a contar los productos.');
  };

  // Cancelar toma de inventario
  const cancelInventory = () => {
    if (
      window.confirm(
        '¿Estás seguro de cancelar la toma de inventario? Se perderán todos los datos ingresados.'
      )
    ) {
      setInventoryStarted(false);
      setInventoryDate('');

      // Resetear datos de inventario
      const resetData = {};
      products.forEach((product) => {
        resetData[product.id] = {
          cantidadSistema: product.cantidadActual || 0,
          cantidadFisica: '',
          diferencia: 0,
          checked: false,
        };
      });
      setInventoryData(resetData);
      setError('');
      setSuccess('');
    }
  };

  // Manejar cambio en cantidad física
  const handlePhysicalCountChange = (productId, value) => {
    const numericValue = value === '' ? '' : parseFloat(value) || 0;

    setInventoryData((prev) => {
      const updatedData = { ...prev };
      const cantidadSistema = updatedData[productId].cantidadSistema;
      const cantidadFisica = numericValue === '' ? 0 : numericValue;
      const diferencia = cantidadFisica - cantidadSistema;

      updatedData[productId] = {
        ...updatedData[productId],
        cantidadFisica: value,
        diferencia,
        checked: value !== '',
      };

      return updatedData;
    });
  };

  // Marcar producto como verificado
  const toggleProductCheck = (productId) => {
    setInventoryData((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        checked: !prev[productId].checked,
      },
    }));
  };

  // Calcular estadísticas
  const calculateStats = () => {
    const allProducts = Object.keys(inventoryData);
    const checkedProducts = allProducts.filter(
      (id) => inventoryData[id].checked
    );
    const productsWithDiscrepancies = allProducts.filter(
      (id) => inventoryData[id].checked && inventoryData[id].diferencia !== 0
    );

    const totalDifference = allProducts.reduce((sum, id) => {
      if (inventoryData[id].checked) {
        return sum + inventoryData[id].diferencia;
      }
      return sum;
    }, 0);

    return {
      totalProducts: allProducts.length,
      checkedProducts: checkedProducts.length,
      productsWithDiscrepancies: productsWithDiscrepancies.length,
      totalDifference,
      progress:
        allProducts.length > 0
          ? (checkedProducts.length / allProducts.length) * 100
          : 0,
    };
  };

  // Guardar toma de inventario
  const saveInventory = async () => {
    try {
      setSaving(true);
      setError('');

      const stats = calculateStats();

      if (stats.checkedProducts === 0) {
        setError('Debes contar al menos un producto');
        return;
      }

      if (stats.progress < 100) {
        const confirmPartial = window.confirm(
          `Solo has contado ${stats.checkedProducts} de ${
            stats.totalProducts
          } productos (${stats.progress.toFixed(1)}%). ¿Deseas continuar?`
        );
        if (!confirmPartial) return;
      }

      // Preparar lote de actualizaciones
      const batch = writeBatch(db);
      const movimientos = [];

      // Procesar cada producto verificado
      Object.keys(inventoryData).forEach((key) => {
        const data = inventoryData[key];

        if (data.checked && data.diferencia !== 0) {
          let productId, almacenId, product;

          if (inventoryMode === 'specific') {
            // Modo específico: key es el productId
            productId = key;
            almacenId = data.almacenId;
            product = products.find((p) => p.id === productId);
          } else {
            // Modo general: key es "sku_almacenId"
            almacenId = data.almacenId;
            productId = data.docId;
            product = products.find((p) => p.sku === data.sku);
          }

          // Actualizar cantidad en el producto
          const productRef = doc(
            db,
            'usuarios',
            currentUser.uid,
            'almacenes',
            almacenId,
            'productos',
            productId
          );
          const cantidadFisica = parseFloat(data.cantidadFisica) || 0;

          batch.update(productRef, {
            cantidadActual: cantidadFisica,
            fechaActualizacion: new Date().toISOString(),
          });

          // Preparar movimiento de ajuste
          movimientos.push({
            usuarioId: currentUser.uid,
            almacenId: almacenId,
            productoSKU: product.sku,
            productoNombre: product.nombre,
            tipoMovimiento: 'ajuste',
            subTipo: 'ajuste-por-inventario-fisico',
            cantidad: Math.abs(data.diferencia),
            cantidadAnterior: data.cantidadSistema,
            cantidadNueva: cantidadFisica,
            razon: `Ajuste por toma de inventario físico. Diferencia: ${
              data.diferencia > 0 ? '+' : ''
            }${data.diferencia}`,
            numeroDocumento: `INV-${inventoryDate.slice(0, 10)}`,
            observaciones: `Toma de inventario realizada el ${new Date(
              inventoryDate
            ).toLocaleDateString('es-ES')}`,
            fecha: inventoryDate,
            creadoPor: currentUser.email,
          });
        }
      });

      // Ejecutar actualizaciones de productos
      await batch.commit();

      // Crear movimientos de ajuste
      const movimientosRef = collection(db, 'movimientos');
      await Promise.all(
        movimientos.map((movimiento) => addDoc(movimientosRef, movimiento))
      );

      setSuccess(
        `Inventario guardado correctamente. ${movimientos.length} ajustes realizados.`
      );

      // Resetear estado
      setInventoryStarted(false);
      setInventoryDate('');

      // Recargar productos
      await loadProducts();
    } catch (error) {
      console.error('Error guardando inventario:', error);
      setError('Error al guardar el inventario');
    } finally {
      setSaving(false);
    }
  };

  // Exportar datos de inventario
  const exportInventoryData = () => {
    const csvData = products.map((product) => {
      const data = inventoryData[product.id];
      return {
        SKU: product.sku,
        Nombre: product.nombre,
        Categoria: product.categoria,
        'Stock Sistema': data.cantidadSistema,
        'Stock Físico': data.cantidadFisica || '',
        Diferencia: data.diferencia,
        Verificado: data.checked ? 'Sí' : 'No',
      };
    });

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map((row) => Object.values(row).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Crear estructura de datos para renderizado
  const getDisplayItems = () => {
    if (inventoryMode === 'specific') {
      // Modo específico: mostrar productos directamente
      const filteredProducts = products.filter(
        (product) =>
          product.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.categoria.toLowerCase().includes(searchTerm.toLowerCase())
      );

      return showDiscrepancies
        ? filteredProducts.filter((product) => {
            const data = inventoryData[product.id];
            return data && data.checked && data.diferencia !== 0;
          })
        : filteredProducts;
    } else {
      // Modo general: crear items por cada producto-almacén
      const items = [];
      
      Object.keys(inventoryData).forEach((key) => {
        const data = inventoryData[key];
        const [sku] = key.split('_');
        
        // Filtrar por búsqueda
        if (
          data.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
          sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
          data.almacenNombre.toLowerCase().includes(searchTerm.toLowerCase())
        ) {
          // Filtrar por discrepancias si está activado
          if (!showDiscrepancies || (data.checked && data.diferencia !== 0)) {
            items.push({
              key: key,
              sku: sku,
              nombre: data.nombre,
              almacenNombre: data.almacenNombre,
              cantidadSistema: data.cantidadSistema,
              ...data
            });
          }
        }
      });
      
      return items;
    }
  };

  const displayItems = getDisplayItems();

  const stats = calculateStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Cargando inventario..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Toma de Inventario Físico
          </h1>
          <p className="text-gray-600 mt-1">
            Concilia el inventario físico con el del sistema
          </p>
        </div>
      </div>

      {/* Selector de Modo de Inventario */}
      {!inventoryStarted && (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Configuración del Inventario
          </h2>
          
          {/* Modo de Inventario */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <button
              type="button"
              onClick={() => setInventoryMode('specific')}
              className={`p-4 rounded-lg border-2 transition-colors text-left ${
                inventoryMode === 'specific'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">Almacén Específico</div>
              <div className="text-sm text-gray-600 mt-1">
                Inventario de un almacén individual
              </div>
            </button>
            
            <button
              type="button"
              onClick={() => setInventoryMode('general')}
              className={`p-4 rounded-lg border-2 transition-colors text-left ${
                inventoryMode === 'general'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">Inventario General</div>
              <div className="text-sm text-gray-600 mt-1">
                Todos los almacenes consolidados
              </div>
            </button>
          </div>

          {/* Selector de Almacén (solo en modo específico) */}
          {inventoryMode === 'specific' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seleccionar Almacén
              </label>
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="input-field"
              >
                <option value="">Seleccionar almacén</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.nombre} - {warehouse.ubicacion}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Resumen de configuración */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-700">
              <strong>Modo:</strong> {inventoryMode === 'specific' ? 'Almacén Específico' : 'Inventario General'}
              {inventoryMode === 'specific' && selectedWarehouse && (
                <>
                  <br />
                  <strong>Almacén:</strong> {warehouses.find(w => w.id === selectedWarehouse)?.nombre}
                </>
              )}
              {inventoryMode === 'general' && (
                <>
                  <br />
                  <strong>Almacenes:</strong> {warehouses.length} almacenes totales
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Controles de acción */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div></div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          {!inventoryStarted ? (
            <button
              onClick={startInventory}
              disabled={inventoryMode === 'specific' && !selectedWarehouse}
              className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Clipboard className="w-4 h-4" />
              <span>Iniciar Inventario</span>
            </button>
          ) : (
            <>
              <button
                onClick={exportInventoryData}
                className="btn-secondary flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Exportar</span>
              </button>
              <button
                onClick={cancelInventory}
                className="btn-secondary text-red-600 hover:text-red-700 flex items-center space-x-2"
              >
                <X className="w-4 h-4" />
                <span>Cancelar</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mensajes de estado */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* Panel de estadísticas */}
      {inventoryStarted && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Progreso</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.progress.toFixed(1)}%
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${stats.progress}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Contados</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.checkedProducts}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Check className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              de {stats.totalProducts} productos
            </p>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Discrepancias
                </p>
                <p className="text-2xl font-bold text-orange-600">
                  {stats.productsWithDiscrepancies}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              productos con diferencias
            </p>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Diferencia Total
                </p>
                <p
                  className={`text-2xl font-bold ${
                    stats.totalDifference > 0
                      ? 'text-green-600'
                      : stats.totalDifference < 0
                      ? 'text-red-600'
                      : 'text-gray-600'
                  }`}
                >
                  {stats.totalDifference > 0 ? '+' : ''}
                  {stats.totalDifference}
                </p>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <Calculator className="w-6 h-6 text-gray-600" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-1">unidades netas</p>
          </div>
        </div>
      )}

      {inventoryStarted ? (
        <>
          {/* Panel de controles */}
          <div className="card">
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <h2 className="text-lg font-semibold text-gray-900">
                  Conteo de Productos ({displayItems.length})
                </h2>

                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                  {/* Búsqueda */}
                  <div className="relative">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="input-field pl-10 pr-4"
                      placeholder="Buscar productos..."
                    />
                    <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                  </div>

                  {/* Filtro de discrepancias */}
                  <button
                    onClick={() => setShowDiscrepancies(!showDiscrepancies)}
                    className={`px-4 py-2 rounded-lg border transition-colors ${
                      showDiscrepancies
                        ? 'bg-orange-50 border-orange-200 text-orange-700'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Solo discrepancias
                  </button>
                </div>
              </div>
            </div>

            {/* Tabla de productos */}
            {displayItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ✓
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Producto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        SKU
                      </th>
                      {inventoryMode === 'general' && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Almacén
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stock Sistema
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stock Físico
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Diferencia
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {displayItems.map((item) => {
                      const itemKey = inventoryMode === 'specific' ? item.id : item.key;
                      const data = inventoryData[itemKey];
                      const hasDiscrepancy = data && data.checked && data.diferencia !== 0;

                      return (
                        <tr
                          key={itemKey}
                          className={`${
                            data?.checked ? 'bg-green-50' : 'hover:bg-gray-50'
                          } ${hasDiscrepancy ? 'bg-orange-50' : ''}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={data?.checked || false}
                              onChange={() => toggleProductCheck(itemKey)}
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {inventoryMode === 'specific' ? item.nombre : item.nombre}
                              </div>
                              <div className="text-sm text-gray-500">
                                {inventoryMode === 'specific' ? item.categoria : 'General'}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {inventoryMode === 'specific' ? item.sku : item.sku}
                          </td>
                          {inventoryMode === 'general' && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {item.almacenNombre}
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {data?.cantidadSistema || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="number"
                              value={data?.cantidadFisica || ''}
                              onChange={(e) =>
                                handlePhysicalCountChange(
                                  itemKey,
                                  e.target.value
                                )
                              }
                              className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              min="0"
                              step="1"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {data?.checked && (
                              <span
                                className={`font-medium ${
                                  data.diferencia > 0
                                    ? 'text-green-600'
                                    : data.diferencia < 0
                                    ? 'text-red-600'
                                    : 'text-gray-600'
                                }`}
                              >
                                {data.diferencia > 0 ? '+' : ''}
                                {data.diferencia}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  {showDiscrepancies
                    ? 'No hay productos con discrepancias'
                    : 'No se encontraron productos'}
                </p>
              </div>
            )}
          </div>

          {/* Botón de guardar */}
          <div className="flex justify-center">
            <button
              onClick={saveInventory}
              disabled={saving || stats.checkedProducts === 0}
              className="btn-primary flex items-center space-x-2 px-8 py-3 text-lg"
            >
              {saving ? (
                <LoadingSpinner size="sm" text="" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Guardar Inventario</span>
                </>
              )}
            </button>
          </div>
        </>
      ) : (
        // Estado inicial
        <div className="card">
          <div className="text-center py-16">
            <Clipboard className="w-16 h-16 text-gray-400 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Toma de Inventario Físico
            </h2>
            <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
              Realiza un conteo físico de tus productos para reconciliar las
              diferencias entre el stock del sistema y el stock real. El sistema
              ajustará automáticamente las cantidades y registrará los
              movimientos correspondientes.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-3 flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-lg">1</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Contar Productos
                </h3>
                <p className="text-sm text-gray-600">
                  Cuenta físicamente cada producto en tu almacén
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-3 flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-lg">2</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Registrar Cantidades
                </h3>
                <p className="text-sm text-gray-600">
                  Ingresa las cantidades contadas en el sistema
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-3 flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-lg">3</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Ajustar Inventario
                </h3>
                <p className="text-sm text-gray-600">
                  El sistema ajustará automáticamente las diferencias
                </p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto mb-8">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <p className="font-medium text-blue-900 mb-1">Importante</p>
                  <p className="text-sm text-blue-700">
                    Una vez guardada la toma de inventario, los ajustes serán
                    permanentes. Asegúrate de contar correctamente antes de
                    proceder.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={startInventory}
              className="btn-primary flex items-center space-x-2 mx-auto px-8 py-3 text-lg"
            >
              <Clipboard className="w-5 h-5" />
              <span>Iniciar Toma de Inventario</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryTaking;
