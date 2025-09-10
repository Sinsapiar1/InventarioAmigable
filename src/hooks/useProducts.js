import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';

// Hook personalizado para manejar productos en tiempo real
export function useProducts() {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Referencia a la colección de productos
    const productosRef = collection(
      db,
      'usuarios',
      currentUser.uid,
      'almacenes',
      'principal',
      'productos'
    );

    // Query ordenado por fecha de creación
    const productosQuery = query(
      productosRef,
      orderBy('fechaCreacion', 'desc')
    );

    // Suscripción en tiempo real
    const unsubscribe = onSnapshot(
      productosQuery,
      (snapshot) => {
        const productosData = [];
        snapshot.forEach((doc) => {
          productosData.push({
            id: doc.id,
            ...doc.data(),
          });
        });

        setProducts(productosData);
        setLoading(false);
      },
      (error) => {
        console.error('Error en useProducts:', error);
        setError(error.message);
        setLoading(false);
      }
    );

    // Cleanup function
    return () => unsubscribe();
  }, [currentUser]);

  // Funciones de utilidad
  const getProductBySku = (sku) => {
    return products.find((product) => product.sku === sku);
  };

  const getProductsByCategory = (categoria) => {
    return products.filter((product) => product.categoria === categoria);
  };

  const getLowStockProducts = (threshold = null) => {
    return products.filter((product) => {
      const minimo = threshold || product.cantidadMinima || 5;
      return (product.cantidadActual || 0) <= minimo;
    });
  };

  const getProductsCount = () => products.length;

  const getTotalValue = () => {
    return products.reduce((total, product) => {
      const valor = (product.cantidadActual || 0) * (product.precioVenta || 0);
      return total + valor;
    }, 0);
  };

  const getCategories = () => {
    const categorias = new Set();
    products.forEach((product) => {
      if (product.categoria) {
        categorias.add(product.categoria);
      }
    });
    return Array.from(categorias).sort();
  };

  const searchProducts = (searchTerm) => {
    if (!searchTerm.trim()) return products;

    const term = searchTerm.toLowerCase().trim();
    return products.filter(
      (product) =>
        product.nombre.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term) ||
        product.categoria.toLowerCase().includes(term) ||
        (product.proveedor && product.proveedor.toLowerCase().includes(term))
    );
  };

  return {
    // Estado
    products,
    loading,
    error,

    // Funciones de utilidad
    getProductBySku,
    getProductsByCategory,
    getLowStockProducts,
    getProductsCount,
    getTotalValue,
    getCategories,
    searchProducts,

    // Estadísticas computadas
    stats: {
      total: getProductsCount(),
      lowStock: getLowStockProducts().length,
      totalValue: getTotalValue(),
      categories: getCategories().length,
    },
  };
}

export default useProducts;
