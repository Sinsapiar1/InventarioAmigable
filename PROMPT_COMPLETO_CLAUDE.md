# 🔐 PROMPT COMPLETO PARA CLAUDE - VERIFICACIÓN EMAIL

## 📋 **CONTEXTO COMPLETO:**

Tengo un Sistema de Inventario en React + Firebase que funciona PERFECTAMENTE. Necesito agregar **verificación por email** para nuevos registros, pero cuando lo intenté **rompí el login de usuarios existentes**.

---

## 🔧 **CÓDIGO ACTUAL QUE FUNCIONA:**

### **AuthContext.jsx - Función signup() actual:**
```javascript
// Registrar nuevo usuario
async function signup(email, password, fullName) {
  try {
    // Validar datos antes de proceder
    validateSignupData(email, password, fullName);

    // Crear usuario en Firebase Auth
    const { user } = await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

    // Actualizar perfil con nombre
    await updateProfile(user, {
      displayName: fullName.trim(),
    });

    // Crear documento de usuario en Firestore
    const userDoc = {
      email: user.email,
      nombreCompleto: fullName.trim(),
      rol: 'administrador',
      fechaCreacion: new Date().toISOString(),
      fechaUltimoAcceso: new Date().toISOString(),
      configuracion: {
        tema: 'light',
        idioma: 'es',
        notificaciones: true,
        primerAcceso: true,
      },
      estado: 'activo',
    };

    // Crear almacén por defecto
    const almacenDefault = {
      nombre: 'Almacén Principal',
      ubicacion: 'Ubicación Principal',
      descripcion: 'Almacén principal del sistema',
      fechaCreacion: new Date().toISOString(),
      activo: true,
      configuracion: {
        alertasStockBajo: true,
        nivelMinimoDefault: 5,
      },
    };

    // Crear usuario y almacén
    await Promise.all([
      setDoc(doc(db, 'usuarios', user.uid), userDoc),
      setDoc(
        doc(db, 'usuarios', user.uid, 'almacenes', 'principal'),
        almacenDefault
      ),
    ]);

    // Mostrar mensaje de éxito
    if (window.showSuccess) {
      window.showSuccess('Cuenta creada exitosamente. ¡Bienvenido!');
    }

    return user;
  } catch (error) {
    console.error('Error en registro:', error);
    throw new Error(getErrorMessage(error.code || error.message));
  }
}
```

### **AuthContext.jsx - onAuthStateChanged() actual:**
```javascript
// Efecto para escuchar cambios en la autenticación
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    setCurrentUser(user);

    if (user) {
      // Cargar perfil del usuario cuando se autentica
      await loadUserProfile(user.uid);
    } else {
      setUserProfile(null);
    }

    setLoading(false);
  });

  return unsubscribe; // Limpiar suscripción
}, []);
```

### **Login.jsx - handleSubmit() actual:**
```javascript
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
```

---

## 🚨 **LO QUE INTENTÉ Y FALLÓ:**

### **Intento 1: sendEmailVerification**
```javascript
// En signup()
await sendEmailVerification(user);

// En onAuthStateChanged()
if (!user.emailVerified) {
  setCurrentUser(null); // ❌ ESTO ROMPIÓ TODO
}
```

**PROBLEMA:** Bloqueó a TODOS los usuarios (existentes y nuevos) porque ninguno tenía `emailVerified: true`.

### **Intento 2: Campo personalizado emailVerificado**
```javascript
// En signup()
userDoc.emailVerificado = false;

// En onAuthStateChanged()
if (profile && profile.emailVerificado === false) {
  setCurrentUser(null); // ❌ TAMBIÉN ROMPIÓ TODO
}
```

**PROBLEMA:** Usuarios existentes no tienen este campo, así que también fueron bloqueados.

---

## 🎯 **LO QUE NECESITO QUE FUNCIONE:**

### **FLUJO DESEADO:**
1. **Usuario nuevo se registra** → Firebase crea cuenta
2. **Firebase envía email** de verificación automáticamente
3. **Usuario NO puede acceder** hasta verificar email
4. **Usuario verifica email** → Acceso al sistema
5. **Usuarios existentes** siguen funcionando sin verificación

### **USUARIOS EXISTENTES:**
- Creados antes de hoy (2025-09-11)
- NO tienen campo `emailVerified`
- DEBEN poder entrar sin verificación

### **USUARIOS NUEVOS:**
- Creados desde hoy en adelante
- DEBEN verificar email obligatoriamente
- Firebase debe enviar email automáticamente

---

## 🔧 **RESTRICCIONES TÉCNICAS:**

### **DEBE MANTENER:**
- ✅ **Todo el código actual** funcionando
- ✅ **Usuarios existentes** pueden entrar
- ✅ **Estructura de datos** sin cambios mayores
- ✅ **Firebase plan gratuito** únicamente

### **NO PUEDE ROMPER:**
- ❌ Login de usuarios existentes
- ❌ Sistema de traspasos (funciona perfecto)
- ❌ Sistema de colaboradores
- ❌ Gestión de productos

---

## 🎯 **PREGUNTA ESPECÍFICA:**

**¿Cómo modificar el código de AuthContext para que:**

1. **sendEmailVerification** se ejecute para usuarios nuevos
2. **onAuthStateChanged** distinga entre usuarios nuevos/existentes
3. **Usuarios existentes** NO sean bloqueados
4. **Usuarios nuevos** SÍ requieran verificación

### **¿La solución sería algo como?**
```javascript
// En onAuthStateChanged()
const isNewUser = // ¿Cómo detectar esto?
const needsVerification = isNewUser && !user.emailVerified;

if (needsVerification) {
  // No autenticar
} else {
  // Autenticar normalmente
}
```

---

## 📋 **DATOS ADICIONALES:**

### **Firebase Config:**
```javascript
const firebaseConfig = {
  apiKey: 'AIzaSyBk0R1PyH76HBGqnIu8wpyai3Y3keq_GMc',
  authDomain: 'inventario-pro-9f9e6.firebaseapp.com',
  projectId: 'inventario-pro-9f9e6',
  // ...
};
```

### **Estructura Firestore:**
```
usuarios/{userId} = {
  email: "usuario@ejemplo.com",
  nombreCompleto: "Usuario",
  fechaCreacion: "2025-09-11T00:00:00.000Z",
  rol: "administrador",
  // ... más campos
}
```

---

## 🎯 **RESULTADO ESPERADO:**

Un código que permita:
- ✅ **Nuevos usuarios**: Registro → Email verificación → Acceso
- ✅ **Usuarios existentes**: Login directo sin verificación
- ✅ **Firebase nativo**: sendEmailVerification funcionando
- ✅ **Sin romper**: Sistema actual intacto

**¿Cuál es tu solución técnica específica para implementar esto de manera robusta?**