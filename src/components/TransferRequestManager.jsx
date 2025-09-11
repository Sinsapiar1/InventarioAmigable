import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  updateDoc,
  runTransaction,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import LoadingSpinner from './LoadingSpinner';
import { 
  Truck, 
  Check, 
  X, 
  Clock, 
  Package,
  User,
  Building,
  FileText,
  Download,
  AlertTriangle
} from 'lucide-react';

const TransferRequestManager = ({ isOpen, onClose }) => {
  const { currentUser, userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [completedTransfers, setCompletedTransfers] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadTransferRequests();
    }
  }, [isOpen]);

  const loadTransferRequests = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadPendingRequests(),
        loadSentRequests(),
        loadCompletedTransfers()
      ]);
    } catch (error) {
      console.error('Error cargando solicitudes de traspaso:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingRequests = async () => {
    try {
      const transfersRef = collection(db, 'solicitudes-traspaso');
      const snapshot = await getDocs(transfersRef);
      
      const pending = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.usuarioDestinoId === currentUser.uid && data.estado === 'pendiente') {
          pending.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      setPendingRequests(pending);
    } catch (error) {
      console.error('Error cargando solicitudes pendientes:', error);
    }
  };

  const loadSentRequests = async () => {
    try {
      const transfersRef = collection(db, 'solicitudes-traspaso');
      const snapshot = await getDocs(transfersRef);
      
      const sent = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.usuarioOrigenId === currentUser.uid && data.estado === 'pendiente') {
          sent.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      setSentRequests(sent);
    } catch (error) {
      console.error('Error cargando solicitudes enviadas:', error);
    }
  };

  const loadCompletedTransfers = async () => {
    try {
      const transfersRef = collection(db, 'solicitudes-traspaso');
      const snapshot = await getDocs(transfersRef);
      
      const completed = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if ((data.usuarioOrigenId === currentUser.uid || data.usuarioDestinoId === currentUser.uid) && 
            (data.estado === 'aprobada' || data.estado === 'rechazada')) {
          completed.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      // Ordenar por fecha más reciente
      completed.sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));
      setCompletedTransfers(completed.slice(0, 10)); // Solo 10 más recientes
    } catch (error) {
      console.error('Error cargando traspasos completados:', error);
    }
  };

  const respondToRequest = async (requestId, action) => {
    try {
      const requestRef = doc(db, 'solicitudes-traspaso', requestId);
      const requestDoc = await getDoc(requestRef);
      
      if (!requestDoc.exists()) {
        throw new Error('Solicitud no encontrada');
      }

      const requestData = requestDoc.data();

      if (action === 'approve') {
        // Ejecutar traspaso usando transacción
        await runTransaction(db, async (transaction) => {
          // 1. Actualizar estado de la solicitud
          transaction.update(requestRef, {
            estado: 'aprobada',
            fechaAprobacion: new Date().toISOString(),
            aprobadoPor: currentUser.email
          });

          // 2. Crear entrada en almacén destino
          const movimientoEntrada = {
            usuarioId: currentUser.uid,
            almacenId: requestData.almacenDestinoId,
            productoSKU: requestData.productoSKU,
            productoNombre: requestData.productoNombre,
            tipoMovimiento: 'entrada',
            subTipo: 'Traspaso externo recibido',
            cantidad: requestData.cantidad,
            cantidadAnterior: 0, // Se calculará al crear el producto si no existe
            cantidadNueva: requestData.cantidad,
            razon: `Traspaso aprobado desde ${requestData.usuarioOrigenNombre}`,
            numeroDocumento: `TRX-${requestData.id.slice(-8)}`,
            observaciones: `Traspaso externo de: ${requestData.usuarioOrigenNombre} (${requestData.usuarioOrigenEmail})`,
            fecha: new Date().toISOString(),
            creadoPor: currentUser.email,
            traspasoId: requestData.id
          };

          // 3. Verificar si el producto existe en el almacén destino
          const productoDestinoRef = doc(
            db,
            'usuarios',
            currentUser.uid,
            'almacenes',
            requestData.almacenDestinoId,
            'productos',
            requestData.productoSKU
          );

          const productoDestinoDoc = await transaction.get(productoDestinoRef);

          if (productoDestinoDoc.exists()) {
            // Producto existe, sumar cantidad
            const productoDestino = productoDestinoDoc.data();
            const cantidadAnteriorDestino = productoDestino.cantidadActual || 0;
            const cantidadNuevaDestino = Math.round((cantidadAnteriorDestino + requestData.cantidad) * 100) / 100;

            transaction.update(productoDestinoRef, {
              cantidadActual: cantidadNuevaDestino,
              fechaActualizacion: new Date().toISOString()
            });

            movimientoEntrada.cantidadAnterior = cantidadAnteriorDestino;
            movimientoEntrada.cantidadNueva = cantidadNuevaDestino;
          } else {
            // Producto no existe, crear con los datos del origen
            const nuevoProducto = {
              sku: requestData.productoSKU,
              nombre: requestData.productoNombre,
              categoria: requestData.productoCategoria || 'Traspasos',
              cantidadActual: requestData.cantidad,
              cantidadMinima: 5,
              precioVenta: 0,
              precioCompra: 0,
              proveedor: `Traspaso de ${requestData.usuarioOrigenNombre}`,
              ubicacionFisica: '',
              descripcion: `Producto recibido por traspaso externo`,
              fechaCreacion: new Date().toISOString(),
              fechaActualizacion: new Date().toISOString(),
            };

            transaction.set(productoDestinoRef, nuevoProducto);
            
            movimientoEntrada.cantidadAnterior = 0;
            movimientoEntrada.cantidadNueva = requestData.cantidad;
          }

          // 4. Registrar movimiento de entrada
          const movimientoRef = doc(collection(db, 'movimientos'));
          transaction.set(movimientoRef, movimientoEntrada);
        });

        if (window.showSuccess) {
          window.showSuccess(`Traspaso aprobado: ${requestData.cantidad} ${requestData.productoNombre} recibidas`);
        }

        // Generar PDF (simulado por ahora)
        generateTransferPDF(requestData);

      } else {
        // Rechazar solicitud
        await updateDoc(requestRef, {
          estado: 'rechazada',
          fechaRechazo: new Date().toISOString(),
          rechazadoPor: currentUser.email
        });

        if (window.showWarning) {
          window.showWarning(`Traspaso rechazado: ${requestData.cantidad} ${requestData.productoNombre}`);
        }
      }

      await loadTransferRequests();
    } catch (error) {
      console.error('Error procesando solicitud:', error);
      if (window.showError) {
        window.showError('Error al procesar la solicitud de traspaso');
      }
    }
  };

  const generateTransferPDF = (transferData) => {
    // Generar PDF simple (por ahora texto)
    const pdfContent = `
DOCUMENTO DE TRASPASO DE MERCADERÍA
=====================================

ORIGEN:
Usuario: ${transferData.usuarioOrigenNombre}
Email: ${transferData.usuarioOrigenEmail}
Almacén: ${transferData.almacenOrigenNombre}

DESTINO:
Usuario: ${transferData.usuarioDestinoNombre}
Email: ${transferData.usuarioDestinoEmail}
Almacén: ${transferData.almacenDestinoNombre}

PRODUCTO:
SKU: ${transferData.productoSKU}
Nombre: ${transferData.productoNombre}
Cantidad: ${transferData.cantidad}

DETALLES:
Fecha Solicitud: ${new Date(transferData.fechaCreacion).toLocaleDateString('es-ES')}
Fecha Aprobación: ${new Date().toLocaleDateString('es-ES')}
Razón: ${transferData.razon}

Documento generado automáticamente por Sistema de Inventario Pro
    `;

    // Crear y descargar archivo
    const blob = new Blob([pdfContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `traspaso_${transferData.productoSKU}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    if (window.showInfo) {
      window.showInfo('Documento de traspaso descargado');
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
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Truck className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Gestión de Traspasos
                </h3>
                <p className="text-sm text-gray-600">
                  Solicitudes y traspasos entre colaboradores
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="lg" text="Cargando solicitudes..." />
            </div>
          ) : (
            <>
              {/* Solicitudes Recibidas */}
              {pendingRequests.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    Solicitudes Recibidas ({pendingRequests.length})
                  </h4>
                  
                  <div className="space-y-4">
                    {pendingRequests.map((request) => (
                      <div key={request.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-3">
                              <Package className="w-5 h-5 text-orange-600" />
                              <div>
                                <h5 className="font-semibold text-gray-900">{request.productoNombre}</h5>
                                <p className="text-sm text-gray-600">SKU: {request.productoSKU}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-orange-600">{request.cantidad}</p>
                                <p className="text-xs text-gray-500">unidades</p>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                              <div>
                                <p className="text-gray-500">De:</p>
                                <p className="font-medium">{request.usuarioOrigenNombre}</p>
                                <p className="text-xs text-gray-600">{request.almacenOrigenNombre}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Para:</p>
                                <p className="font-medium">{request.almacenDestinoNombre}</p>
                                <p className="text-xs text-gray-600">Mi almacén</p>
                              </div>
                            </div>

                            <div className="bg-gray-50 rounded p-2 mb-3">
                              <p className="text-sm text-gray-700">
                                <strong>Razón:</strong> {request.razon}
                              </p>
                            </div>

                            <p className="text-xs text-gray-500">
                              Solicitado: {new Date(request.fechaCreacion).toLocaleDateString('es-ES')}
                            </p>
                          </div>
                          
                          <div className="flex flex-col gap-2 ml-4">
                            <button
                              onClick={() => respondToRequest(request.id, 'approve')}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-1"
                            >
                              <Check className="w-3 h-3" />
                              <span>Aprobar</span>
                            </button>
                            <button
                              onClick={() => respondToRequest(request.id, 'reject')}
                              className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-1"
                            >
                              <X className="w-3 h-3" />
                              <span>Rechazar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Solicitudes Enviadas */}
              {sentRequests.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    Solicitudes Enviadas ({sentRequests.length})
                  </h4>
                  
                  <div className="space-y-3">
                    {sentRequests.map((request) => (
                      <div key={request.id} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center space-x-3">
                          <Clock className="w-5 h-5 text-blue-600" />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {request.cantidad} {request.productoNombre}
                            </p>
                            <p className="text-sm text-gray-600">
                              Para: {request.usuarioDestinoNombre} → {request.almacenDestinoNombre}
                            </p>
                            <p className="text-xs text-gray-500">
                              Enviado: {new Date(request.fechaCreacion).toLocaleDateString('es-ES')}
                            </p>
                          </div>
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                            Pendiente
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Traspasos Completados */}
              {completedTransfers.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    Historial de Traspasos ({completedTransfers.length})
                  </h4>
                  
                  <div className="space-y-3">
                    {completedTransfers.map((transfer) => (
                      <div key={transfer.id} className={`border rounded-lg p-4 ${
                        transfer.estado === 'aprobada' 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-red-50 border-red-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {transfer.cantidad} {transfer.productoNombre}
                            </p>
                            <p className="text-sm text-gray-600">
                              {transfer.usuarioOrigenNombre} → {transfer.usuarioDestinoNombre}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(transfer.fechaCreacion).toLocaleDateString('es-ES')}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              transfer.estado === 'aprobada' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {transfer.estado === 'aprobada' ? 'Aprobado' : 'Rechazado'}
                            </span>
                            {transfer.estado === 'aprobada' && (
                              <button
                                onClick={() => generateTransferPDF(transfer)}
                                className="p-1 text-blue-600 hover:text-blue-800"
                                title="Descargar documento"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Estado vacío */}
              {pendingRequests.length === 0 && sentRequests.length === 0 && completedTransfers.length === 0 && (
                <div className="text-center py-12">
                  <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">No hay solicitudes de traspaso</p>
                  <p className="text-sm text-gray-400">
                    Los traspasos entre colaboradores aparecerán aquí
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransferRequestManager;