import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import LoadingSpinner from './LoadingSpinner';
import {
  Package,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  AlertCircle,
} from 'lucide-react';

const Login = () => {
  const { login, signup } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    confirmPassword: '',
  });

  // Manejar cambios en el formulario
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Limpiar error cuando el usuario empiece a escribir
    if (error) setError('');
  };

  // Validar formulario
  const validateForm = () => {
    if (!formData.email || !formData.password) {
      setError('Todos los campos son obligatorios');
      return false;
    }

    if (!isLogin) {
      if (!formData.fullName) {
        setError('El nombre completo es obligatorio');
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Las contraseñas no coinciden');
        return false;
      }
      if (formData.password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres');
        return false;
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Ingresa un email válido');
      return false;
    }

    return true;
  };

  // Manejar envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        await signup(formData.email, formData.password, formData.fullName);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Cambiar entre login y registro
  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setFormData({
      email: '',
      password: '',
      fullName: '',
      confirmPassword: '',
    });
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-300 ${
      isDark 
        ? 'bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950' 
        : 'bg-gradient-to-br from-blue-50 via-white to-blue-50'
    }`}>
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 transition-colors ${
            isDark ? 'bg-blue-500 shadow-lg shadow-blue-500/25' : 'bg-blue-600'
          }`}>
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Sistema de Inventario Pro
          </h1>
          <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            {isLogin ? 'Inicia sesión en tu cuenta' : 'Crea tu cuenta nueva'}
          </p>
          
          {/* Toggle de tema en login */}
          <button
            onClick={toggleTheme}
            className={`mt-4 p-2 rounded-lg transition-all duration-200 ${
              isDark 
                ? 'text-yellow-400 hover:text-yellow-300 hover:bg-gray-800/50' 
                : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
            }`}
            title={`Cambiar a modo ${isDark ? 'claro' : 'oscuro'}`}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Formulario */}
        <div className={`rounded-2xl shadow-xl p-8 transition-colors ${
          isDark 
            ? 'bg-gray-800 border border-gray-700/50 shadow-black/40' 
            : 'bg-white border border-gray-100'
        }`}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Mensaje de error */}
            {error && (
              <div className={`rounded-lg p-4 flex items-center space-x-3 ${
                isDark 
                  ? 'bg-red-900/20 border border-red-800/50' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{error}</p>
              </div>
            )}

            {/* Nombre completo (solo para registro) */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre Completo
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    className="input-field pl-10"
                    placeholder="Tu nombre completo"
                    disabled={loading}
                  />
                  <User className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Correo Electrónico
              </label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="input-field pl-10"
                  placeholder="tu@ejemplo.com"
                  disabled={loading}
                />
                <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="input-field pl-10 pr-10"
                  placeholder="••••••••"
                  disabled={loading}
                />
                <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirmar contraseña (solo para registro) */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirmar Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="input-field pl-10"
                    placeholder="••••••••"
                    disabled={loading}
                  />
                  <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                </div>
              </div>
            )}

            {/* Botón de submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary h-12 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <LoadingSpinner size="sm" text="" />
              ) : (
                <span className="font-semibold">
                  {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
                </span>
              )}
            </button>
          </form>

          {/* Toggle entre login y registro */}
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
              <button
                onClick={toggleMode}
                className="ml-2 text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                disabled={loading}
              >
                {isLogin ? 'Crear cuenta' : 'Iniciar sesión'}
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            Sistema profesional de gestión de inventarios
          </p>
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-400">
              Desarrollado por
            </p>
            <p className="text-sm font-semibold text-gray-600 mt-1">
              Raúl Jaime Pivet Álvarez
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Full Stack Developer
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
