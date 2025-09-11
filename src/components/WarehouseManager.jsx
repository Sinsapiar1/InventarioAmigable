import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '../firebase';
import LoadingSpinner from './LoadingSpinner';
import { 
  Building, 
  Plus, 
  Edit, 
  Trash2, 
  MapPin, 
  Check, 
  X,
  AlertTriangle,
  Archive
} from 'lucide-react';

const WarehouseManager = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    id: '',
    nombre: '',
    ubicacion: '',
    descripcion: '',
    activo: true,
  });

  // Cargar almacenes al abrir
  useEffect(() => {
    if (isOpen) {
      loadWarehouses();
    }
  }, [isOpen]);

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      const warehousesRef = collection(db, 'usuarios', currentUser.uid, 'almacenes');
      const snapshot = await getDocs(warehousesRef);
      
      const warehousesData = [];
      snapshot.forEach((doc) => {
        warehousesData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setWarehouses(warehousesData);
    } catch (error) {
      console.error('Error cargando almacenes:', error);
      setError('Error al cargar los almacenes');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (error) setError('');
  };

  const validateForm = () => {
    if (!formData.nombre.trim()) {
      setError('El nombre del almacén es obligatorio');
      return false;
    }

    if (!formData.ubicacion.trim()) {
      setError('La ubicación es obligatoria');
      return false;
    }

    // Validar nombre único
    if (!editingWarehouse) {
      const nameExists = warehouses.some(
        w => w.nombre.toLowerCase() === formData.nombre.toLowerCase().trim()
      );
      if (nameExists) {
        setError('Ya existe un almacén con este nombre');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    setError('');

    try {
      const warehouseData = {
        nombre: formData.nombre.trim(),
        ubicacion: formData.ubicacion.trim(),
        descripcion: formData.descripcion.trim(),
        activo: formData.activo,
        fechaActualizacion: new Date().toISOString(),
      };

      if (editingWarehouse) {
        // Actualizar almacén existente
        const warehouseRef = doc(db, 'usuarios', currentUser.uid, 'almacenes', editingWarehouse.id);
        await updateDoc(warehouseRef, warehouseData);
        
        if (window.showSuccess) {
          window.showSuccess(`Almacén "${warehouseData.nombre}" actualizado correctamente`);
        }
      } else {
        // Crear nuevo almacén
        warehouseData.fechaCreacion = new Date().toISOString();
        warehouseData.creadoPor = currentUser.email;
        
        // Usar nombre como ID (sin espacios, en minúsculas)
        const warehouseId = formData.nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const warehouseRef = doc(db, 'usuarios', currentUser.uid, 'almacenes', warehouseId);
        
        await setDoc(warehouseRef, warehouseData);
        
        if (window.showSuccess) {
          window.showSuccess(`Almacén "${warehouseData.nombre}" creado correctamente`);
        }
      }

      resetForm();
      await loadWarehouses();
    } catch (error) {
      console.error('Error guardando almacén:', error);
      setError('Error al guardar el almacén');
      
      if (window.showError) {
        window.showError('Error al guardar el almacén');
      }
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      nombre: '',
      ubicacion: '',
      descripcion: '',
      activo: true,
    });
    setEditingWarehouse(null);
    setShowForm(false);
    setError('');
  };

  const handleEdit = (warehouse) => {
    setFormData({
      id: warehouse.id,
      nombre: warehouse.nombre || '',
      ubicacion: warehouse.ubicacion || '',
      descripcion: warehouse.descripcion || '',
      activo: warehouse.activo ?? true,
    });
    setEditingWarehouse(warehouse);
    setShowForm(true);
  };

  const handleDelete = async (warehouse) => {
    if (warehouse.id === 'principal') {
      setError('No se puede eliminar el almacén principal');
      return;
    }

    if (!window.confirm(`¿Estás seguro de eliminar el almacén "${warehouse.nombre}"?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'usuarios', currentUser.uid, 'almacenes', warehouse.id));
      
      if (window.showSuccess) {
        window.showSuccess(`Almacén "${warehouse.nombre}" eliminado`);
      }
      
      await loadWarehouses();
    } catch (error) {
      console.error('Error eliminando almacén:', error);
      setError('Error al eliminar el almacén');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="settings-modal bg-white rounded-lg shadow-xl max-w-4xl w-full mx-auto max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Gestión de Almacenes
                </h3>
                <p className="text-sm text-gray-600">
                  Administra tus almacenes y ubicaciones
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {!showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="btn-primary flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nuevo Almacén</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Formulario */}
          {showForm && (
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-gray-900">
                  {editingWarehouse ? 'Editar Almacén' : 'Nuevo Almacén'}
                </h4>
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre del Almacén *
                  </label>
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    className="input-field"
                    placeholder="Ej: Almacén Norte"
                    required
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ubicación *
                  </label>
                  <input
                    type="text"
                    name="ubicacion"
                    value={formData.ubicacion}
                    onChange={handleInputChange}
                    className="input-field"
                    placeholder="Ej: Calle 123, Ciudad"
                    required
                    disabled={saving}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descripción
                  </label>
                  <textarea
                    name="descripcion"
                    value={formData.descripcion}
                    onChange={handleInputChange}
                    className="input-field"
                    rows="3"
                    placeholder="Descripción del almacén..."
                    disabled={saving}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="activo"
                      checked={formData.activo}
                      onChange={handleInputChange}
                      className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      disabled={saving}
                    />
                    <span className="text-sm text-gray-700">Almacén activo</span>
                  </label>
                </div>

                <div className="md:col-span-2 flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary flex items-center space-x-2"
                  >
                    {saving ? (
                      <LoadingSpinner size="sm" text="" color="white" />
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{editingWarehouse ? 'Actualizar' : 'Crear'} Almacén</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="btn-secondary"
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Lista de Almacenes */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              Almacenes ({warehouses.length})
            </h4>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="lg" text="Cargando almacenes..." />
              </div>
            ) : warehouses.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {warehouses.map((warehouse) => (
                  <div
                    key={warehouse.id}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      warehouse.activo 
                        ? 'border-green-200 bg-green-50' 
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          warehouse.activo ? 'bg-green-100' : 'bg-gray-100'
                        }`}>
                          <Building className={`w-5 h-5 ${
                            warehouse.activo ? 'text-green-600' : 'text-gray-600'
                          }`} />
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900">
                            {warehouse.nombre}
                            {warehouse.id === 'principal' && (
                              <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                Principal
                              </span>
                            )}
                          </h5>
                          <p className="text-sm text-gray-600 flex items-center">
                            <MapPin className="w-4 h-4 mr-1" />
                            {warehouse.ubicacion}
                          </p>
                        </div>
                      </div>
                      
                      {warehouse.id !== 'principal' && (
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleEdit(warehouse)}
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title="Editar almacén"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(warehouse)}
                            className="p-1 text-red-600 hover:text-red-800"
                            title="Eliminar almacén"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {warehouse.descripcion && (
                      <p className="text-sm text-gray-600 mb-3">
                        {warehouse.descripcion}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-xs">
                      <span className={`px-2 py-1 rounded-full font-medium ${
                        warehouse.activo 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {warehouse.activo ? 'Activo' : 'Inactivo'}
                      </span>
                      
                      <span className="text-gray-500">
                        {warehouse.fechaCreacion 
                          ? new Date(warehouse.fechaCreacion).toLocaleDateString('es-ES')
                          : 'Fecha no disponible'
                        }
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Building className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No hay almacenes adicionales</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="btn-primary flex items-center space-x-2 mx-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Crear Primer Almacén</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WarehouseManager;