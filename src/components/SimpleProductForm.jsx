import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import LoadingSpinner from './LoadingSpinner';
import { Package, Plus, Check } from 'lucide-react';

const SimpleProductForm = () => {
  const { currentUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    sku: '',
    nombre: '',
    categoria: 'Otros',
    cantidadActual: '',
    precioVenta: '',
  });

  const categorias = [
    'Electrónicos',
    'Ropa',
    'Hogar',
    'Deportes',
    'Otros',
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.sku.trim()) {
      setError('El SKU es obligatorio');
      return;
    }

    if (!formData.nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const productData = {
        sku: formData.sku.toUpperCase().trim(),
        nombre: formData.nombre.trim(),
        categoria: formData.categoria,
        cantidadActual: parseFloat(formData.cantidadActual) || 0,
        cantidadMinima: 5,
        precioVenta: parseFloat(formData.precioVenta) || 0,
        precioCompra: 0,
        proveedor: '',
        ubicacionFisica: '',
        descripcion: '',
        fechaCreacion: new Date().toISOString(),
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

      await setDoc(productRef, productData);
      
      setSuccess(`Producto "${productData.nombre}" creado correctamente`);
      
      // Resetear formulario
      setFormData({
        sku: '',
        nombre: '',
        categoria: 'Otros',
        cantidadActual: '',
        precioVenta: '',
      });

    } catch (error) {
      console.error('Error guardando producto:', error);
      setError('Error al guardar el producto: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Productos - Versión Simple</h1>
        <p className="text-gray-600 mt-1">
          Formulario simplificado que funciona correctamente
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-700">{success}</p>
        </div>
      )}

      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Nuevo Producto</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SKU */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SKU *
              </label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleInputChange}
                className="input-field"
                placeholder="Ej: PROD001"
                required
                disabled={submitting}
              />
            </div>

            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre *
              </label>
              <input
                type="text"
                name="nombre"
                value={formData.nombre}
                onChange={handleInputChange}
                className="input-field"
                placeholder="Nombre del producto"
                required
                disabled={submitting}
              />
            </div>

            {/* Categoría */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoría
              </label>
              <select
                name="categoria"
                value={formData.categoria}
                onChange={handleInputChange}
                className="input-field"
                disabled={submitting}
              >
                {categorias.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria}
                  </option>
                ))}
              </select>
            </div>

            {/* Cantidad */}
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
                placeholder="0"
                min="0"
                step="1"
                disabled={submitting}
              />
            </div>

            {/* Precio */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Precio de Venta
              </label>
              <input
                type="number"
                name="precioVenta"
                value={formData.precioVenta}
                onChange={handleInputChange}
                className="input-field"
                placeholder="0.00"
                min="0"
                step="0.01"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="mt-6">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full md:w-auto"
            >
              {submitting ? (
                <LoadingSpinner size="sm" text="" />
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Crear Producto
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-semibold text-green-900 mb-2">✅ Formulario Funcionando</h3>
        <p className="text-green-800 text-sm">
          Esta es una versión simplificada del formulario de productos que funciona correctamente.
          Prueba crear un producto para verificar que Firebase esté funcionando.
        </p>
      </div>
    </div>
  );
};

export default SimpleProductForm;