import React from 'react';
import { Package, Plus, ArrowRight, AlertTriangle } from 'lucide-react';

const DuplicateSkuDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  duplicateInfo,
  loading = false 
}) => {
  if (!isOpen || !duplicateInfo) return null;

  const { existingProduct, cantidadNueva, cantidadExistente, cantidadFinal } = duplicateInfo;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                SKU Duplicado Detectado
              </h3>
              <p className="text-sm text-gray-600">
                Ya existe un producto con este SKU
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <p className="font-medium text-orange-800">Producto Existente</p>
            </div>
            <div className="text-sm text-orange-700">
              <p><strong>Nombre:</strong> {existingProduct.nombre}</p>
              <p><strong>SKU:</strong> {existingProduct.sku}</p>
              <p><strong>Stock actual:</strong> {cantidadExistente} unidades</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h4 className="font-medium text-blue-800 mb-2">Operación de Suma</h4>
            <div className="flex items-center justify-center space-x-4 text-sm">
              <div className="text-center">
                <p className="text-gray-600">Stock Actual</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{cantidadExistente}</p>
              </div>
              <Plus className="w-5 h-5 text-blue-600" />
              <div className="text-center">
                <p className="text-gray-600">Cantidad Nueva</p>
                <p className="text-xl font-bold text-blue-600">{cantidadNueva}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
              <div className="text-center">
                <p className="text-gray-600">Total Final</p>
                <p className="text-xl font-bold text-green-600">{cantidadFinal}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-sm text-gray-700">
              <strong>¿Qué pasará?</strong> Se sumará la cantidad nueva ({cantidadNueva}) 
              al stock existente ({cantidadExistente}), resultando en {cantidadFinal} unidades totales.
              Se registrará un movimiento de entrada por la cantidad agregada.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 p-6 pt-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="btn-secondary w-full sm:w-auto order-2 sm:order-1"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="btn-primary w-full sm:w-auto order-1 sm:order-2 min-h-[40px] flex items-center justify-center"
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Sumando...</span>
              </div>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Sumar al Stock Existente
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateSkuDialog;