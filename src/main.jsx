import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Configuración de desarrollo para mejor debugging
if (import.meta.env.DEV) {
  console.log('🚀 Sistema de Inventario Pro - Modo Desarrollo');
}

// Obtener el elemento root
const container = document.getElementById('root');
const root = createRoot(container);

// Renderizar la aplicación
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Hot Module Replacement para desarrollo
if (import.meta.hot) {
  import.meta.hot.accept();
}
