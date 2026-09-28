# FinanzaFlow Carnes - Sistema Simplificado de Cuentas Corrientes Frigoríficas

Sistema ágil y optimizado para la gestión de cuentas corrientes en la distribución de carne vacuna, despachos de medias reses y cortes, cobranzas e imputación automática FIFO.

---

## 🚀 Acceso Rápido Local (Puerto 8190)

```bash
# Iniciar servidor local
python3 -m http.server 8190
```

Acceder desde el navegador a: **[http://localhost:8190](http://localhost:8190)**

---

## 🥩 Características Implementadas

### 1. Carga Ágil de Ventas de Carne con Chips de Kilajes
- **Chips interactivos**: Se ingresa cada kilaje individual (ej. `88`, `87`, `85`, `85`) y se agregan en formato "chip" sumando automáticamente la cantidad de cortes y el total de kilos. Soporta pegar listas separadas por comas o espacios.
- **Selector de cortes rápidos**: `1/2 RES`, `MOCHO`, `PECHO`, `CHEMO`, `TRINIDAD`, `GOLF`, `ASADO`, `BIFE`, etc.
- **Buscador de Clientes en Tiempo Real**: Desplegable interactivo para escribir y filtrar al instante por razón social o nombre comercial.

### 2. Cobranzas e Imputación Automática FIFO
- **Buscador de Clientes**: Desplegable con saldo deudor en tiempo real y selector de importe total de deuda en 1 clic.
- **Métodos de pago**: Desplegable con opciones (`Transferencia`, `Efectivo`, `Cheque`, `Mixto Efectivo + Transferencia`, `Compensación`).
- **Observaciones opcionales**: Campo libre para notas internas, comprobantes de depósito o recibos manuales.
- **Cancelación automática**: Cancela las ventas más viejas impagas del cliente por orden cronológico.

### 3. Tablas Compactas sin Scroll Horizontal
- Diseño optimizado `.table-compact` con espaciado ajustado (`padding: 4px 6px`) y tipografía reducida (`0.72rem`).
- Formato monetario sin centavos redundantes para enteros (`$ 851.200` en vez de `$ 851.200,00`).
- Todas las columnas de la Cuenta Corriente (12 columnas) entran de forma natural en pantallas de 1024px, 1280px y mayores sin necesidad de scroll horizontal interno.
- Botones de acción limpios sin redundancias de signos `+`.

### 4. Seguridad, Control de Acceso & Whitelist
- **Super Administrador**: `nicolasescudero5@gmail.com` (protegido contra baja o eliminación).
- **Módulo de Whitelist**: Permite dar de alta usuarios autorizados con usuario y contraseña, asignar roles (`admin`, `operador`, `socio`), dar de baja temporalmente o reactivar.
- **Autenticación activa**: Control de acceso con verificación de credenciales y cambio rápido de perfil para pruebas (Demo).

### 5. Nuevo Isotipo Vectorial Outline
- Rediseño del logo e icono de marca con un corte vacuno outline estilizado (vector con hueso central), sustituyendo el anterior símbolo de dinero.

---

## ☁️ Preparación para Producción

### Proyecto Supabase Configurado
- **Nombre del Proyecto**: `finanzaflow-carnes`
- **ID de Referencia**: `shzmwgrwbpscsuxqwzvg`
- **Región**: `sa-east-1` (São Paulo)
- **URL**: `https://shzmwgrwbpscsuxqwzvg.supabase.co`
- **Tablas Creadas**: `usuarios_whitelist`, `socios`, `clientes`, `ventas`, `cobranzas`.
- **Cliente Integrado**: `js/supabase_client.js` listo para sincronización bidireccional.

### Despliegue en Vercel
El repositorio incluye `vercel.json` y `package.json` para despliegue inmediato en Vercel con un solo comando:
```bash
npx vercel --prod
```

### Importación de Cuentas Corrientes desde Excel
El módulo `SupabaseService.procesarFilasExcel()` está preparado para recibir y procesar las solapas y filas del Excel definitivo que suministre el cliente e impactarlo en la base de datos de producción.

---

## 🧪 Verificación de Tests

```bash
# Ejecutar suite completa de tests unitarios y DOM
node scratch/test_all_features.js
node scratch/test_features.js
node scratch/test_dom.js
```
