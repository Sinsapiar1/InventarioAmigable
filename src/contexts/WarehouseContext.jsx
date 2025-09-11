import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// Crear contexto de almacén
const WarehouseContext = createContext();

// Hook para usar el contexto
export function useWarehouse() {
  const context = useContext(WarehouseContext);
  if (!context) {
    throw new Error('useWarehouse debe ser usado dentro de WarehouseProvider');
  }
  return context;
}

// Provider del contexto
export function WarehouseProvider({ children }) {
  const { currentUser } = useAuth();
  const [activeWarehouse, setActiveWarehouse] = useState('principal');
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);

  // Cargar almacenes cuando cambia el usuario
  useEffect(() => {
    if (currentUser) {
      loadWarehouses();
    } else {
      setWarehouses([]);
      setActiveWarehouse('principal');
    }
  }, [currentUser]);

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      const warehousesRef = collection(db, 'usuarios', currentUser.uid, 'almacenes');
      const snapshot = await getDocs(warehousesRef);
      
      const warehousesData = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.activo !== false) {
          warehousesData.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      // Ordenar: Principal primero, luego alfabético
      warehousesData.sort((a, b) => {
        if (a.id === 'principal') return -1;
        if (b.id === 'principal') return 1;
        return a.nombre.localeCompare(b.nombre);
      });
      
      setWarehouses(warehousesData);
      
      // Si el almacén activo no existe, cambiar a principal
      if (!warehousesData.find(w => w.id === activeWarehouse)) {
        setActiveWarehouse('principal');
      }
    } catch (error) {
      console.error('Error cargando almacenes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Obtener datos del almacén activo
  const getActiveWarehouse = () => {
    return warehouses.find(w => w.id === activeWarehouse) || {
      id: 'principal',
      nombre: 'Almacén Principal',
      ubicacion: 'Ubicación Principal'
    };
  };

  // Cambiar almacén activo
  const changeActiveWarehouse = (warehouseId) => {
    setActiveWarehouse(warehouseId);
    
    // Notificar cambio para que componentes se actualicen
    if (window.showInfo) {
      const warehouse = warehouses.find(w => w.id === warehouseId);
      window.showInfo(`Almacén cambiado a: ${warehouse?.nombre || 'Almacén'}`);
    }
  };

  // Recargar almacenes (para cuando se crean nuevos)
  const refreshWarehouses = async () => {
    await loadWarehouses();
  };

  const value = {
    activeWarehouse,
    warehouses,
    loading,
    getActiveWarehouse,
    changeActiveWarehouse,
    refreshWarehouses,
    setActiveWarehouse,
  };

  return (
    <WarehouseContext.Provider value={value}>
      {children}
    </WarehouseContext.Provider>
  );
}

export default WarehouseContext;