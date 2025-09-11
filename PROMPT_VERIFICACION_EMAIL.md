# 🔐 PROMPT PARA CLAUDE - VERIFICACIÓN EMAIL CON FIREBASE

## 📋 **PROBLEMA ESPECÍFICO:**

Tengo un **Sistema de Inventario** en React + Firebase que funciona PERFECTAMENTE, pero necesito agregar **verificación por email** para nuevos registros.

## 🚨 **LO QUE PASÓ CUANDO LO INTENTÉ:**

### **OBJETIVO:**
- Usuario se registra → Firebase envía email con código → Usuario verifica → Acceso al sistema

### **LO QUE IMPLEMENTÉ:**
```javascript
// En signup()
await sendEmailVerification(user);

// En onAuthStateChanged() 
if (!user.emailVerified) {
  setCurrentUser(null); // NO autenticar
}
```

### **PROBLEMA QUE CAUSÓ:**
- ❌ **Usuarios existentes NO pueden entrar** (porque no tienen emailVerified)
- ❌ **Sistema completamente roto** para todos
- ❌ **Tuve que revertir** todo

---

## 🎯 **LO QUE NECESITO:**

### **VERIFICACIÓN SOLO PARA USUARIOS NUEVOS:**
1. **Usuarios existentes**: Entran sin verificación (backward compatibility)
2. **Usuarios nuevos**: Requieren verificación de email
3. **Firebase sendEmailVerification**: Envía email automáticamente
4. **user.emailVerified**: Verificar estado nativo de Firebase

---

## 🔧 **CÓDIGO ACTUAL QUE FUNCIONA:**

### **AuthContext.jsx - signup():**
```javascript
async function signup(email, password, fullName) {
  try {
    validateSignupData(email, password, fullName);

    const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);

    await updateProfile(user, { displayName: fullName.trim() });

    const userDoc = {
      email: user.email,
      nombreCompleto: fullName.trim(),
      rol: 'administrador',
      fechaCreacion: new Date().toISOString(),
      // ... más campos
    };

    await setDoc(doc(db, 'usuarios', user.uid), userDoc);
    
    return user; // Usuario autenticado inmediatamente
  } catch (error) {
    throw new Error(getErrorMessage(error.code));
  }
}
```

### **AuthContext.jsx - onAuthStateChanged():**
```javascript
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    setCurrentUser(user); // Autentica a TODOS los usuarios
    
    if (user) {
      await loadUserProfile(user.uid);
    } else {
      setUserProfile(null);
    }

    setLoading(false);
  });

  return unsubscribe;
}, []);
```

---

## 🚨 **PROBLEMA ESPECÍFICO:**

**¿Cómo modificar este código para que:**

1. **Usuarios nuevos** requieran verificación de email
2. **Usuarios existentes** sigan funcionando sin verificación
3. **Firebase sendEmailVerification** se use correctamente
4. **onAuthStateChanged** no bloquee a usuarios existentes

---

## 🎯 **PREGUNTA ESPECÍFICA PARA CLAUDE:**

**¿Cómo implementar verificación por email con Firebase de manera que:**

### **✅ FUNCIONE:**
- Nuevos usuarios reciban email de verificación
- Solo usuarios verificados puedan acceder
- Firebase envíe emails automáticamente

### **✅ NO ROMPA:**
- Usuarios existentes puedan entrar sin verificación
- Sistema actual siga funcionando
- Backward compatibility completa

### **🔧 RESTRICCIONES:**
- Firebase plan gratuito únicamente
- No modificar estructura de datos existente
- Mantener toda la funcionalidad actual

---

## 💡 **¿CUÁL ES LA FORMA CORRECTA DE:**

1. **Distinguir** entre usuarios nuevos vs existentes?
2. **Aplicar verificación** solo a usuarios nuevos?
3. **Usar sendEmailVerification** sin bloquear existentes?
4. **Modificar onAuthStateChanged** de manera segura?

---

## 📁 **CONTEXTO TÉCNICO:**

- **Proyecto**: Sistema de inventario empresarial
- **Estado**: 100% funcional (traspasos, colaboradores, multi-almacén)
- **Usuarios**: Ya existen usuarios reales usando el sistema
- **Firebase**: Configurado y funcionando perfectamente

**¿Cuál es tu recomendación técnica específica para implementar esto sin romper el sistema existente?**