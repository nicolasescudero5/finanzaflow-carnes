# Audit Context Dossier: Carnes (FinanzaFlow ERP)
**Auditoría basada en Trail of Bits Skills (`audit-context-building` & `sharp-edges`)**
**Fecha:** 2026-09-28
**Objetivo:** Arquitectura, superficie de ataque, suposiciones críticas y análisis de riesgos.

---

## 1. Resumen del Sistema y Arquitectura

- **Nombre:** Carnes - Sistema Simplificado de Cuenta Corriente Cárnica, Pagos FIFO y Gestión Comercial.
- **Tipo de Aplicación:** SPA (Single Page Application) Vanilla JS / HTML5 / CSS3.
- **Capa de Datos:** Híbrida:
  - LocalStorage / memoria en el navegador (`js/data.js`).
  - Base de datos relacional PostgreSQL remota provista por Supabase (`js/supabase_client.js`).
- **Conectividad:** Cliente directo vía SDK JS (`@supabase/supabase-js@2`) o fallback a REST API (`fetch`).

---

## 2. Superficie de Ataque y Límites de Confianza (Trust Boundaries)

```
┌────────────────────────────────────────────────────────┐
│                      NAVEGADOR                         │
│                                                        │
│  [ index.html ] ───> [ js/app.js ]                     │
│                            │                           │
│                            ▼                           │
│                     [ js/data.js ]                     │
│                       (State/RAM)                      │
│                      ▲           ▲                     │
│                      │           │                     │
│    [ localStorage ] ─┘           ▼                     │
│                          [ supabase_client.js ]        │
└─────────────────────────────────────┬──────────────────┘
                                      │  anon-key (JWT)
                                      ▼
┌────────────────────────────────────────────────────────┐
│                   SUPABASE POSTGRES                    │
│   Tablas: clientes, ventas, cobranzas, socios,         │
│           usuarios_whitelist                           │
└────────────────────────────────────────────────────────┘
```

1. **Límite Cliente - Navegador:** Todo el control de acceso, verificación de roles (`superadmin`, `socio`, `vendedor`) y autenticación de la whitelist se ejecuta en el navegador del usuario en `js/data.js` y `js/app.js`.
2. **Límite Navegador - Supabase:** Las llamadas a la API de Supabase utilizan la anon key pública (`eyJhbGciOiJIUzI1Ni...`). Si Postgres no cuenta con Row Level Security (RLS) estricto por sesión (`auth.uid()`), cualquier usuario con la clave anon puede consultar o modificar las tablas directamente.
3. **Límite de Suministros (Supply Chain):** El SDK de Supabase se carga desde un CDN público (`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`) sin atributos de integridad Subresource Integrity (`integrity="sha384-..."`).

---

## 3. Microanálisis de Funciones Críticas (Trail of Bits Format)

### `autenticarUsuario` en `js/data.js` (L1129-L1163)

- **Propósito:** Validar credenciales de acceso contra la lista local de usuarios autorizados.
- **Entradas & Suposiciones:**
  - `email` (string): Sin sanear. Confianza: Untrusted.
  - `password` (string): Texto plano. Confianza: Untrusted.
  - Suposición: `this.data.usuarios` contiene contraseñas en texto claro o previamente sincronizadas. `nothing found` (no hay hash bcrypt/argon2).
- **Efectos:**
  - Escribe `finanzaflow_auth_user` en `localStorage`.
  - Concede acceso a toda la UI administrativa.
- **Hallazgo Crítico (Backdoor / Bypass de Emergencia):**
  - Líneas 1144-1146:
    ```javascript
    if (u.email.toLowerCase() === 'nicolasescudero5@gmail.com') {
      passOk = (password === u.password || password === 'admin123' || password === 'admin');
    }
    ```
    Existe una contraseña fija alternativa en el código cliente (`admin123` y `admin`) para la cuenta administradora.

### `getSesionActiva` en `js/data.js` (L1165-L1180)

- **Propósito:** Restaurar la sesión al recargar la página.
- **Entradas & Suposiciones:**
  - Lee `localStorage.getItem('finanzaflow_auth_user')`.
  - Suposición: Lo que está en `localStorage` es de confianza. **FALSO**: El usuario puede inyectar cualquier objeto JSON en la consola del navegador con `rol: "superadmin"` y saltarse el login gate.

### `restFetch` y `getClient` en `js/supabase_client.js` (L11-L15, L192-L227)

- **Propósito:** Conexión con Supabase backend.
- **Entradas & Suposiciones:**
  - `SUPABASE_CONFIG.anonKey` (L13): Clave JWT pública válida hasta el año 2036.
  - Supone que el backend Postgres tiene RLS activo para aislar las tablas `usuarios_whitelist`.

---

## 4. Preguntas Abiertas (Open Questions)

1. ¿Las tablas de Postgres en Supabase (`usuarios_whitelist`, `ventas`, `clientes`) tienen políticas RLS activadas o aceptan operaciones anónimas `public`?
2. ¿Se planea migrar la autenticación a Supabase Auth nativo (`supabase.auth.signInWithPassword`) para delegar el hash seguro al servidor?
