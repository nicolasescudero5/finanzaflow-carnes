/**
 * FINANZAFLOW ERP - CLIENTE Y SINCRONIZACIÓN SUPABASE (PRODUCCIÓN ONLINE)
 * Proyecto: finanzaflow-carnes (ID: shzmwgrwbpscsuxqwzvg)
 * Región: sa-east-1 (São Paulo)
 * 100% Online: Persistencia en tiempo real, autenticación contra Postgres y suscripción Realtime.
 */

(function (window) {
  'use strict';

  const SUPABASE_CONFIG = {
    url: 'https://shzmwgrwbpscsuxqwzvg.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoem13Z3J3YnBzY3N1eHF3enZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MzA4NTcsImV4cCI6MjEwNjIwNjg1N30.yibcG6BT5UFHmKlQTVa472-9LSxwPv3QDc97H93NHi8',
    projectRef: 'shzmwgrwbpscsuxqwzvg'
  };

  let client = null;
  let realtimeChannel = null;

  // Helpers de transformación entre el esquema DB (snake_case) y el modelo Local (camelCase)
  const Mappers = {
    toLocalSocio(row) {
      if (!row) return null;
      return {
        id: row.id,
        nombre: row.nombre,
        color: row.color || '#2563eb',
        activo: row.activo !== false
      };
    },
    toDbSocio(s) {
      return {
        id: s.id,
        nombre: s.nombre,
        color: s.color || '#2563eb',
        activo: s.activo !== false
      };
    },

    toLocalCliente(row) {
      if (!row) return null;
      return {
        id: row.id,
        razonSocial: row.razon_social,
        vendedorId: row.vendedor_id,
        contactoNombre: row.contacto_nombre || '',
        telefono: row.telefono || '',
        direccion: row.direccion || '',
        limiteCredito: Number(row.limite_credito || 0),
        plazoDias: Number(row.plazo_dias || 14),
        estado: row.estado || 'activo',
        fechaAlta: row.fecha_alta || (row.creado_el ? row.creado_el.slice(0, 10) : new Date().toISOString().slice(0, 10)),
        cbu: row.cbu || '',
        alias: row.alias || '',
        saldoInicial: Number(row.saldo_inicial || 0),
        saldoActual: Number(row.saldo_actual || 0)
      };
    },
    toDbCliente(c) {
      return {
        id: c.id,
        razon_social: c.razonSocial,
        vendedor_id: c.vendedorId,
        contacto_nombre: c.contactoNombre || '',
        telefono: c.telefono || '',
        direccion: c.direccion || '',
        limite_credito: Number(c.limiteCredito || 0),
        plazo_dias: Number(c.plazoDias || 14),
        estado: c.estado || 'activo',
        fecha_alta: c.fechaAlta || new Date().toISOString().slice(0, 10),
        cbu: c.cbu || '',
        alias: c.alias || '',
        saldo_inicial: Number(c.saldoInicial || 0),
        saldo_actual: Number(c.saldoActual || 0)
      };
    },

    toLocalVenta(row) {
      if (!row) return null;
      return {
        id: row.id,
        numero: row.numero,
        clienteId: row.cliente_id,
        vendedorId: row.vendedor_id,
        fechaEmision: row.fecha_emision,
        corte: row.corte,
        pesos: Array.isArray(row.pesos) ? row.pesos : [],
        cantidadCortes: Number(row.cantidad_cortes || 0),
        totalKg: Number(row.total_kg || 0),
        precioKg: Number(row.precio_kg || 0),
        total: Number(row.total || 0),
        montoCobrado: Number(row.monto_cobrado || 0),
        saldoPendiente: Number(row.saldo_pendiente || 0),
        estado: row.estado || 'pendiente',
        observaciones: row.observaciones || '',
        pagosAplicados: Array.isArray(row.pagos_aplicados) ? row.pagos_aplicados : []
      };
    },
    toDbVenta(v) {
      return {
        id: v.id,
        numero: v.numero,
        cliente_id: v.clienteId,
        vendedor_id: v.vendedorId,
        fecha_emision: v.fechaEmision,
        corte: v.corte,
        pesos: v.pesos || [],
        cantidad_cortes: Number(v.cantidadCortes || 0),
        total_kg: Number(v.totalKg || 0),
        precio_kg: Number(v.precioKg || 0),
        total: Number(v.total || 0),
        monto_cobrado: Number(v.montoCobrado || 0),
        saldo_pendiente: Number(v.saldoPendiente || 0),
        estado: v.estado || 'pendiente',
        observaciones: v.observaciones || '',
        pagos_aplicados: v.pagosAplicados || []
      };
    },

    toLocalCobranza(row) {
      if (!row) return null;
      return {
        id: row.id,
        numero: row.numero,
        clienteId: row.cliente_id,
        vendedorId: row.vendedor_id,
        fecha: row.fecha,
        totalCobrado: Number(row.total_cobrado || 0),
        efectivo: Number(row.efectivo || 0),
        transferencia: Number(row.transferencia || 0),
        metodo: row.metodo || 'Efectivo',
        observaciones: row.observaciones || '',
        imputaciones: Array.isArray(row.imputaciones) ? row.imputaciones : []
      };
    },
    toDbCobranza(c) {
      return {
        id: c.id,
        numero: c.numero,
        cliente_id: c.clienteId,
        vendedor_id: c.vendedorId,
        fecha: c.fecha,
        total_cobrado: Number(c.totalCobrado || 0),
        efectivo: Number(c.efectivo || 0),
        transferencia: Number(c.transferencia || 0),
        metodo: c.metodo || 'Efectivo',
        observaciones: c.observaciones || '',
        imputaciones: c.imputaciones || []
      };
    },

    toLocalUsuario(row) {
      if (!row) return null;
      return {
        id: row.id,
        email: (row.email || '').toLowerCase().trim(),
        password: row.password,
        nombre: row.nombre,
        rol: row.rol || 'operador',
        socioAsignado: row.socio_asignado || 'todos',
        estado: row.estado || 'activo',
        ultimoAcceso: row.ultimo_acceso ? row.ultimo_acceso.replace('T', ' ').slice(0, 16) : null
      };
    },
    toDbUsuario(u) {
      let isoDate = null;
      if (u.ultimoAcceso && typeof u.ultimoAcceso === 'string' && u.ultimoAcceso !== 'Sin ingresos') {
        const d = new Date(u.ultimoAcceso.replace(' ', 'T'));
        if (!isNaN(d.getTime())) {
          isoDate = d.toISOString();
        }
      }
      return {
        id: u.id,
        email: (u.email || '').toLowerCase().trim(),
        password: u.password,
        nombre: u.nombre,
        rol: u.rol || 'operador',
        socio_asignado: u.socioAsignado || 'todos',
        estado: u.estado || 'activo',
        ultimo_acceso: isoDate
      };
    }
  };

  const SupabaseService = {
    config: SUPABASE_CONFIG,
    isOnline: false,
    syncInProgress: false,
    lastSyncTime: null,

    async restFetch(endpoint, options = {}) {
      if (typeof fetch === 'undefined') return null;
      const url = `${SUPABASE_CONFIG.url}/rest/v1/${endpoint}`;
      const headers = {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      };
      return fetch(url, { ...options, headers });
    },

    init() {
      try {
        if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
          client = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
          this.isOnline = true;
          console.log('✅ [Supabase] Cliente inicializado con SDK:', SUPABASE_CONFIG.url);
          this.iniciarRealtime();
        } else if (typeof fetch !== 'undefined') {
          this.isOnline = true;
          console.log('✅ [Supabase] Cliente inicializado vía REST API directa:', SUPABASE_CONFIG.url);
        } else {
          console.warn('⚠️ [Supabase] No se encontró SDK ni fetch disponible.');
        }
      } catch (err) {
        console.warn('⚠️ [Supabase] Error al inicializar cliente:', err);
      }
    },

    getClient() {
      if (!client && typeof window !== 'undefined' && window.supabase) {
        this.init();
      }
      return client;
    },

    // =============================================================
    // CONSULTA CON PAGINACIÓN COMPLETA (Supera el límite de 1000)
    // =============================================================
    async fetchAllRows(table, select = '*') {
      const sb = this.getClient();
      let allRows = [];
      let from = 0;
      const pageSize = 1000;

      if (sb) {
        while (true) {
          const { data, error } = await sb
            .from(table)
            .select(select)
            .range(from, from + pageSize - 1);

          if (error) throw error;
          if (!data || data.length === 0) break;

          allRows = allRows.concat(data);
          if (data.length < pageSize) break;
          from += pageSize;
        }
        return allRows;
      }

      // Fallback nativo con PostgREST REST API
      while (true) {
        const res = await this.restFetch(`${table}?select=${encodeURIComponent(select)}`, {
          headers: {
            Range: `${from}-${from + pageSize - 1}`,
            'Range-Unit': 'items'
          }
        });
        if (!res || !res.ok) {
          const msg = res ? await res.text() : 'No fetch response';
          throw new Error(`REST Error ${table}: ${msg}`);
        }
        const data = await res.json();
        if (!data || data.length === 0) break;

        allRows = allRows.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return allRows;
    },

    // =============================================================
    // CARGAR TODO EL DATASET DESDE SUPABASE A MEMORIA
    // =============================================================
    async descargarDatasetCompleto() {
      const sb = this.getClient();
      if (!sb && typeof fetch === 'undefined') {
        console.warn('⚠️ [Supabase] Modo offline: No se pudo conectar a la base de datos.');
        return null;
      }

      this.syncInProgress = true;
      try {
        console.log('🔄 [Supabase] Sincronizando dataset en tiempo real desde la nube...');
        const [sociosRes, clientesRes, ventasRes, cobranzasRes, usuariosRes] = await Promise.all([
          this.fetchAllRows('socios'),
          this.fetchAllRows('clientes'),
          this.fetchAllRows('ventas'),
          this.fetchAllRows('cobranzas'),
          this.fetchAllRows('usuarios_publicos')
        ]);

        const dataset = {
          vendedores: (sociosRes || []).map(Mappers.toLocalSocio),
          clientes: (clientesRes || []).map(Mappers.toLocalCliente),
          ventas: (ventasRes || []).map(Mappers.toLocalVenta),
          cobranzas: (cobranzasRes || []).map(Mappers.toLocalCobranza),
          usuarios: (usuariosRes || []).map(Mappers.toLocalUsuario),
          planesPago: []
        };

        this.lastSyncTime = new Date();
        this.isOnline = true;
        console.log(`✅ [Supabase] Sincronización exitosa: ${dataset.vendedores.length} socios, ${dataset.clientes.length} clientes, ${dataset.ventas.length} ventas, ${dataset.cobranzas.length} cobranzas, ${dataset.usuarios.length} usuarios.`);
        return dataset;
      } catch (err) {
        console.error('❌ [Supabase] Error al descargar dataset:', err);
        return null;
      } finally {
        this.syncInProgress = false;
      }
    },

    // =============================================================
    // AUTENTICACIÓN EN VIVO CONTRA SUPABASE
    // =============================================================
    async autenticarOnline(email, password) {
      const sb = this.getClient();
      const cleanEmail = (email || '').toLowerCase().trim();

      if (!cleanEmail || !password) {
        return { ok: false, error: 'Por favor ingresa tu correo y contraseña.' };
      }

      // 1. Intentar autenticación atómica y segura server-side en PostgreSQL vía RPC (SECURITY DEFINER)
      if (sb) {
        try {
          const { data, error } = await sb.rpc('autenticar_usuario', {
            p_email: cleanEmail,
            p_password: password
          });
          if (!error && data) {
            if (data.ok && data.usuario) {
              return { ok: true, usuario: data.usuario };
            }
            return { ok: false, error: data.error || 'Credenciales inválidas.' };
          }
        } catch (err) {
          console.warn('⚠️ [Supabase] RPC autenticar_usuario no disponible, usando fallback:', err);
        }
      }

      // 2. Fallback REST para RPC autenticar_usuario
      if (typeof fetch !== 'undefined') {
        try {
          const res = await this.restFetch('rpc/autenticar_usuario', {
            method: 'POST',
            body: JSON.stringify({ p_email: cleanEmail, p_password: password })
          });
          if (res && res.ok) {
            const data = await res.json();
            if (data && data.ok && data.usuario) {
              return { ok: true, usuario: data.usuario };
            }
            if (data && data.error) {
              return { ok: false, error: data.error };
            }
          }
        } catch (err) {
          console.warn('⚠️ [Supabase] Fallback REST RPC no disponible:', err);
        }
      }

      // 3. Fallback directo a usuarios_whitelist con validación estricta (sin bypasses)
      let userData = null;
      if (sb) {
        try {
          const { data, error } = await sb
            .from('usuarios_whitelist')
            .select('*')
            .ilike('email', cleanEmail)
            .maybeSingle();

          if (!error && data) userData = data;
        } catch (err) {
          console.warn('Error al consultar via SDK en Supabase:', err);
        }
      }

      if (!userData && typeof fetch !== 'undefined') {
        try {
          const res = await this.restFetch(`usuarios_whitelist?email=ilike.${encodeURIComponent(cleanEmail)}&select=*`);
          if (res && res.ok) {
            const arr = await res.json();
            if (arr && arr.length > 0) userData = arr[0];
          }
        } catch (err) {
          console.warn('Error al consultar via REST en Supabase:', err);
        }
      }

      if (userData) {
        const u = Mappers.toLocalUsuario(userData);
        if (u.estado === 'inactivo') {
          return { ok: false, error: 'Este usuario ha sido dado de baja por el Administrador.' };
        }

        // Comprobación estricta de contraseña (sin bypass ni fallback)
        const passOk = (u.password === password);
        if (!passOk) {
          return { ok: false, error: 'Contraseña incorrecta. Verifica tus datos de acceso.' };
        }

        // Actualizar último acceso en la base de datos
        const nowIso = new Date().toISOString();
        if (sb) {
          sb.from('usuarios_whitelist').update({ ultimo_acceso: nowIso }).eq('id', u.id).then();
        } else {
          this.restFetch(`usuarios_whitelist?id=eq.${encodeURIComponent(u.id)}`, {
            method: 'PATCH',
            body: JSON.stringify({ ultimo_acceso: nowIso })
          }).then();
        }
        u.ultimoAcceso = nowIso.replace('T', ' ').slice(0, 16);

        // Omitir contraseña antes de retornar usuario al cliente
        delete u.password;
        return { ok: true, usuario: u };
      }

      // Fallback a DataStore local si Supabase no responde
      if (window.DataStore && window.DataStore.autenticarUsuario) {
        return window.DataStore.autenticarUsuario(cleanEmail, password);
      }
      return { ok: false, error: 'El correo no se encuentra registrado en el sistema.' };
    },

    // =============================================================
    // OPERACIONES CRUD EN TIEMPO REAL
    // =============================================================

    // --- VENTAS ---
    async guardarVenta(venta) {
      const sb = this.getClient();
      try {
        const row = Mappers.toDbVenta(venta);
        if (sb) {
          const { error } = await sb.from('ventas').upsert(row, { onConflict: 'id' });
          if (error) console.error('Error al guardar venta en Supabase:', error);
        } else if (typeof fetch !== 'undefined') {
          await this.restFetch('ventas', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify(row)
          });
        }
      } catch (e) {
        console.error('Error en guardarVenta Supabase:', e);
      }
    },

    async guardarVentasBatch(ventas) {
      const sb = this.getClient();
      if (!ventas || ventas.length === 0) return;
      try {
        const rows = ventas.map(Mappers.toDbVenta);
        if (sb) {
          const { error } = await sb.from('ventas').upsert(rows, { onConflict: 'id' });
          if (error) console.error('Error al guardar lote de ventas en Supabase:', error);
        } else if (typeof fetch !== 'undefined') {
          await this.restFetch('ventas', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify(rows)
          });
        }
      } catch (e) {
        console.error('Error en guardarVentasBatch Supabase:', e);
      }
    },

    async eliminarVenta(id) {
      const sb = this.getClient();
      try {
        if (sb) {
          const { error } = await sb.from('ventas').delete().eq('id', id);
          if (error) console.error('Error al eliminar venta en Supabase:', error);
        } else if (typeof fetch !== 'undefined') {
          await this.restFetch(`ventas?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
        }
      } catch (e) {
        console.error('Error en eliminarVenta Supabase:', e);
      }
    },

    // --- COBRANZAS ---
    async guardarCobranza(cobranza, ventasActualizadas = []) {
      const sb = this.getClient();
      try {
        const row = Mappers.toDbCobranza(cobranza);
        if (sb) {
          const { error: errCob } = await sb.from('cobranzas').upsert(row, { onConflict: 'id' });
          if (errCob) console.error('Error al guardar cobranza en Supabase:', errCob);
        } else if (typeof fetch !== 'undefined') {
          await this.restFetch('cobranzas', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify(row)
          });
        }

        if (ventasActualizadas && ventasActualizadas.length > 0) {
          await this.guardarVentasBatch(ventasActualizadas);
        }
      } catch (e) {
        console.error('Error en guardarCobranza Supabase:', e);
      }
    },

    async eliminarCobranza(id, ventasRestauradas = []) {
      const sb = this.getClient();
      try {
        if (sb) {
          const { error: errDel } = await sb.from('cobranzas').delete().eq('id', id);
          if (errDel) console.error('Error al eliminar cobranza en Supabase:', errDel);
        } else if (typeof fetch !== 'undefined') {
          await this.restFetch(`cobranzas?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
        }

        if (ventasRestauradas && ventasRestauradas.length > 0) {
          await this.guardarVentasBatch(ventasRestauradas);
        }
      } catch (e) {
        console.error('Error en eliminarCobranza Supabase:', e);
      }
    },

    // --- CLIENTES ---
    async guardarCliente(cliente) {
      const sb = this.getClient();
      try {
        const row = Mappers.toDbCliente(cliente);
        if (sb) {
          const { error } = await sb.from('clientes').upsert(row, { onConflict: 'id' });
          if (error) console.error('Error al guardar cliente en Supabase:', error);
        } else if (typeof fetch !== 'undefined') {
          await this.restFetch('clientes', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify(row)
          });
        }
      } catch (e) {
        console.error('Error en guardarCliente Supabase:', e);
      }
    },

    async eliminarCliente(id) {
      const sb = this.getClient();
      try {
        if (sb) {
          const { error } = await sb.from('clientes').delete().eq('id', id);
          if (error) console.error('Error al eliminar cliente en Supabase:', error);
        } else if (typeof fetch !== 'undefined') {
          await this.restFetch(`clientes?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
        }
      } catch (e) {
        console.error('Error en eliminarCliente Supabase:', e);
      }
    },

    // --- SOCIOS / VENDEDORES ---
    async guardarSocio(socio) {
      const sb = this.getClient();
      try {
        const row = Mappers.toDbSocio(socio);
        if (sb) {
          const { error } = await sb.from('socios').upsert(row, { onConflict: 'id' });
          if (error) console.error('Error al guardar socio en Supabase:', error);
        } else if (typeof fetch !== 'undefined') {
          await this.restFetch('socios', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify(row)
          });
        }
      } catch (e) {
        console.error('Error en guardarSocio Supabase:', e);
      }
    },

    async eliminarSocio(id) {
      const sb = this.getClient();
      try {
        if (sb) {
          const { error } = await sb.from('socios').delete().eq('id', id);
          if (error) console.error('Error al eliminar socio en Supabase:', error);
        } else if (typeof fetch !== 'undefined') {
          await this.restFetch(`socios?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
        }
      } catch (e) {
        console.error('Error en eliminarSocio Supabase:', e);
      }
    },

    // --- USUARIOS DE WHITELIST ---
    async guardarUsuario(usuario) {
      const sb = this.getClient();
      try {
        const row = Mappers.toDbUsuario(usuario);
        if (sb) {
          const { error } = await sb.from('usuarios_whitelist').upsert(row, { onConflict: 'id' });
          if (error) {
            console.error('Error al guardar usuario en Supabase:', error);
            throw new Error(error.message || 'Error en Supabase al guardar usuario');
          }
          console.log('✅ Usuario impactado en Supabase con éxito:', row.email);
        } else if (typeof fetch !== 'undefined') {
          const res = await this.restFetch('usuarios_whitelist', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify(row)
          });
          if (!res || !res.ok) {
            const errText = res ? await res.text() : 'Sin respuesta';
            throw new Error('Error REST Supabase: ' + errText);
          }
          console.log('✅ Usuario impactado en Supabase vía REST:', row.email);
        }
      } catch (e) {
        console.error('Error en guardarUsuario Supabase:', e);
        throw e;
      }
    },

    async cambiarEstadoUsuario(id, estado) {
      const sb = this.getClient();
      try {
        if (sb) {
          const { error } = await sb.from('usuarios_whitelist').update({ estado }).eq('id', id);
          if (error) console.error('Error al cambiar estado de usuario en Supabase:', error);
        } else if (typeof fetch !== 'undefined') {
          await this.restFetch(`usuarios_whitelist?id=eq.${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify({ estado })
          });
        }
      } catch (e) {
        console.error('Error en cambiarEstadoUsuario Supabase:', e);
      }
    },

    async cambiarPasswordUsuario(id, newPassword) {
      const sb = this.getClient();
      try {
        if (sb) {
          const { error } = await sb.from('usuarios_whitelist').update({ password: newPassword }).eq('id', id);
          if (error) console.error('Error al cambiar password de usuario en Supabase:', error);
        } else if (typeof fetch !== 'undefined') {
          await this.restFetch(`usuarios_whitelist?id=eq.${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify({ password: newPassword })
          });
        }
      } catch (e) {
        console.error('Error en cambiarPasswordUsuario Supabase:', e);
      }
    },

    async eliminarUsuario(id) {
      const sb = this.getClient();
      try {
        if (sb) {
          const { error } = await sb.from('usuarios_whitelist').delete().eq('id', id);
          if (error) console.error('Error al eliminar usuario en Supabase:', error);
        } else if (typeof fetch !== 'undefined') {
          await this.restFetch(`usuarios_whitelist?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
        }
      } catch (e) {
        console.error('Error en eliminarUsuario Supabase:', e);
      }
    },

    // =============================================================
    // CANAL DE TIEMPO REAL (SUPABASE REALTIME)
    // =============================================================
    iniciarRealtime() {
      const sb = this.getClient();
      if (!sb || realtimeChannel) return;

      try {
        realtimeChannel = sb
          .channel('public-db-changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios_whitelist' }, payload => {
            console.log('⚡ [Realtime] Cambio detectado en usuarios_whitelist:', payload.eventType);
            if (window.DataStore && window.DataStore.handleRealtimeUsuario) {
              window.DataStore.handleRealtimeUsuario(payload);
            }
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, payload => {
            console.log('⚡ [Realtime] Cambio detectado en ventas:', payload.eventType);
            window.dispatchEvent(new CustomEvent('supabase:change', { detail: { table: 'ventas', payload } }));
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'cobranzas' }, payload => {
            console.log('⚡ [Realtime] Cambio detectado en cobranzas:', payload.eventType);
            window.dispatchEvent(new CustomEvent('supabase:change', { detail: { table: 'cobranzas', payload } }));
          })
          .subscribe();

        console.log('📡 [Supabase] Canal de tiempo real suscrito y activo.');
      } catch (e) {
        console.warn('⚠️ No se pudo inicializar Realtime:', e);
      }
    }
  };

  // Exponer globalmente
  if (typeof window !== 'undefined') {
    window.SupabaseService = SupabaseService;
    SupabaseService.init();
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupabaseService;
  }

})(typeof window !== 'undefined' ? window : global);
