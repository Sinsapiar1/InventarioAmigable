import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import LoadingSpinner from './LoadingSpinner';
import ConfirmDialog from './ConfirmDialog';
import { useConfirm } from '../hooks/useConfirm';
import {
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Check,
  X,
  DollarSign,
  Hash,
  Tag,
  MapPin,
} from 'lucide-react';

const ProductForm = () => {
  const { currentUser } = useAuth();
  const { confirmState, closeConfirm, handleConfirm, confirmDelete } = useConfirm();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [duplicateAction, setDuplicateAction] = useState('sum'); // 'sum' o 'error'
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState(null);

  const [formData, setFormData] = useState({
    sku: '',
    nombre: '',
    categoria: '',
    cantidadActual: '',
    cantidadMinima: '',
    precioVenta: '',
    precioCompra: '',
    proveedor: '',
    ubicacionFisica: '',
    descripcion: '',
  });

  // Categorías predefinidas
  const categorias = [
    'Electrónicos',
    'Ropa y Accesorios',
    'Hogar y Jardín',
    'Deportes',
    'Belleza y Cuidado Personal',
    'Libros y Medios',
    'Juguetes',
    'Automotriz',
    'Herramientas',
    'Otros',
  ];

  // Cargar productos al montar el componente
  useEffect(() => {
    loadProducts();
  }, [currentUser]);

  // Cargar productos desde Firestore
  const loadProducts = async () => {
    try {
      setLoading(true);
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
        orderBy('fechaCreacion', 'desc')
      );
      const snapshot = await getDocs(productosQuery);

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
      setError('Error al cargar los productos');
    } finally {
      setLoading(false);
    }
  };

  // Manejar cambios en el formulario
  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Limpiar errores al escribir
    if (error) setError('');
  };

  // Validar formulario
  const validateForm = () => {
    // Validar SKU
    if (!formData.sku.trim()) {
      setError('El SKU es obligatorio');
      return false;
    }

    if (formData.sku.trim().length < 3) {
      setError('El SKU debe tener al menos 3 caracteres');
      return false;
    }

    if (!/^[A-Z0-9-]+$/i.test(formData.sku.trim())) {
      setError('El SKU solo puede contener letras, números y guiones');
      return false;
    }

    // Validar nombre
    if (!formData.nombre.trim()) {
      setError('El nombre del producto es obligatorio');
      return false;
    }

    if (formData.nombre.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres');
      return false;
    }

    if (formData.nombre.trim().length > 100) {
      setError('El nombre no puede tener más de 100 caracteres');
      return false;
    }

    // Validar categoría
    if (!formData.categoria) {
      setError('Selecciona una categoría');
      return false;
    }

    // Validar cantidades
    const cantidadActual = parseFloat(formData.cantidadActual) || 0;
    const cantidadMinima = parseFloat(formData.cantidadMinima) || 0;
    const precioVenta = parseFloat(formData.precioVenta) || 0;
    const precioCompra = parseFloat(formData.precioCompra) || 0;

    if (cantidadActual < 0) {
      setError('La cantidad actual no puede ser negativa');
      return false;
    }

    if (cantidadMinima < 0) {
      setError('La cantidad mínima no puede ser negativa');
      return false;
    }

    if (cantidadMinima > 10000) {
      setError('La cantidad mínima no puede ser mayor a 10,000');
      return false;
    }

    // Validar precios
    if (precioVenta < 0 || precioCompra < 0) {
      setError('Los precios no pueden ser negativos');
      return false;
    }

    if (precioVenta > 0 && precioCompra > 0 && precioVenta <= precioCompra) {
      setError('El precio de venta debe ser mayor al precio de compra');
      return false;
    }

    // Validar campos opcionales
    if (formData.proveedor && formData.proveedor.length > 100) {
      setError('El nombre del proveedor no puede tener más de 100 caracteres');
      return false;
    }

    if (formData.ubicacionFisica && formData.ubicacionFisica.length > 50) {
      setError('La ubicación física no puede tener más de 50 caracteres');
      return false;
    }

    if (formData.descripcion && formData.descripcion.length > 500) {
      setError('La descripción no puede tener más de 500 caracteres');
      return false;
    }

    // Validar SKU - manejar duplicados según configuración
    if (!editingProduct || editingProduct.sku !== formData.sku.toUpperCase().trim()) {
      const existingProduct = products.find(
        (product) => product.sku.toLowerCase() === formData.sku.toLowerCase().trim()
      );

      if (existingProduct && duplicateAction === 'error') {
        setError('Ya existe un producto con este SKU');
        return false;
      } else if (existingProduct && duplicateAction === 'sum') {
        // Preparar información para mostrar el diálogo de suma
        const cantidadActual = parseFloat(formData.cantidadActual) || 0;
        const cantidadExistente = existingProduct.cantidadActual || 0;
        const cantidadFinal = cantidadExistente + cantidadActual;

        setDuplicateInfo({
          existingProduct,
          cantidadNueva: cantidadActual,
          cantidadExistente,
          cantidadFinal,
        });
        
        setShowDuplicateDialog(true);
        return false; // Pausar validación hasta que el usuario confirme
      }
    }

    return true;
  };

  // Enviar formulario
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);
    setError('');

    try {
      const productData = {
        sku: formData.sku.toUpperCase().trim(),
        nombre: formData.nombre.trim(),
        categoria: formData.categoria,
        cantidadActual: parseFloat(formData.cantidadActual) || 0,
        cantidadMinima: parseFloat(formData.cantidadMinima) || 5,
        precioVenta: parseFloat(formData.precioVenta) || 0,
        precioCompra: parseFloat(formData.precioCompra) || 0,
        proveedor: formData.proveedor.trim(),
        ubicacionFisica: formData.ubicacionFisica.trim(),
        descripcion: formData.descripcion.trim(),
        fechaCreacion: editingProduct
          ? editingProduct.fechaCreacion
          : new Date().toISOString(),
        fechaActualizacion: new Date().toISOString(),
      };

      const productRef = doc(
        db,
        'usuarios',
        currentUser.uid,
        'almacenes',
        'principal',
        'productos',
        productData.sku
      );

      if (editingProduct) {
        await updateDoc(productRef, productData);
        setSuccess('Producto actualizado correctamente');
        
        // Mostrar notificación global
        if (window.showSuccess) {
          window.showSuccess(`Producto "${productData.nombre}" actualizado correctamente`);
        }
      } else {
        await setDoc(productRef, productData);
        setSuccess('Producto creado correctamente');
        
        // Mostrar notificación global
        if (window.showSuccess) {
          window.showSuccess(`Producto "${productData.nombre}" creado correctamente`);
        }
      }

      // Resetear formulario
      resetForm();
      await loadProducts();
    } catch (error) {
      console.error('Error guardando producto:', error);
      
      // Determinar el mensaje de error específico
      let errorMessage = 'Error al guardar el producto';
      
      if (error.code === 'permission-denied') {
        errorMessage = 'No tienes permisos para realizar esta acción';
      } else if (error.code === 'network-request-failed') {
        errorMessage = 'Error de conexión. Verifica tu internet';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      
      // Mostrar notificación global
      if (window.showError) {
        window.showError(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Resetear formulario
  const resetForm = () => {
    setFormData({
      sku: '',
      nombre: '',
      categoria: '',
      cantidadActual: '',
      cantidadMinima: '',
      precioVenta: '',
      precioCompra: '',
      proveedor: '',
      ubicacionFisica: '',
      descripcion: '',
    });
    setEditingProduct(null);
    setShowForm(false);
    setError('');
    setSuccess('');
  };

  // Editar producto
  const handleEdit = (product) => {
    setFormData({
      sku: product.sku || '',
      nombre: product.nombre || '',
      categoria: product.categoria || '',
      cantidadActual: product.cantidadActual ? product.cantidadActual.toString() : '',
      cantidadMinima: product.cantidadMinima ? product.cantidadMinima.toString() : '',
      precioVenta: product.precioVenta ? product.precioVenta.toString() : '',
      precioCompra: product.precioCompra ? product.precioCompra.toString() : '',
      proveedor: product.proveedor || '',
      ubicacionFisica: product.ubicacionFisica || '',
      descripcion: product.descripcion || '',
    });
    setEditingProduct(product);
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  // Eliminar producto
  const handleDelete = async (product) => {
    const details = (
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="font-medium">SKU:</span>
          <span>{product.sku}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Stock actual:</span>
          <span className={product.cantidadActual > 0 ? 'text-orange-600' : 'text-gray-600'}>
            {product.cantidadActual || 0} unidades
          </span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Categoría:</span>
          <span>{product.categoria}</span>
        </div>
      </div>
    );

    await confirmDelete(
      product.nombre,
      async () => {
        try {
          await deleteDoc(
            doc(
              db,
              'usuarios',
              currentUser.uid,
              'almacenes',
              'principal',
              'productos',
              product.sku
            )
          );
          
          setSuccess('Producto eliminado correctamente');
          
          // Mostrar notificación global
          if (window.showSuccess) {
            window.showSuccess(`Producto "${product.nombre}" eliminado correctamente`);
          }
          
          await loadProducts();
        } catch (error) {
          console.error('Error eliminando producto:', error);
          
          // Determinar el mensaje de error específico
          let errorMessage = 'Error al eliminar el producto';
          
          if (error.code === 'permission-denied') {
            errorMessage = 'No tienes permisos para eliminar este producto';
          } else if (error.code === 'not-found') {
            errorMessage = 'El producto ya no existe';
          } else if (error.code === 'network-request-failed') {
            errorMessage = 'Error de conexión. Verifica tu internet';
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          setError(errorMessage);
          
          // Mostrar notificación global
          if (window.showError) {
            window.showError(errorMessage);
          }
          
          throw error; // Re-lanzar para que el diálogo maneje el error
        }
      },
      details
    );
  };

  // Filtrar productos por búsqueda
  const filteredProducts = products.filter(
    (product) =>
      product.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.categoria.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Formatear números a moneda
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
        <LoadingSpinner size="lg" text="Cargando productos..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Gestión de Productos
          </h1>
          <p className="text-gray-600 mt-1">
            Administra tu catálogo de productos
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center justify-center space-x-2 w-full sm:w-auto min-h-[48px]"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* Mensajes de estado */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* Formulario de producto */}
      {showForm && (
        <div className="card">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-4 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* SKU */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SKU / Código del Producto *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleInputChange}
                    className="input-field pl-10"
                    placeholder="Ej: LAP-001"
                    disabled={submitting}
                    required
                  />
                  <Hash className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Producto *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    className="input-field pl-10"
                    placeholder="Ej: Laptop Dell Inspiron"
                    disabled={submitting}
                    required
                  />
                  <Package className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoría *
                </label>
                <div className="relative">
                  <select
                    name="categoria"
                    value={formData.categoria}
                    onChange={handleInputChange}
                    className="input-field pl-10"
                    disabled={submitting}
                    required
                  >
                    <option value="">Seleccionar categoría</option>
                    {categorias.map((categoria) => (
                      <option key={categoria} value={categoria}>
                        {categoria}
                      </option>
                    ))}
                  </select>
                  <Tag className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Cantidad Actual */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cantidad Actual
                </label>
                <input
                  type="number"
                  name="cantidadActual"
                  value={formData.cantidadActual}
                  onChange={handleInputChange}
                  className="input-field"
                  min="0"
                  step="1"
                  placeholder="0"
                  disabled={submitting}
                />
              </div>

              {/* Cantidad Mínima */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cantidad Mínima
                </label>
                <input
                  type="number"
                  name="cantidadMinima"
                  value={formData.cantidadMinima}
                  onChange={handleInputChange}
                  className="input-field"
                  min="0"
                  step="1"
                  placeholder="5"
                  disabled={submitting}
                />
              </div>

              {/* Precio de Venta */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Precio de Venta
                </label>
                <div className="relative">
                  <input
                    type="number"
                    name="precioVenta"
                    value={formData.precioVenta}
                    onChange={handleInputChange}
                    className="input-field pl-10"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    disabled={submitting}
                  />
                  <DollarSign className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Precio de Compra */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Precio de Compra
                </label>
                <div className="relative">
                  <input
                    type="number"
                    name="precioCompra"
                    value={formData.precioCompra}
                    onChange={handleInputChange}
                    className="input-field pl-10"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    disabled={submitting}
                  />
                  <DollarSign className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Proveedor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proveedor
                </label>
                <input
                  type="text"
                  name="proveedor"
                  value={formData.proveedor}
                  onChange={handleInputChange}
                  className="input-field"
                  placeholder="Nombre del proveedor"
                  disabled={submitting}
                />
              </div>

              {/* Ubicación Física */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ubicación Física
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="ubicacionFisica"
                    value={formData.ubicacionFisica}
                    onChange={handleInputChange}
                    className="input-field pl-10"
                    placeholder="Ej: Estante A-3"
                    disabled={submitting}
                  />
                  <MapPin className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Descripción */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <textarea
                  name="descripcion"
                  value={formData.descripcion}
                  onChange={handleInputChange}
                  rows="3"
                  className="input-field"
                  placeholder="Descripción del producto..."
                  disabled={submitting}
                />
              </div>
            </div>

            {/* Botones */}
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary flex items-center justify-center space-x-2 w-full sm:w-auto min-h-[48px]"
              >
                {submitting ? (
                  <LoadingSpinner size="sm" text="" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>
                      {editingProduct ? 'Actualizar' : 'Crear'} Producto
                    </span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn-secondary w-full sm:w-auto min-h-[48px]"
                disabled={submitting}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de productos */}
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <h2 className="text-lg font-semibold text-gray-900">
              Productos ({filteredProducts.length})
            </h2>

            {/* Barra de búsqueda */}
            <div className="relative max-w-xs">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10 pr-4"
                placeholder="Buscar productos..."
              />
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
            </div>
          </div>
        </div>

        {filteredProducts.length > 0 ? (
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
                      SKU
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Precio
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {product.nombre}
                          </div>
                          <div className="text-sm text-gray-500">
                            {product.categoria}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.sku}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span
                            className={`text-sm font-medium ${
                              (product.cantidadActual || 0) <=
                              (product.cantidadMinima || 5)
                                ? 'text-red-600'
                                : 'text-green-600'
                            }`}
                          >
                            {product.cantidadActual || 0}
                          </span>
                          <span className="text-xs text-gray-500 ml-1">
                            / {product.cantidadMinima || 5}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(product.precioVenta || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEdit(product)}
                            className="text-blue-600 hover:text-blue-900 p-1"
                            title="Editar producto"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product)}
                            className="text-red-600 hover:text-red-900 p-1"
                            title="Eliminar producto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Vista de cards para móvil */}
            <div className="md:hidden space-y-4 p-4">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {product.nombre}
                      </h3>
                      <p className="text-sm text-gray-500">{product.categoria}</p>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleEdit(product)}
                        className="text-blue-600 hover:text-blue-900 p-2 rounded-full hover:bg-blue-50 transition-colors"
                        title="Editar producto"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(product)}
                        className="text-red-600 hover:text-red-900 p-2 rounded-full hover:bg-red-50 transition-colors"
                        title="Eliminar producto"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 font-medium">SKU</p>
                      <p className="text-gray-900">{product.sku}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium">Precio</p>
                      <p className="text-gray-900">{formatCurrency(product.precioVenta || 0)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium">Stock Actual</p>
                      <p
                        className={`font-semibold ${
                          (product.cantidadActual || 0) <= (product.cantidadMinima || 5)
                            ? 'text-red-600'
                            : 'text-green-600'
                        }`}
                      >
                        {product.cantidadActual || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium">Stock Mínimo</p>
                      <p className="text-gray-900">{product.cantidadMinima || 5}</p>
                    </div>
                  </div>

                  {(product.cantidadActual || 0) <= (product.cantidadMinima || 5) && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-red-800 text-xs font-medium flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-1" />
                        Stock bajo - Requiere reposición
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchTerm
                ? 'No se encontraron productos'
                : 'No hay productos registrados'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                Crear tu primer producto
              </button>
            )}
          </div>
        )}
      </div>

      {/* Diálogo de confirmación */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        onClose={closeConfirm}
        onConfirm={handleConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        type={confirmState.type}
        details={confirmState.details}
        loading={confirmState.loading}
      />
    </div>
  );
};

export default ProductForm;
