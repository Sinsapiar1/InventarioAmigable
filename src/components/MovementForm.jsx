import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  getDoc,
  query,
  orderBy,
  where,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import LoadingSpinner from './LoadingSpinner';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Package,
  AlertCircle,
  Check,
  FileText,
  Calculator,
  Search,
  RefreshCw,
} from 'lucide-react';

const MovementForm = () => {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    productoSKU: '',
    tipoMovimiento: 'entrada',
    subTipo: '',
    cantidad: '',
    numeroDocumento: '',
    razon: '',
    observaciones: '',
  });

  // Tipos de movimiento
  const tiposEntrada = [
    'Compra a proveedor',
    'Devolución de cliente',
    'Ajuste positivo',
    'Traspaso desde otro almacén',
    'Producción interna',
  ];

  const tiposSalida = [
    'Venta a cliente',
    'Merma o deterioro',
    'Devolución a proveedor',
    'Ajuste negativo',
    'Traspaso a otro almacén',
    'Uso interno',
  ];

  // Cargar datos
  useEffect(() => {
    if (!currentUser) return;
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadProducts(), loadRecentMovements()]);
    } catch (error) {
      console.error('Error cargando datos:', error);
      setError('Error al cargar los datos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
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

      const productosData = [];
      snapshot.forEach((doc) => {
        productosData.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      setProducts(productosData);
    } catch (error) {
      console.error('Error cargando productos:', error);
      throw error;
    }
  };

  const loadRecentMovements = async () => {
    try {
      const movimientosRef = collection(db, 'movimientos');
      const movimientosQuery = query(
        movimientosRef,
        where('usuarioId', '==', currentUser.uid),
        orderBy('fecha', 'desc'),
        limit(20)
      );
      const snapshot = await getDocs(movimientosQuery);

      const movimientosData = [];
      snapshot.forEach((doc) => {
        movimientosData.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      setMovements(movimientosData);
    } catch (error) {
      console.error('Error cargando movimientos:', error);
      // No lanzar error aquí, solo log
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const newData = { ...prev, [name]: value };

      if (name === 'tipoMovimiento') {
        newData.subTipo = '';
      }

      return newData;
    });

    if (error) setError('');
  };

  const validateForm = () => {
    if (!formData.productoSKU) {
      setError('Debes seleccionar un producto');
      return false;
    }

    if (!formData.subTipo) {
      setError('Selecciona el tipo específico de movimiento');
      return false;
    }

    const cantidad = parseFloat(formData.cantidad);
    if (!cantidad || cantidad <= 0) {
      setError('La cantidad debe ser un número mayor a 0');
      return false;
    }

    if (!formData.razon.trim()) {
      setError('La razón del movimiento es obligatoria');
      return false;
    }

    if (formData.tipoMovimiento === 'salida') {
      const producto = products.find((p) => p.sku === formData.productoSKU);
      if (producto && (producto.cantidadActual || 0) < cantidad) {
        setError(
          `Stock insuficiente. Disponible: ${
            producto.cantidadActual || 0
          }, Solicitado: ${cantidad}`
        );
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);
    setError('');

    try {
      const cantidad = parseFloat(formData.cantidad);

      const productoRef = doc(
        db,
        'usuarios',
        currentUser.uid,
        'almacenes',
        'principal',
        'productos',
        formData.productoSKU
      );
      const productoDoc = await getDoc(productoRef);

      if (!productoDoc.exists()) {
        throw new Error('Producto no encontrado en la base de datos');
      }

      const producto = productoDoc.data();
      const cantidadAnterior = producto.cantidadActual || 0;

      let cantidadNueva = cantidadAnterior;
      if (formData.tipoMovimiento === 'entrada') {
        cantidadNueva += cantidad;
      } else {
        cantidadNueva -= cantidad;
        if (cantidadNueva < 0) {
          throw new Error('La operación resultaría en stock negativo');
        }
      }

      const movimientoData = {
        usuarioId: currentUser.uid,
        almacenId: 'principal',
        productoSKU: formData.productoSKU,
        productoNombre: producto.nombre,
        tipoMovimiento: formData.tipoMovimiento,
        subTipo: formData.subTipo,
        cantidad: cantidad,
        cantidadAnterior,
        cantidadNueva,
        razon: formData.razon.trim(),
        numeroDocumento: formData.numeroDocumento.trim() || null,
        observaciones: formData.observaciones.trim() || null,
        fecha: new Date().toISOString(),
        creadoPor: currentUser.email,
      };

      await Promise.all([
        updateDoc(productoRef, {
          cantidadActual: cantidadNueva,
          fechaActualizacion: new Date().toISOString(),
        }),
        addDoc(collection(db, 'movimientos'), movimientoData),
      ]);

      const tipoLabel =
        formData.tipoMovimiento === 'entrada' ? 'Entrada' : 'Salida';
      setSuccess(
        `${tipoLabel} registrada exitosamente: ${cantidad} unidades de ${producto.nombre}`
      );

      setFormData({
        productoSKU: '',
        tipoMovimiento: 'entrada',
        subTipo: '',
        cantidad: '',
        numeroDocumento: '',
        razon: '',
        observaciones: '',
      });

      await loadData();
    } catch (error) {
      console.error('Error registrando movimiento:', error);
      setError(error.message || 'Error al registrar el movimiento');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProduct = products.find((p) => p.sku === formData.productoSKU);

  const filteredMovements = movements.filter(
    (movement) =>
      movement.productoNombre
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      movement.productoSKU?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.subTipo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Fecha inválida';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Cargando movimientos..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Movimientos de Inventario
          </h1>
          <p className="text-gray-600 mt-1">
            Registra entradas y salidas de productos • {products.length}{' '}
            productos disponibles
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-2">
          <div className="text-sm text-gray-500">
            {movements.length} movimientos registrados
          </div>
          <button
            onClick={loadData}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            title="Actualizar datos"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-800">Error</p>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-green-800">Éxito</p>
              <p className="text-green-700">{success}</p>
            </div>
          </div>
        </div>
      )}

      {/* Formulario */}
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <ArrowUpDown className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Registrar Movimiento
            </h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Producto */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Producto *
              </label>
              <div className="relative">
                <select
                  name="productoSKU"
                  value={formData.productoSKU}
                  onChange={handleInputChange}
                  className="input-field pl-10"
                  disabled={submitting}
                  required
                >
                  <option value="">Seleccionar producto</option>
                  {products.map((product) => (
                    <option key={product.sku} value={product.sku}>
                      {product.nombre} - {product.sku} (Stock:{' '}
                      {product.cantidadActual || 0})
                    </option>
                  ))}
                </select>
                <Package className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
              </div>

              {selectedProduct && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-blue-900">
                        {selectedProduct.nombre}
                      </p>
                      <p className="text-sm text-blue-700">
                        SKU: {selectedProduct.sku}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-blue-900">
                        Stock Actual: {selectedProduct.cantidadActual || 0}
                      </p>
                      <p className="text-sm text-blue-700">
                        Mínimo: {selectedProduct.cantidadMinima || 5}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tipo de movimiento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Movimiento *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    handleInputChange({
                      target: { name: 'tipoMovimiento', value: 'entrada' },
                    })
                  }
                  className={`p-3 rounded-lg border-2 transition-colors flex items-center justify-center space-x-2 ${
                    formData.tipoMovimiento === 'entrada'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  disabled={submitting}
                >
                  <ArrowUp className="w-4 h-4" />
                  <span className="font-medium">Entrada</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleInputChange({
                      target: { name: 'tipoMovimiento', value: 'salida' },
                    })
                  }
                  className={`p-3 rounded-lg border-2 transition-colors flex items-center justify-center space-x-2 ${
                    formData.tipoMovimiento === 'salida'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  disabled={submitting}
                >
                  <ArrowDown className="w-4 h-4" />
                  <span className="font-medium">Salida</span>
                </button>
              </div>
            </div>

            {/* Subtipo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo Específico *
              </label>
              <select
                name="subTipo"
                value={formData.subTipo}
                onChange={handleInputChange}
                className="input-field"
                disabled={submitting}
                required
              >
                <option value="">Seleccionar tipo</option>
                {(formData.tipoMovimiento === 'entrada'
                  ? tiposEntrada
                  : tiposSalida
                ).map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </div>

            {/* Cantidad */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cantidad *
              </label>
              <div className="relative">
                <input
                  type="number"
                  name="cantidad"
                  value={formData.cantidad}
                  onChange={handleInputChange}
                  className="input-field pl-10"
                  min="0.01"
                  step="0.01"
                  placeholder="0"
                  disabled={submitting}
                  required
                />
                <Calculator className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Número de documento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número de Documento
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="numeroDocumento"
                  value={formData.numeroDocumento}
                  onChange={handleInputChange}
                  className="input-field pl-10"
                  placeholder="Ej: FAC-001, TRF-001"
                  disabled={submitting}
                />
                <FileText className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Razón */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Razón del Movimiento *
              </label>
              <input
                type="text"
                name="razon"
                value={formData.razon}
                onChange={handleInputChange}
                className="input-field"
                placeholder="Descripción de la razón del movimiento"
                disabled={submitting}
                required
              />
            </div>

            {/* Observaciones */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observaciones
              </label>
              <textarea
                name="observaciones"
                value={formData.observaciones}
                onChange={handleInputChange}
                rows="3"
                className="input-field"
                placeholder="Observaciones adicionales..."
                disabled={submitting}
              />
            </div>
          </div>

          <div className="mt-6">
            <button
              type="submit"
              disabled={submitting || !formData.productoSKU}
              className="btn-primary flex items-center justify-center space-x-2 w-full sm:w-auto"
            >
              {submitting ? (
                <LoadingSpinner size="sm" text="" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Registrar Movimiento</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Historial */}
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <h2 className="text-lg font-semibold text-gray-900">
              Historial de Movimientos ({filteredMovements.length})
            </h2>
            <div className="relative max-w-xs">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10 pr-4"
                placeholder="Buscar movimientos..."
              />
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
            </div>
          </div>
        </div>

        {filteredMovements.length > 0 ? (
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
                    Cantidad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock Anterior
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock Nuevo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Razón
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMovements.map((movement) => (
                  <tr key={movement.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(movement.fecha)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {movement.productoNombre}
                        </div>
                        <div className="text-sm text-gray-500">
                          {movement.productoSKU}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          movement.tipoMovimiento === 'entrada'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {movement.tipoMovimiento === 'entrada' && (
                          <ArrowUp className="w-3 h-3 mr-1" />
                        )}
                        {movement.tipoMovimiento === 'salida' && (
                          <ArrowDown className="w-3 h-3 mr-1" />
                        )}
                        {movement.subTipo}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {movement.tipoMovimiento === 'entrada' ? '+' : '-'}
                      {movement.cantidad}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {movement.cantidadAnterior}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {movement.cantidadNueva}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {movement.razon}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <ArrowUpDown className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchTerm
                ? 'No se encontraron movimientos'
                : 'No hay movimientos registrados'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MovementForm;
