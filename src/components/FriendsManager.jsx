import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  updateDoc,
  addDoc,
  query,
  where 
} from 'firebase/firestore';
import { db } from '../firebase';
import LoadingSpinner from './LoadingSpinner';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Check, 
  X, 
  Clock,
  Search,
  Send,
  AlertTriangle
} from 'lucide-react';

const FriendsManager = ({ isOpen, onClose }) => {
  const { currentUser, userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadFriendsData();
    }
  }, [isOpen]);

  const loadFriendsData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadFriends(),
        loadPendingRequests(),
        loadSentRequests()
      ]);
    } catch (error) {
      console.error('Error cargando datos de amigos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFriends = async () => {
    try {
      // Cargar amigos confirmados
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
    } catch (error) {
      console.error('Error cargando amigos:', error);
    }
  };

  const loadPendingRequests = async () => {
    try {
      // Solicitudes recibidas pendientes
      const requestsRef = collection(db, 'amistades');
      const snapshot = await getDocs(requestsRef);
      
      const pending = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.amigoId === currentUser.uid && data.estado === 'pendiente') {
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
      // Solicitudes enviadas pendientes
      const requestsRef = collection(db, 'amistades');
      const snapshot = await getDocs(requestsRef);
      
      const sent = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.usuarioId === currentUser.uid && data.estado === 'pendiente') {
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

  const sendFriendRequest = async () => {
    if (!searchEmail.trim()) {
      setError('Ingresa un email válido');
      return;
    }

    if (searchEmail.toLowerCase() === currentUser.email.toLowerCase()) {
      setError('No puedes agregarte a ti mismo');
      return;
    }

    try {
      setSearching(true);
      setError('');

      // Buscar usuario por email
      const usersRef = collection(db, 'usuarios');
      const snapshot = await getDocs(usersRef);
      
      let targetUser = null;
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.email.toLowerCase() === searchEmail.toLowerCase()) {
          targetUser = { id: doc.id, ...data };
        }
      });

      if (!targetUser) {
        setError('No se encontró un usuario con ese email');
        return;
      }

      // Verificar si ya son amigos o hay solicitud pendiente
      const existingRelation = [...friends, ...pendingRequests, ...sentRequests].find(
        rel => 
          (rel.usuarioId === targetUser.id && rel.amigoId === currentUser.uid) ||
          (rel.usuarioId === currentUser.uid && rel.amigoId === targetUser.id)
      );

      if (existingRelation) {
        if (existingRelation.estado === 'aceptada') {
          setError('Ya son colaboradores');
        } else {
          setError('Ya existe una solicitud pendiente');
        }
        return;
      }

      // Crear solicitud de amistad
      const requestData = {
        usuarioId: currentUser.uid,
        usuarioNombre: userProfile?.nombreCompleto || currentUser.displayName,
        usuarioEmail: currentUser.email,
        amigoId: targetUser.id,
        amigoNombre: targetUser.nombreCompleto,
        amigoEmail: targetUser.email,
        estado: 'pendiente',
        fechaCreacion: new Date().toISOString(),
        mensaje: `${userProfile?.nombreCompleto || currentUser.displayName} quiere colaborar contigo en inventarios`,
      };

      await addDoc(collection(db, 'amistades'), requestData);

      // Crear notificación para el usuario destino
      const notificationData = {
        usuarioId: targetUser.id,
        tipo: 'solicitud_amistad',
        titulo: 'Nueva Solicitud de Colaboración',
        mensaje: `${userProfile?.nombreCompleto || currentUser.displayName} quiere colaborar contigo`,
        leida: false,
        fecha: new Date().toISOString(),
        datos: {
          solicitanteId: currentUser.uid,
          solicitanteNombre: userProfile?.nombreCompleto || currentUser.displayName,
          solicitanteEmail: currentUser.email,
        }
      };

      await addDoc(collection(db, 'notificaciones'), notificationData);

      if (window.showSuccess) {
        window.showSuccess(`Solicitud enviada a ${targetUser.nombreCompleto}`);
      }

      setSearchEmail('');
      setShowAddFriend(false);
      await loadFriendsData();

    } catch (error) {
      console.error('Error enviando solicitud:', error);
      setError('Error al enviar la solicitud');
    } finally {
      setSearching(false);
    }
  };

  const respondToRequest = async (requestId, action) => {
    try {
      const requestRef = doc(db, 'amistades', requestId);
      
      await updateDoc(requestRef, {
        estado: action === 'accept' ? 'aceptada' : 'rechazada',
        fechaRespuesta: new Date().toISOString(),
      });

      const actionText = action === 'accept' ? 'aceptada' : 'rechazada';
      
      if (window.showSuccess) {
        window.showSuccess(`Solicitud ${actionText} correctamente`);
      }

      await loadFriendsData();
    } catch (error) {
      console.error('Error respondiendo solicitud:', error);
      if (window.showError) {
        window.showError('Error al procesar la solicitud');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-auto max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Sistema de Colaboradores
                </h3>
                <p className="text-sm text-gray-600">
                  Gestiona tus colaboradores para transferencias
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowAddFriend(!showAddFriend)}
                className="btn-primary flex items-center space-x-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Agregar Colaborador</span>
              </button>
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
        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Formulario Agregar Amigo */}
          {showAddFriend && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-blue-900 mb-4">
                Agregar Nuevo Colaborador
              </h4>
              
              <div className="flex gap-3">
                <div className="flex-1">
                  <input
                    type="email"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    className="input-field"
                    placeholder="Email del colaborador..."
                    disabled={searching}
                  />
                </div>
                <button
                  onClick={sendFriendRequest}
                  disabled={searching || !searchEmail.trim()}
                  className="btn-primary flex items-center space-x-2"
                >
                  {searching ? (
                    <LoadingSpinner size="sm" text="" color="white" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Enviar Solicitud</span>
                    </>
                  )}
                </button>
              </div>
              
              <p className="text-sm text-blue-700 mt-2">
                Se enviará una solicitud de colaboración al usuario. Una vez aceptada, 
                podrán transferirse mercadería mutuamente.
              </p>
            </div>
          )}

          {/* Solicitudes Pendientes */}
          {pendingRequests.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                Solicitudes Recibidas ({pendingRequests.length})
              </h4>
              
              <div className="space-y-3">
                {pendingRequests.map((request) => (
                  <div key={request.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{request.usuarioNombre}</p>
                          <p className="text-sm text-gray-600">{request.usuarioEmail}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(request.fechaCreacion).toLocaleDateString('es-ES')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => respondToRequest(request.id, 'accept')}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>Aceptar</span>
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

          {/* Colaboradores Confirmados */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              Colaboradores Confirmados ({friends.length})
            </h4>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="lg" text="Cargando colaboradores..." />
              </div>
            ) : friends.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {friends.map((friend) => {
                  const isInitiator = friend.usuarioId === currentUser.uid;
                  const friendData = isInitiator 
                    ? { nombre: friend.amigoNombre, email: friend.amigoEmail, id: friend.amigoId }
                    : { nombre: friend.usuarioNombre, email: friend.usuarioEmail, id: friend.usuarioId };

                  return (
                    <div key={friend.id} className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{friendData.nombre}</p>
                          <p className="text-sm text-gray-600">{friendData.email}</p>
                          <p className="text-xs text-green-600 font-medium">
                            ✅ Colaboración activa
                          </p>
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-green-200">
                        <p className="text-xs text-green-700">
                          Pueden transferirse mercadería mutuamente
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No tienes colaboradores confirmados</p>
                <button
                  onClick={() => setShowAddFriend(true)}
                  className="btn-primary flex items-center space-x-2 mx-auto"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Agregar Primer Colaborador</span>
                </button>
              </div>
            )}
          </div>

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
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Clock className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{request.amigoNombre}</p>
                        <p className="text-sm text-gray-600">{request.amigoEmail}</p>
                        <p className="text-xs text-blue-600">Solicitud pendiente de respuesta</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendsManager;