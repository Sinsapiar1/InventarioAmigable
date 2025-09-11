import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const DebugInfo = () => {
  const { currentUser, userProfile } = useAuth();

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-100 border border-yellow-300 rounded-lg p-3 text-xs max-w-xs z-50">
      <h3 className="font-bold text-yellow-800 mb-2">🐛 Debug Info</h3>
      <div className="space-y-1 text-yellow-700">
        <p><strong>Usuario:</strong> {currentUser ? '✅ Conectado' : '❌ No conectado'}</p>
        <p><strong>Email:</strong> {currentUser?.email || 'N/A'}</p>
        <p><strong>Perfil:</strong> {userProfile ? '✅ Cargado' : '❌ No cargado'}</p>
        <p><strong>Commit:</strong> 7ef3c46</p>
        <p><strong>Fecha:</strong> {new Date().toLocaleTimeString()}</p>
        <p><strong>URL:</strong> {window.location.href}</p>
      </div>
    </div>
  );
};

export default DebugInfo;