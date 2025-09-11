# 🧪 INSTRUCCIONES PARA PRUEBA CON USUARIOS NUEVOS

## 🚨 **PROBLEMA IDENTIFICADO:**
El stock NO llega al **usuario viejo** (jaime.pivet@gmail.com). Puede tener estructura de datos diferente.

---

## 👥 **CREAR USUARIOS DE PRUEBA NUEVOS:**

### **Usuario A (Remitente):**
- **Email**: `test1@inventario.com`
- **Password**: `123456`
- **Nombre**: `Usuario Test Uno`

### **Usuario B (Destinatario):**
- **Email**: `test2@inventario.com`
- **Password**: `123456`
- **Nombre**: `Usuario Test Dos`

---

## 🔄 **FLUJO DE PRUEBA COMPLETO:**

### **PASO 1: Configurar Usuario A**
1. **Crear cuenta** con `test1@inventario.com`
2. **Crear producto**: SKU `TEST-001`, Nombre `Producto Prueba`, Cantidad `50`
3. **Buscar colaborador**: `test2@inventario.com`
4. **Enviar solicitud** de colaboración

### **PASO 2: Configurar Usuario B**
1. **Crear cuenta** con `test2@inventario.com`
2. **Aceptar solicitud** de colaboración de Usuario A
3. **Verificar**: Debe aparecer en "Colaboradores Confirmados"

### **PASO 3: Hacer Traspaso**
1. **Como Usuario A**: Movimientos → Traspaso Externo
2. **Producto**: TEST-001
3. **Cantidad**: 10
4. **Destino**: test2@inventario.com → Almacén Principal
5. **Razón**: "Prueba con usuarios nuevos"

### **PASO 4: Aprobar Traspaso**
1. **Como Usuario B**: Notificaciones → Ver Traspasos
2. **Clic "Aprobar"** en solicitud de Usuario A
3. **Verificar consola**: Debe aparecer 🔥 "BOTÓN APROBAR CLICKEADO"

### **PASO 5: Verificar Resultado**
1. **Usuario A**: Stock debe ser 40 (50-10)
2. **Usuario B**: Stock debe ser 10 (nuevo producto o sumado)
3. **PDF**: Debe descargarse automáticamente

---

## 🎯 **SI FUNCIONA CON USUARIOS NUEVOS:**

Confirma que el problema era la **estructura de datos del usuario viejo**.

## 🎯 **SI NO FUNCIONA CON USUARIOS NUEVOS:**

Hay un problema en el código que necesito arreglar.

---

## 📝 **REPORTA:**

Después de hacer la prueba con usuarios nuevos, dime:
1. **¿Aparecen los logs** 🔥 en la consola?
2. **¿Se actualiza el stock** en Usuario B?
3. **¿Se descarga el PDF**?

**¡Esta prueba nos dirá exactamente dónde está el problema!** 🔍