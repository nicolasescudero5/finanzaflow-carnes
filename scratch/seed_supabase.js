const fs = require('fs');
require('../js/initial_data.js');

const ds = global.INITIAL_DATASET;
const SUPABASE_URL = 'https://shzmwgrwbpscsuxqwzvg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoem13Z3J3YnBzY3N1eHF3enZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MzA4NTcsImV4cCI6MjEwNjIwNjg1N30.yibcG6BT5UFHmKlQTVa472-9LSxwPv3QDc97H93NHi8';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'resolution=merge-duplicates'
};

async function batchPost(table, rows, batchSize = 100) {
  console.log(`Subiendo ${rows.length} registros a ${table}...`);
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(chunk)
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Error en ${table} batch ${i}-${i + chunk.length}: ${res.status} ${errText}`);
    }
  }
  console.log(`✅ ${table} completado (${rows.length} filas).`);
}

async function run() {
  try {
    // 1. Socios
    const sociosRows = (ds.vendedores || []).map(v => ({
      id: v.id,
      nombre: v.nombre,
      color: v.color || '#2563eb',
      activo: v.activo !== false
    }));
    await batchPost('socios', sociosRows, 50);

    // 2. Clientes
    const clientesRows = (ds.clientes || []).map(c => ({
      id: c.id,
      razon_social: c.razonSocial,
      vendedor_id: c.vendedorId,
      contacto_nombre: c.contactoNombre || '',
      telefono: c.telefono || '',
      direccion: c.direccion || '',
      limite_credito: c.limiteCredito || 0,
      plazo_dias: c.plazoDias || 14,
      estado: c.estado || 'activo',
      fecha_alta: c.fechaAlta || null
    }));
    await batchPost('clientes', clientesRows, 100);

    // 3. Ventas
    const ventasRows = (ds.ventas || []).map(v => ({
      id: v.id,
      numero: v.numero,
      cliente_id: v.clienteId,
      vendedor_id: v.vendedorId,
      fecha_emision: v.fechaEmision,
      corte: v.corte,
      pesos: v.pesos || [],
      cantidad_cortes: v.cantidadCortes || 0,
      total_kg: v.totalKg || 0,
      precio_kg: v.precioKg || 0,
      total: v.total || 0,
      monto_cobrado: v.montoCobrado || 0,
      saldo_pendiente: v.saldoPendiente || 0,
      estado: v.estado || 'pendiente',
      observaciones: v.observaciones || '',
      pagos_aplicados: v.pagosAplicados || []
    }));
    await batchPost('ventas', ventasRows, 200);

    // 4. Cobranzas
    const cobranzasRows = (ds.cobranzas || []).map(c => ({
      id: c.id,
      numero: c.numero,
      cliente_id: c.clienteId,
      vendedor_id: c.vendedorId,
      fecha: c.fecha,
      total_cobrado: c.totalCobrado || 0,
      efectivo: c.efectivo || 0,
      transferencia: c.transferencia || 0,
      metodo: c.metodo || 'Efectivo',
      observaciones: c.observaciones || '',
      imputaciones: c.imputaciones || []
    }));
    await batchPost('cobranzas', cobranzasRows, 200);

    console.log('🎉 Migración y carga inicial a Supabase completada con éxito!');
  } catch (err) {
    console.error('❌ Error migrando datos:', err);
    process.exit(1);
  }
}

run();
