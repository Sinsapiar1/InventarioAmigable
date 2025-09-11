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
  const [processingRequest, setProcessingRequest] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [completedTransfers, setCompletedTransfers] = useState([]);

  useEffect(() => {
    if (isOpen) {
      console.log('📋 TransferRequestManager abierto, cargando solicitudes...');
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
      console.log('📥 Cargando solicitudes pendientes para usuario:', currentUser.uid);
      const transfersRef = collection(db, 'solicitudes-traspaso');
      const snapshot = await getDocs(transfersRef);
      
      const pending = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log('📄 Solicitud encontrada:', {
          id: doc.id,
          usuarioDestino: data.usuarioDestinoId,
          estado: data.estado,
          esParaMi: data.usuarioDestinoId === currentUser.uid
        });
        
        if (data.usuarioDestinoId === currentUser.uid && data.estado === 'pendiente') {
          pending.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      console.log('📋 Solicitudes pendientes encontradas:', pending.length);
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
      // Prevenir doble clic específico para esta solicitud
      setProcessingRequest(requestId);
      console.log('🚀 Iniciando procesamiento de solicitud:', requestId, action);
      const requestRef = doc(db, 'solicitudes-traspaso', requestId);
      const requestDoc = await getDoc(requestRef);
      
      if (!requestDoc.exists()) {
        throw new Error('Solicitud no encontrada');
      }

      const requestData = requestDoc.data();

      if (action === 'approve') {
        // APROBAR: Crear producto en destino
        await runTransaction(db, async (transaction) => {
          // Read 1: Leer solicitud
          const requestDocRead = await transaction.get(requestRef);
          const data = requestDocRead.data();

          // Read 2: Verificar producto en almacén destino
          console.log('🔍 Buscando producto en destino:', {
            usuarioId: currentUser.uid,
            almacenId: data.almacenDestinoId,
            productoSKU: data.productoSKU
          });
          
          const productoDestinoRef = doc(
            db,
            'usuarios',
            currentUser.uid,
            'almacenes',
            data.almacenDestinoId,
            'productos',
            data.productoSKU
          );
          const productoDestinoDoc = await transaction.get(productoDestinoRef);
          
          console.log('📦 Producto existe en destino:', productoDestinoDoc.exists());

          // Write 1: Actualizar estado de solicitud
          transaction.update(requestRef, {
            estado: 'aprobada',
            fechaAprobacion: new Date().toISOString(),
            aprobadoPor: currentUser.email || ''
          });

          // Write 2: Crear o actualizar producto en destino
          if (productoDestinoDoc.exists()) {
            // SUMAR al producto existente
            const productoExistente = productoDestinoDoc.data();
            const cantidadAnterior = productoExistente.cantidadActual || 0;
            const cantidadNueva = cantidadAnterior + data.cantidad;

            console.log('✅ Sumando a producto existente:', {
              cantidadAnterior,
              cantidadASumar: data.cantidad,
              cantidadNueva
            });

            transaction.update(productoDestinoRef, {
              cantidadActual: cantidadNueva,
              fechaActualizacion: new Date().toISOString()
            });
          } else {
            // CREAR producto nuevo
            console.log('🆕 Creando producto nuevo:', {
              sku: data.productoSKU,
              nombre: data.productoNombre,
              cantidad: data.cantidad
            });

            const nuevoProducto = {
              sku: data.productoSKU,
              nombre: data.productoNombre,
              categoria: data.productoCategoria || 'Traspasos',
              cantidadActual: data.cantidad,
              cantidadMinima: 5,
              precioVenta: 0,
              precioCompra: 0,
              proveedor: `Traspaso de ${data.usuarioOrigenNombre || 'Usuario'}`,
              ubicacionFisica: '',
              descripcion: 'Producto recibido por traspaso externo',
              fechaCreacion: new Date().toISOString(),
              fechaActualizacion: new Date().toISOString(),
            };

            transaction.set(productoDestinoRef, nuevoProducto);
          }

          // Write 3: Registrar movimiento de entrada
          const movimientoEntrada = {
            usuarioId: currentUser.uid,
            almacenId: data.almacenDestinoId,
            productoSKU: data.productoSKU,
            productoNombre: data.productoNombre,
            tipoMovimiento: 'entrada',
            subTipo: 'Traspaso externo aprobado',
            cantidad: data.cantidad,
            cantidadAnterior: productoDestinoDoc.exists() ? (productoDestinoDoc.data().cantidadActual || 0) : 0,
            cantidadNueva: (productoDestinoDoc.exists() ? (productoDestinoDoc.data().cantidadActual || 0) : 0) + data.cantidad,
            razon: `Traspaso aprobado desde ${data.usuarioOrigenNombre}`,
            numeroDocumento: `TRX-${requestId.slice(-8)}`,
            observaciones: `Traspaso externo de: ${data.usuarioOrigenNombre}`,
            fecha: new Date().toISOString(),
            creadoPor: currentUser.email || '',
            traspasoId: requestId
          };

          const movimientoRef = doc(collection(db, 'movimientos'));
          transaction.set(movimientoRef, movimientoEntrada);
        });

        // Generar PDF
        generateTransferPDF(requestData);

        if (window.showSuccess) {
          window.showSuccess(`✅ Traspaso aprobado: ${requestData.cantidad} ${requestData.productoNombre} agregadas a tu inventario`);
        }

      } else if (action === 'reject') {
        // RECHAZAR: Devolver stock al origen
        await runTransaction(db, async (transaction) => {
          // Read 1: Leer solicitud
          const requestDocRead = await transaction.get(requestRef);
          const data = requestDocRead.data();

          // Read 2: Leer producto origen para devolver stock
          const productoOrigenRef = doc(
            db,
            'usuarios',
            data.usuarioOrigenId,
            'almacenes',
            data.almacenOrigenId,
            'productos',
            data.productoSKU
          );
          const productoOrigenDoc = await transaction.get(productoOrigenRef);

          // Write 1: Actualizar estado de solicitud
          transaction.update(requestRef, {
            estado: 'rechazada',
            fechaRechazo: new Date().toISOString(),
            rechazadoPor: currentUser.email || ''
          });

          // Write 2: DEVOLVER stock al origen
          if (productoOrigenDoc.exists()) {
            const productoOrigen = productoOrigenDoc.data();
            const cantidadAnterior = productoOrigen.cantidadActual || 0;
            const cantidadDevuelta = cantidadAnterior + data.cantidad;

            transaction.update(productoOrigenRef, {
              cantidadActual: cantidadDevuelta,
              fechaActualizacion: new Date().toISOString()
            });

            // Write 3: Registrar movimiento de devolución
            const movimientoDevolucion = {
              usuarioId: data.usuarioOrigenId,
              almacenId: data.almacenOrigenId,
              productoSKU: data.productoSKU,
              productoNombre: data.productoNombre,
              tipoMovimiento: 'entrada',
              subTipo: 'Devolución por rechazo de traspaso',
              cantidad: data.cantidad,
              cantidadAnterior: cantidadAnterior,
              cantidadNueva: cantidadDevuelta,
              razon: `Traspaso rechazado por ${currentUser.email}. Stock devuelto.`,
              numeroDocumento: `DEV-${requestId.slice(-8)}`,
              observaciones: `Devolución automática por rechazo de traspaso`,
              fecha: new Date().toISOString(),
              creadoPor: 'sistema',
              traspasoId: requestId
            };

            const movimientoRef = doc(collection(db, 'movimientos'));
            transaction.set(movimientoRef, movimientoDevolucion);
          }
        });

        if (window.showWarning) {
          window.showWarning(`❌ Traspaso rechazado. Stock devuelto al usuario origen.`);
        }
      }

      await loadTransferRequests();
    } catch (error) {
      console.error('Error procesando solicitud:', error);
      if (window.showError) {
        window.showError('Error al procesar la solicitud: ' + error.message);
      }
    } finally {
      setProcessingRequest(null);
    }
  };

  const generateTransferPDF = (transferData) => {
    const fechaSolicitud = new Date(transferData.fechaCreacion);
    const fechaAprobacion = new Date();
    const numeroDocumento = `TRX-${transferData.id?.slice(-8) || Math.random().toString(36).slice(-8).toUpperCase()}`;
    
    // Crear HTML profesional para PDF
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Documento de Traspaso - ${numeroDocumento}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            background: #f8f9fa;
            color: #333;
        }
        .document { 
            max-width: 800px; 
            margin: 20px auto; 
            background: white; 
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
            border-radius: 8px;
            overflow: hidden;
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
            padding: 30px; 
            text-align: center; 
        }
        .header h1 { font-size: 28px; margin-bottom: 10px; font-weight: 300; }
        .header p { opacity: 0.9; font-size: 16px; }
        .content { padding: 40px; }
        .doc-info { 
            background: #e3f2fd; 
            border-left: 4px solid #2196f3; 
            padding: 15px; 
            margin-bottom: 30px;
            border-radius: 0 8px 8px 0;
        }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 25px; }
        .box { 
            border: 2px solid #e0e0e0; 
            padding: 20px; 
            border-radius: 12px; 
            background: #fafafa;
            transition: all 0.3s ease;
        }
        .box:hover { border-color: #2196f3; background: white; }
        .box h3 { 
            color: #1976d2; 
            margin-bottom: 15px; 
            font-size: 18px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .info-row { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 8px;
            padding: 5px 0;
            border-bottom: 1px dotted #ddd;
        }
        .info-row:last-child { border-bottom: none; margin-bottom: 0; }
        .label { font-weight: 600; color: #424242; }
        .value { color: #666; font-weight: 400; }
        .product-highlight { 
            background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
            color: white;
            text-align: center;
            padding: 25px;
            border-radius: 12px;
            margin: 25px 0;
        }
        .product-highlight h3 { color: white; font-size: 20px; margin-bottom: 15px; }
        .quantity { 
            font-size: 36px; 
            font-weight: bold; 
            margin: 10px 0;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .timeline { 
            background: #fff3e0; 
            border-radius: 12px; 
            padding: 20px; 
            margin: 25px 0;
            border-left: 4px solid #ff9800;
        }
        .timeline h3 { color: #f57c00; margin-bottom: 15px; }
        .timeline-item { 
            display: flex; 
            align-items: center; 
            margin: 10px 0;
            padding: 8px 0;
        }
        .timeline-dot { 
            width: 12px; 
            height: 12px; 
            background: #4caf50; 
            border-radius: 50%; 
            margin-right: 15px;
            flex-shrink: 0;
        }
        .signatures { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 40px; 
            margin-top: 40px;
            padding-top: 30px;
            border-top: 2px solid #e0e0e0;
        }
        .signature-box { text-align: center; }
        .signature-line { 
            border-top: 2px solid #333; 
            margin: 40px 20px 10px; 
            padding-top: 10px;
        }
        .footer { 
            background: #f5f5f5; 
            padding: 20px; 
            text-align: center; 
            font-size: 12px; 
            color: #666;
            border-top: 1px solid #e0e0e0;
        }
        .qr-placeholder {
            width: 80px;
            height: 80px;
            background: #e0e0e0;
            border-radius: 8px;
            margin: 0 auto 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: #666;
        }
        @media print {
            .document { box-shadow: none; margin: 0; }
            .header { background: #667eea !important; -webkit-print-color-adjust: exact; }
            .product-highlight { background: #4caf50 !important; -webkit-print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <div class="document">
        <div class="header">
            <h1>🏢 DOCUMENTO OFICIAL DE TRASPASO</h1>
            <p>Sistema de Inventario Pro - Transferencia de Mercadería</p>
        </div>

        <div class="content">
            <div class="doc-info">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>📄 Documento N°:</strong> ${numeroDocumento}<br>
                        <strong>📅 Fecha de Emisión:</strong> ${fechaAprobacion.toLocaleDateString('es-ES')} a las ${fechaAprobacion.toLocaleTimeString('es-ES')}
                    </div>
                    <div class="qr-placeholder">
                        QR CODE
                    </div>
                </div>
            </div>

            <div class="grid">
                <div class="box">
                    <h3>📤 REMITENTE (ORIGEN)</h3>
                    <div class="info-row">
                        <span class="label">👤 Usuario:</span>
                        <span class="value">${transferData.usuarioOrigenNombre || 'Usuario'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">📧 Email:</span>
                        <span class="value">${transferData.usuarioOrigenEmail || ''}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">🏭 Almacén:</span>
                        <span class="value">${transferData.almacenOrigenNombre || 'Almacén'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">🆔 ID Almacén:</span>
                        <span class="value">${transferData.almacenOrigenId || ''}</span>
                    </div>
                </div>

                <div class="box">
                    <h3>📥 DESTINATARIO</h3>
                    <div class="info-row">
                        <span class="label">👤 Usuario:</span>
                        <span class="value">${transferData.usuarioDestinoNombre || 'Usuario'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">📧 Email:</span>
                        <span class="value">${transferData.usuarioDestinoEmail || ''}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">🏭 Almacén:</span>
                        <span class="value">${transferData.almacenDestinoNombre || 'Almacén'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">🆔 ID Almacén:</span>
                        <span class="value">${transferData.almacenDestinoId || ''}</span>
                    </div>
                </div>
            </div>

            <div class="product-highlight">
                <h3>📦 MERCADERÍA TRANSFERIDA</h3>
                <div style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 20px;">
                    <div style="text-align: left;">
                        <strong>SKU:</strong> ${transferData.productoSKU || ''}<br>
                        <strong>Producto:</strong> ${transferData.productoNombre || ''}<br>
                        <strong>Categoría:</strong> ${transferData.productoCategoria || 'General'}
                    </div>
                    <div class="quantity">
                        ${transferData.cantidad || 0}<br>
                        <small style="font-size: 14px; opacity: 0.9;">unidades</small>
                    </div>
                    <div style="text-align: right;">
                        <strong>Estado:</strong> ✅ APROBADO<br>
                        <strong>Tipo:</strong> Traspaso Externo<br>
                        <strong>Prioridad:</strong> Normal
                    </div>
                </div>
            </div>

            <div class="timeline">
                <h3>⏱️ CRONOLOGÍA DEL TRASPASO</h3>
                <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div>
                        <strong>Solicitud Creada:</strong> ${fechaSolicitud.toLocaleDateString('es-ES')} a las ${fechaSolicitud.toLocaleTimeString('es-ES')}<br>
                        <small>Por: ${transferData.usuarioOrigenNombre || 'Usuario'}</small>
                    </div>
                </div>
                <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div>
                        <strong>Solicitud Aprobada:</strong> ${fechaAprobacion.toLocaleDateString('es-ES')} a las ${fechaAprobacion.toLocaleTimeString('es-ES')}<br>
                        <small>Por: ${transferData.usuarioDestinoNombre || 'Usuario'}</small>
                    </div>
                </div>
                <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div>
                        <strong>Mercadería Transferida:</strong> ${fechaAprobacion.toLocaleDateString('es-ES')}<br>
                        <small>Stock actualizado automáticamente</small>
                    </div>
                </div>
            </div>

            <div class="box">
                <h3>📋 DETALLES ADICIONALES</h3>
                <div class="info-row">
                    <span class="label">💬 Razón del Traspaso:</span>
                    <span class="value">${transferData.razon || 'Traspaso de mercadería'}</span>
                </div>
                <div class="info-row">
                    <span class="label">📝 Observaciones:</span>
                    <span class="value">${transferData.observaciones || 'Ninguna observación adicional'}</span>
                </div>
                <div class="info-row">
                    <span class="label">📄 Documento Referencia:</span>
                    <span class="value">${transferData.numeroDocumento || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="label">🔗 ID de Transacción:</span>
                    <span class="value">${transferData.id || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="label">🔗 Movimiento Origen:</span>
                    <span class="value">${transferData.movimientoOrigenId || 'N/A'}</span>
                </div>
            </div>

            <div class="signatures">
                <div class="signature-box">
                    <div class="signature-line">
                        <strong>REMITENTE</strong><br>
                        ${transferData.usuarioOrigenNombre || 'Usuario'}<br>
                        <small>${transferData.usuarioOrigenEmail || ''}</small>
                    </div>
                </div>
                <div class="signature-box">
                    <div class="signature-line">
                        <strong>DESTINATARIO</strong><br>
                        ${transferData.usuarioDestinoNombre || 'Usuario'}<br>
                        <small>${transferData.usuarioDestinoEmail || ''}</small>
                    </div>
                </div>
            </div>
        </div>

        <div class="footer">
            <div style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 20px;">
                <div style="text-align: left;">
                    <strong>Sistema de Inventario Pro</strong><br>
                    Versión 2.0.0 - Nivel Empresarial
                </div>
                <div style="text-align: center;">
                    <div style="background: #4caf50; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; font-size: 14px;">
                        ✅ TRASPASO COMPLETADO
                    </div>
                </div>
                <div style="text-align: right;">
                    <strong>Generado:</strong> ${fechaAprobacion.toLocaleString('es-ES')}<br>
                    <small>Documento verificable y trazable</small>
                </div>
            </div>
            <hr style="margin: 15px 0; border: none; border-top: 1px solid #ddd;">
            <p style="text-align: center; margin-top: 10px;">
                <strong>📋 Este documento certifica oficialmente la transferencia de mercadería entre usuarios del sistema</strong><br>
                <small>Para verificar la autenticidad, consulte el ID de transacción en el sistema</small>
            </p>
        </div>
    </div>

    <script>
        // Auto-print cuando se abre
        window.onload = function() {
            setTimeout(function() {
                if (confirm('¿Deseas imprimir este documento como PDF?')) {
                    window.print();
                }
            }, 1000);
        }
    </script>
</body>
</html>
    `;

    // Crear blob HTML profesional
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TRASPASO_OFICIAL_${numeroDocumento}_${fechaAprobacion.toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    if (window.showSuccess) {
      window.showSuccess('📄 Documento oficial descargado. Se abrirá automáticamente para imprimir como PDF.');
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
                              disabled={processingRequest === request.id}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-1"
                            >
                              {processingRequest === request.id ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                              ) : (
                                <Check className="w-3 h-3" />
                              )}
                              <span>Aprobar</span>
                            </button>
                            <button
                              onClick={() => respondToRequest(request.id, 'reject')}
                              disabled={processingRequest === request.id}
                              className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-1"
                            >
                              {processingRequest === request.id ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                              ) : (
                                <X className="w-3 h-3" />
                              )}
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