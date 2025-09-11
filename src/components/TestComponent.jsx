import React from 'react';

// Componente de prueba simple para verificar que React funciona
const TestComponent = () => {
  return (
    <div className="p-4 bg-green-100 border border-green-300 rounded-lg m-4">
      <h2 className="text-lg font-bold text-green-800">✅ Componente de Prueba</h2>
      <p className="text-green-700 mt-2">
        Si puedes ver este mensaje, React está funcionando correctamente.
      </p>
      <p className="text-sm text-green-600 mt-1">
        Commit actual: 7ef3c46 - Versión con correcciones críticas
      </p>
    </div>
  );
};

export default TestComponent;