import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWarehouse } from '../contexts/WarehouseContext';
// import { useTheme } from '../contexts/ThemeContext'; // Temporalmente deshabilitado
// import { sendPushNotification } from '../services/pushNotifications'; // Temporalmente deshabilitado
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
  runTransaction,
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
  const { currentUser, userProfile } = useAuth();
  const { activeWarehouse, getActiveWarehouse } = useWarehouse();
  // const { isDark } = useTheme(); // Temporalmente deshabilitado
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [warehouses, setWarehouses] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendWarehouses, setFriendWarehouses] = useState([]);
  const [showTransferOptions, setShowTransferOptions] = useState(false);
  const [warehousesLoaded, setWarehousesLoaded] = useState(false);
  const [friendsLoaded, setFriendsLoaded] = useState(false);

  const [formData, setFormData] = useState({
    productoSKU: '',
    tipoMovimiento: 'entrada',
    subTipo: '',
    cantidad: '',
    numeroDocumento: '',
    razon: '',
    observaciones: '',
    almacenDestino: '',
    tipoTraspaso: '', // 'interno' o 'externo'
    usuarioDestino: '',
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

  // Recargar cuando cambia el almacén activo
  useEffect(() => {
    if (currentUser && activeWarehouse) {
      loadData();
    }
  }, [activeWarehouse]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Cargar solo lo esencial para evitar quota exceeded
      await loadProducts(); 
      // loadRecentMovements(), loadWarehouses(), loadFriends() se cargan bajo demanda
    } catch (error) {
      console.error('Error cargando datos:', error);
      setError('Error al cargar los datos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadWarehouses = async () => {
    if (warehousesLoaded) return; // Evitar cargas duplicadas
    try {
      const warehousesRef = collection(db, 'usuarios', currentUser.uid, 'almacenes');
      const snapshot = await getDocs(warehousesRef);
      
      const warehousesData = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.activo !== false) { // Solo almacenes activos
          warehousesData.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      setWarehouses(warehousesData);
      setWarehousesLoaded(true);
    } catch (error) {
      console.error('Error cargando almacenes:', error);
      setWarehouses([]);
    }
  };

  const loadFriends = async () => {
    if (friendsLoaded) return; // Evitar cargas duplicadas
    try {
      const friendsRef = collection(db, 'amistades');
      const snapshot = await getDocs(friendsRef);
      
      const friendsData = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if ((data.usuarioId === currentUser.uid || data.amigoId === currentUser.uid) && 
            data.estado === 'aceptada') {
          friendsData.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      setFriends(friendsData);
      setFriendsLoaded(true);
    } catch (error) {
      console.error('Error cargando amigos:', error);
      setFriends([]);
    }
  };

  const loadProducts = async () => {
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
      // Cargar TODOS los movimientos y filtrar en el cliente (evita errores de índices)
      const movimientosRef = collection(db, 'movimientos');
      const snapshot = await getDocs(movimientosRef);

      const movimientosData = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Filtrar por usuario en el cliente
        if (data.usuarioId === currentUser.uid) {
          movimientosData.push({
            id: doc.id,
            ...data,
          });
        }
      });

      // Ordenar por fecha en el cliente
      movimientosData.sort((a, b) => {
        if (!a.fecha || !b.fecha) return 0;
        return new Date(b.fecha) - new Date(a.fecha);
      });

      setMovements(movimientosData.slice(0, 20)); // Limitar a 20 más recientes
    } catch (error) {
      console.error('Error cargando movimientos:', error);
      setMovements([]); // Array vacío si falla
    }
  };

  const loadFriendWarehouses = async (friendUserId) => {
    try {
      const warehousesRef = collection(db, 'usuarios', friendUserId, 'almacenes');
      const snapshot = await getDocs(warehousesRef);
      
      const warehousesData = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.activo !== false) { // Solo almacenes activos
          warehousesData.push({
            id: doc.id,
            ...data,
            usuarioId: friendUserId
          });
        }
      });
      
      setFriendWarehouses(warehousesData);
    } catch (error) {
      console.error('Error cargando almacenes del colaborador:', error);
      setFriendWarehouses([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const newData = { ...prev, [name]: value };

      if (name === 'tipoMovimiento') {
        newData.subTipo = '';
        newData.almacenDestino = '';
        newData.tipoTraspaso = '';
        newData.usuarioDestino = '';
      }

      // Mostrar opciones de traspaso cuando se selecciona "Traspaso a otro almacén"
      if (name === 'subTipo' && value === 'Traspaso a otro almacén') {
        setShowTransferOptions(true);
        // Cargar datos solo cuando se necesiten
        loadWarehouses();
        loadFriends();
      } else if (name === 'subTipo') {
        setShowTransferOptions(false);
        newData.almacenDestino = '';
        newData.tipoTraspaso = '';
        newData.usuarioDestino = '';
        setFriendWarehouses([]);
      }

      // Cargar almacenes del colaborador cuando se selecciona
      if (name === 'usuarioDestino' && value) {
        loadFriendWarehouses(value);
        newData.almacenDestino = ''; // Reset almacén destino
      }

      return newData;
    });

    if (error) setError('');
  };

  const validateForm = () => {
    // Validar producto seleccionado
    if (!formData.productoSKU) {
      setError('Debes seleccionar un producto');
      return false;
    }

    const producto = products.find((p) => p.sku === formData.productoSKU);
    if (!producto) {
      setError('El producto seleccionado no existe');
      return false;
    }

    // Validar tipo de movimiento
    if (!formData.subTipo) {
      setError('Selecciona el tipo específico de movimiento');
      return false;
    }

    // Validar cantidad (números enteros para inventarios)
    const cantidad = parseInt(formData.cantidad);
    if (!formData.cantidad || isNaN(cantidad) || cantidad <= 0) {
      setError('La cantidad debe ser un número entero mayor a 0');
      return false;
    }

    if (cantidad > 100000) {
      setError('La cantidad no puede ser mayor a 100,000');
      return false;
    }

    // Verificar que sea número entero
    if (formData.cantidad.toString().includes('.')) {
      setError('La cantidad debe ser un número entero (sin decimales)');
      return false;
    }

    // Validar razón
    if (!formData.razon.trim()) {
      setError('La razón del movimiento es obligatoria');
      return false;
    }

    if (formData.razon.trim().length < 5) {
      setError('La razón debe tener al menos 5 caracteres');
      return false;
    }

    if (formData.razon.length > 200) {
      setError('La razón no puede tener más de 200 caracteres');
      return false;
    }

    // Validar número de documento si se proporciona
    if (formData.numeroDocumento && formData.numeroDocumento.length > 50) {
      setError('El número de documento no puede tener más de 50 caracteres');
      return false;
    }

    // Validar observaciones si se proporcionan
    if (formData.observaciones && formData.observaciones.length > 500) {
      setError('Las observaciones no pueden tener más de 500 caracteres');
      return false;
    }

    // Validar stock disponible para salidas
    if (formData.tipoMovimiento === 'salida') {
      const stockActual = producto.cantidadActual || 0;
      
      if (stockActual < cantidad) {
        setError(
          `Stock insuficiente. Disponible: ${stockActual}, Solicitado: ${cantidad}`
        );
        return false;
      }

      // Advertir si el movimiento dejará el stock muy bajo
      const stockFinal = stockActual - cantidad;
      const stockMinimo = producto.cantidadMinima || 5;
      
      if (stockFinal < stockMinimo && stockFinal >= 0) {
        if (window.showWarning) {
          window.showWarning(
            `Este movimiento dejará el stock por debajo del mínimo (${stockMinimo}). Stock final: ${stockFinal}`
          );
        }
      }
    }

    // Validar traspasos
    if (formData.subTipo === 'Traspaso a otro almacén') {
      if (!formData.tipoTraspaso) {
        setError('Selecciona el tipo de traspaso (interno o externo)');
        return false;
      }

      if (!formData.almacenDestino) {
        setError('Selecciona el almacén de destino');
        return false;
      }

      if (formData.tipoTraspaso === 'externo' && !formData.usuarioDestino) {
        setError('Selecciona el usuario destino para traspaso externo');
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
      // Usar parseInt para números enteros (inventarios no usan decimales)
      const cantidad = parseInt(formData.cantidad);
      
      // No necesitamos redondeo para números enteros
      const cantidadFinal = cantidad;

      // Usar transacción con TODOS los reads ANTES de los writes
      await runTransaction(db, async (transaction) => {
        // ===== FASE 1: TODOS LOS READS PRIMERO =====
        
        // Read 1: Producto origen (usar almacén activo)
        const productoRef = doc(
          db,
          'usuarios',
          currentUser.uid,
          'almacenes',
          activeWarehouse,
          'productos',
          formData.productoSKU
        );
        const productoDoc = await transaction.get(productoRef);

        if (!productoDoc.exists()) {
          throw new Error('Producto no encontrado en la base de datos');
        }

        // Read 2: Para traspasos internos, leer producto destino
        let productoDestinoDoc = null;
        if (formData.subTipo === 'Traspaso a otro almacén' && formData.tipoTraspaso === 'interno') {
          const productoDestinoRef = doc(
            db,
            'usuarios',
            currentUser.uid,
            'almacenes',
            formData.almacenDestino,
            'productos',
            formData.productoSKU
          );
          productoDestinoDoc = await transaction.get(productoDestinoRef);
        }

        // Read 3 y 4: Para traspasos externos, leer datos del destino
        let almacenDestinoDoc = null;
        let usuarioDestinoDoc = null;
        
        if (formData.subTipo === 'Traspaso a otro almacén' && formData.tipoTraspaso === 'externo') {
          const [usuarioDestinoId, almacenDestinoId] = formData.almacenDestino.split(':');
          
          const almacenDestinoRef = doc(db, 'usuarios', usuarioDestinoId, 'almacenes', almacenDestinoId);
          almacenDestinoDoc = await transaction.get(almacenDestinoRef);
          
          const usuarioDestinoRef = doc(db, 'usuarios', usuarioDestinoId);
          usuarioDestinoDoc = await transaction.get(usuarioDestinoRef);
        }

        // ===== FASE 2: PROCESAR DATOS =====
        
        const producto = productoDoc.data();
        const cantidadAnterior = producto.cantidadActual || 0;

        let cantidadNueva = cantidadAnterior;
        if (formData.tipoMovimiento === 'entrada') {
          cantidadNueva = cantidadAnterior + cantidadFinal;
        } else {
          cantidadNueva = cantidadAnterior - cantidadFinal;
          if (cantidadNueva < 0) {
            throw new Error('La operación resultaría en stock negativo');
          }
        }

        // ===== FASE 3: TODOS LOS WRITES =====
        
        // Write 1: Actualizar producto
        transaction.update(productoRef, {
          cantidadActual: cantidadNueva,
          fechaActualizacion: new Date().toISOString(),
        });

        // Write 2: Crear movimiento
        const movimientoData = {
          usuarioId: currentUser.uid,
          almacenId: activeWarehouse,
          productoSKU: formData.productoSKU,
          productoNombre: producto.nombre,
          tipoMovimiento: formData.tipoMovimiento,
          subTipo: formData.subTipo,
          cantidad: cantidadFinal,
          cantidadAnterior,
          cantidadNueva,
          razon: formData.razon.trim(),
          numeroDocumento: formData.numeroDocumento.trim() || null,
          observaciones: formData.observaciones.trim() || null,
          fecha: new Date().toISOString(),
          creadoPor: currentUser.email,
        };

        const movimientoRef = doc(collection(db, 'movimientos'));
        transaction.set(movimientoRef, movimientoData);
        
        // Obtener ID del movimiento para referencias
        const movimientoId = movimientoRef.id;

        // Write 3: Para traspasos internos, crear entrada directamente
        if (formData.subTipo === 'Traspaso a otro almacén' && formData.tipoTraspaso === 'interno') {
          // Crear producto en almacén destino o sumar si existe
          const productoDestinoRef = doc(
            db,
            'usuarios',
            currentUser.uid,
            'almacenes',
            formData.almacenDestino,
            'productos',
            formData.productoSKU
          );
          
          if (productoDestinoDoc.exists()) {
            // Producto existe, sumar cantidad
            const productoDestino = productoDestinoDoc.data();
            const nuevaCantidadDestino = productoDestino.cantidadActual + cantidadFinal;
            
            transaction.update(productoDestinoRef, {
              cantidadActual: nuevaCantidadDestino,
              fechaActualizacion: new Date().toISOString(),
            });
          } else {
            // Producto no existe, crear nuevo
            const nuevoProductoDestino = {
              ...producto,
              cantidadActual: cantidadFinal,
              fechaCreacion: new Date().toISOString(),
              fechaActualizacion: new Date().toISOString(),
            };
            
            transaction.set(productoDestinoRef, nuevoProductoDestino);
          }
          
          // Crear movimiento de entrada en almacén destino
          const almacenDestino = warehouses.find(w => w.id === formData.almacenDestino);
          const movimientoEntradaData = {
            usuarioId: currentUser.uid,
            almacenId: formData.almacenDestino,
            productoSKU: formData.productoSKU,
            productoNombre: producto.nombre,
            tipoMovimiento: 'entrada',
            subTipo: 'Traspaso desde otro almacén',
            cantidad: cantidadFinal,
            stockAnterior: productoDestinoDoc.exists() ? productoDestinoDoc.data().cantidadActual : 0,
            stockNuevo: productoDestinoDoc.exists() ? (productoDestinoDoc.data().cantidadActual + cantidadFinal) : cantidadFinal,
            numeroDocumento: formData.numeroDocumento.trim(),
            razon: `Traspaso interno desde ${getActiveWarehouse().nombre}`,
            observaciones: formData.observaciones.trim(),
            fecha: new Date().toISOString(),
            creadoPor: currentUser.email,
          };
          
          const movimientoEntradaRef = doc(collection(db, 'movimientos'));
          transaction.set(movimientoEntradaRef, movimientoEntradaData);
        }

        // Write 4 y 5: Para traspasos externos, crear solicitud y notificación
        if (formData.subTipo === 'Traspaso a otro almacén' && formData.tipoTraspaso === 'externo') {
          const [usuarioDestinoId, almacenDestinoId] = formData.almacenDestino.split(':');

          if (almacenDestinoDoc && almacenDestinoDoc.exists() && usuarioDestinoDoc && usuarioDestinoDoc.exists()) {
            const almacenDestino = almacenDestinoDoc.data();
            const usuarioDestino = usuarioDestinoDoc.data();

            // Write 3: Crear solicitud de traspaso
            const solicitudData = {
              usuarioOrigenId: currentUser.uid,
              usuarioOrigenNombre: userProfile?.nombreCompleto || currentUser.displayName || 'Usuario',
              usuarioOrigenEmail: currentUser.email || '',
              almacenOrigenId: activeWarehouse,
              almacenOrigenNombre: getActiveWarehouse().nombre,
              
              usuarioDestinoId: usuarioDestinoId,
              usuarioDestinoNombre: usuarioDestino.nombreCompleto || usuarioDestino.displayName || 'Usuario',
              usuarioDestinoEmail: usuarioDestino.email || '',
              almacenDestinoId: almacenDestinoId,
              almacenDestinoNombre: almacenDestino.nombre || 'Almacén',
              
              productoSKU: formData.productoSKU,
              productoNombre: producto.nombre || '',
              productoCategoria: producto.categoria || 'General',
              cantidad: cantidadFinal,
              
              razon: formData.razon.trim() || 'Traspaso',
              observaciones: formData.observaciones.trim() || '',
              numeroDocumento: formData.numeroDocumento.trim() || '',
              
              estado: 'pendiente',
              fechaCreacion: new Date().toISOString(),
              movimientoOrigenId: movimientoId,
            };

            const solicitudRef = doc(collection(db, 'solicitudes-traspaso'));
            const solicitudId = solicitudRef.id;
            transaction.set(solicitudRef, solicitudData);

            // Write 4: Crear notificación
            const remitenteNombre = userProfile?.nombreCompleto || currentUser.displayName || 'Usuario';
            const notificacionData = {
              usuarioId: usuarioDestinoId,
              tipo: 'solicitud_traspaso',
              titulo: 'Nueva Solicitud de Traspaso',
              mensaje: `${remitenteNombre} quiere transferirte ${cantidadFinal} ${producto.nombre}`,
              leida: false,
              fecha: new Date().toISOString(),
              datos: {
                solicitudId: solicitudId,
                productoNombre: producto.nombre || '',
                cantidad: cantidadFinal,
                remitente: remitenteNombre
              }
            };

            const notificacionRef = doc(collection(db, 'notificaciones'));
            transaction.set(notificacionRef, notificacionData);

            // 📲 PUSH NOTIFICATION - Temporalmente deshabilitada
            // setTimeout(async () => {
            //   try {
            //     await sendPushNotification(
            //       usuarioDestinoId,
            //       '📦 Nueva Solicitud de Traspaso',
            //       `${userProfile?.nombreCompleto || 'Usuario'} te envió ${cantidadFinal} ${producto.nombre}`,
            //       {
            //         type: 'transfer_request',
            //         solicitudId: solicitudRef.id,
            //         action: 'view_transfers'
            //       }
            //     );
            //     console.log('📲 Push notification enviada para traspaso');
            //   } catch (pushError) {
            //     console.log('📱 Push notification falló (no crítico):', pushError);
            //   }
            // }, 1000);
          }
        }
      });

      const tipoLabel = formData.tipoMovimiento === 'entrada' ? 'Entrada' : 'Salida';
      const producto = products.find(p => p.sku === formData.productoSKU);
      
      // Mensaje específico para traspasos externos
      if (formData.subTipo === 'Traspaso a otro almacén' && formData.tipoTraspaso === 'externo') {
        setSuccess(
          `Solicitud de traspaso enviada: ${cantidadFinal} unidades de ${producto.nombre}. El usuario destino debe aprobar la solicitud.`
        );
        
        if (window.showInfo) {
          window.showInfo('Solicitud enviada. El usuario destino recibirá una notificación para aprobar/rechazar el traspaso.');
        }
      } else {
        setSuccess(
          `${tipoLabel} registrada exitosamente: ${cantidadFinal} unidades de ${producto.nombre}`
        );
      }

      // Mostrar notificación global
      if (window.showSuccess) {
        window.showSuccess(
          `${tipoLabel} registrada: ${cantidadFinal} unidades de ${producto.nombre}`
        );
      }

      // Resetear formulario
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
      
      // Determinar mensaje de error específico
      let errorMessage = 'Error al registrar el movimiento';
      
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Movimientos de Inventario
          </h1>
          <p className="text-gray-600 mt-1">
            <span className="font-medium text-blue-600">{getActiveWarehouse().nombre}</span> • {products.length} productos disponibles
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-2">
          <div className="text-sm text-gray-500 dark:text-gray-400">
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
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <ArrowUpDown className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Registrar Movimiento
            </h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Producto */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
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
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
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
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
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

            {/* Opciones de Traspaso */}
            {showTransferOptions && (
              <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-4">Configuración de Traspaso</h4>
                
                {/* Tipo de Traspaso */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      handleInputChange({ target: { name: 'tipoTraspaso', value: 'interno' } });
                    }}
                    className={`p-3 rounded-lg border-2 transition-colors text-left ${
                      formData.tipoTraspaso === 'interno'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                    disabled={submitting}
                  >
                    <div className="font-medium">Traspaso Interno</div>
                    <div className="text-xs text-gray-600">Entre mis propios almacenes</div>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      handleInputChange({ target: { name: 'tipoTraspaso', value: 'externo' } });
                    }}
                    className={`p-3 rounded-lg border-2 transition-colors text-left ${
                      formData.tipoTraspaso === 'externo'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                    disabled={submitting}
                  >
                    <div className="font-medium">Traspaso Externo</div>
                    <div className="text-xs text-gray-600">A colaboradores (con PDF)</div>
                  </button>
                </div>

                {/* Selección de Almacén Destino */}
                {formData.tipoTraspaso === 'interno' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      Almacén de Destino *
                    </label>
                    <select
                      name="almacenDestino"
                      value={formData.almacenDestino}
                      onChange={handleInputChange}
                      className="input-field"
                      disabled={submitting}
                      required
                    >
                      <option value="">Seleccionar almacén</option>
                      {warehouses.filter(w => w.id !== activeWarehouse).map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.nombre} - {warehouse.ubicacion}
                        </option>
                      ))}
                    </select>
                    {warehouses.filter(w => w.id !== activeWarehouse).length === 0 && (
                      <p className="text-xs text-orange-600 mt-1">
                        No tienes almacenes adicionales. Crea uno en Configuración → Gestión de Almacenes
                      </p>
                    )}
                  </div>
                )}

                {/* Selección de Usuario y Almacén para Traspaso Externo */}
                {formData.tipoTraspaso === 'externo' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                        Colaborador Destino *
                      </label>
                      <select
                        name="usuarioDestino"
                        value={formData.usuarioDestino}
                        onChange={handleInputChange}
                        className="input-field"
                        disabled={submitting}
                        required
                      >
                        <option value="">Seleccionar colaborador</option>
                        {friends.map((friend) => {
                          const isInitiator = friend.usuarioId === currentUser.uid;
                          const friendData = isInitiator 
                            ? { nombre: friend.amigoNombre, email: friend.amigoEmail, id: friend.amigoId }
                            : { nombre: friend.usuarioNombre, email: friend.usuarioEmail, id: friend.usuarioId };
                          
                          return (
                            <option key={friend.id} value={friendData.id}>
                              {friendData.nombre} ({friendData.email})
                            </option>
                          );
                        })}
                      </select>
                      {friends.length === 0 && (
                        <p className="text-xs text-orange-600 mt-1">
                          No tienes colaboradores confirmados. Agrega uno en Configuración → Sistema de Colaboradores
                        </p>
                      )}
                    </div>

                    {formData.usuarioDestino && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                          Almacén de Destino *
                        </label>
                        <select
                          name="almacenDestino"
                          value={formData.almacenDestino}
                          onChange={handleInputChange}
                          className="input-field"
                          disabled={submitting}
                          required
                        >
                          <option value="">Seleccionar almacén del colaborador</option>
                          {friendWarehouses.map((warehouse) => (
                            <option key={warehouse.id} value={`${warehouse.usuarioId}:${warehouse.id}`}>
                              {warehouse.nombre} - {warehouse.ubicacion}
                            </option>
                          ))}
                        </select>
                        {friendWarehouses.length === 0 && (
                          <p className="text-xs text-orange-600 mt-1">
                            Cargando almacenes del colaborador...
                          </p>
                        )}
                      </div>
                    )}

                    {formData.almacenDestino && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-sm font-medium text-green-900 mb-1">
                          ✅ Traspaso Externo Confirmado
                        </p>
                        <p className="text-xs text-green-700">
                          Se generará un PDF de traspaso y se notificará al usuario destino
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Cantidad */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Cantidad *
              </label>
              <div className="relative">
                <input
                  type="number"
                  name="cantidad"
                  value={formData.cantidad}
                  onChange={handleInputChange}
                  className="input-field pl-10"
                  min="1"
                  step="1"
                  placeholder="0"
                  disabled={submitting}
                  required
                  onWheel={(e) => {
                    // PREVENIR scroll del mouse que cambia valores
                    e.target.blur();
                  }}
                />
                <Calculator className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Número de documento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
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
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Producto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Cantidad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Stock Anterior
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Stock Nuevo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Razón
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200">
                {filteredMovements.map((movement) => (
                  <tr key={movement.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatDate(movement.fecha)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {movement.productoNombre}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {movement.tipoMovimiento === 'entrada' ? '+' : '-'}
                      {movement.cantidad}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {movement.cantidadAnterior}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {movement.cantidadNueva}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs truncate">
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
            <p className="text-gray-500 dark:text-gray-400">
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
