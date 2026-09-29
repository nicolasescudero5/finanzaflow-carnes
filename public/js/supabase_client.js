/**
 * FINANZAFLOW ERP - CLIENTE Y SINCRONIZACIÓN SUPABASE (PRODUCCIÓN)
 * Proyecto: finanzaflow-carnes (ID: shzmwgrwbpscsuxqwzvg)
 * Región: sa-east-1 (São Paulo)
 */

(function (window) {
  'use strict';

  const SUPABASE_CONFIG = {
    url: 'https://shzmwgrwbpscsuxqwzvg.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoem13Z3J3YnBzY3N1eHF3enZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MzA4NTcsImV4cCI6MjEwNjIwNjg1N30.yibcG6BT5UFHmKlQTVa472-9LSxwPv3QDc97H93NHi8',
    projectRef: 'shzmwgrwbpscsuxqwzvg'
  };

  let client = null;

  const SupabaseService = {
    config: SUPABASE_CONFIG,
    isOnline: false,

    init() {
      try {
        if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
          client = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
          this.isOnline = true;
          console.log('✅ Supabase client inicializado con éxito:', SUPABASE_CONFIG.url);
        } else {
          console.warn('⚠️ Supabase JS library no está disponible en window, operando en modo local.');
        }
      } catch (err) {
        console.warn('⚠️ Error al conectar con Supabase:', err);
      }
    },

    getClient() {
      if (!client && typeof window.supabase !== 'undefined') {
        this.init();
      }
      return client;
    },

    // Subir dataset local a las tablas de Supabase
    async sincronizarHaciaSupabase() {
      const sb = this.getClient();
      if (!sb) throw new Error('Cliente de Supabase no conectado.');

      const ds = window.DataStore ? window.DataStore.data : null;
      if (!ds) throw new Error('DataStore local no disponible.');

      const results = {
        socios: 0,
        clientes: 0,
        ventas: 0,
        cobranzas: 0,
        usuarios: 0
      };

      // 1. Sincronizar Socios
      if (ds.vendedores && ds.vendedores.length > 0) {
        const rows = ds.vendedores.map(v => ({
          id: v.id,
          nombre: v.nombre,
          color: v.color || '#2563eb',
          activo: v.activo !== false
        }));
        const { error } = await sb.from('socios').upsert(rows, { onConflict: 'id' });
        if (error) console.error('Error upsert socios:', error);
        else results.socios = rows.length;
      }

      // 2. Sincronizar Clientes
      if (ds.clientes && ds.clientes.length > 0) {
        const rows = ds.clientes.map(c => ({
          id: c.id,
          razon_social: c.razonSocial,
          vendedor_id: c.vendedorId,
          contacto_nombre: c.contactoNombre || '',
          telefono: c.telefono || '',
          cbu: c.cbu || '',
          alias: c.alias || '',
          saldo_inicial: c.saldoInicial || 0,
          saldo_actual: c.saldoActual || 0,
          estado: c.estado || 'activo'
        }));
        const { error } = await sb.from('clientes').upsert(rows, { onConflict: 'id' });
        if (error) console.error('Error upsert clientes:', error);
        else results.clientes = rows.length;
      }

      // 3. Sincronizar Whitelist de Usuarios
      if (ds.usuarios && ds.usuarios.length > 0) {
        const rows = ds.usuarios.map(u => ({
          id: u.id,
          email: u.email,
          nombre: u.nombre,
          password_hash: u.password || 'admin123',
          rol: u.rol || 'operador',
          socio_asignado: u.socioAsignado || 'todos',
          estado: u.estado || 'activo',
          ultimo_acceso: u.ultimoAcceso ? new Date(u.ultimoAcceso).toISOString() : null
        }));
        const { error } = await sb.from('usuarios_whitelist').upsert(rows, { onConflict: 'id' });
        if (error) console.error('Error upsert usuarios_whitelist:', error);
        else results.usuarios = rows.length;
      }

      return results;
    },

    // Importador genérico preparado para subir el Excel de Cuentas Corrientes
    async procesarFilasExcel(filasExcel) {
      console.log(`📊 Recibidas ${filasExcel ? filasExcel.length : 0} filas para procesar e impactar en Supabase y local.`);
      // En espera del archivo final del cliente
      return {
        procesadas: filasExcel ? filasExcel.length : 0,
        estado: 'listo_para_importacion'
      };
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
