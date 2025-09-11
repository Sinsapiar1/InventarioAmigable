import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({
  size = 'md',
  text = 'Cargando...',
  overlay = false,
  className = '',
  color = 'blue',
  showDots = false,
}) => {
  // Tamaños del spinner
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  // Tamaños del texto
  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  };

  // Colores del spinner
  const colorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    red: 'text-red-600',
    gray: 'text-gray-600',
    white: 'text-white',
  };

  const SpinnerContent = () => (
    <div
      className={`flex flex-col items-center justify-center space-y-3 ${className}`}
    >
      <Loader2 className={`${sizeClasses[size]} ${colorClasses[color]} animate-spin`} />
      {text && (
        <p className={`${textSizeClasses[size]} text-gray-600 font-medium`}>
          {text}
          {showDots && <span className="animate-pulse">...</span>}
        </p>
      )}
    </div>
  );

  // Si es overlay, mostrar sobre toda la pantalla
  if (overlay) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
        <SpinnerContent />
      </div>
    );
  }

  // Spinner normal
  return <SpinnerContent />;
};

export default LoadingSpinner;
