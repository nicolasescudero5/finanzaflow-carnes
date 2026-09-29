// scratch/test_scoping.js
// Automated verification for partner scoping, "consolidado" permissions, and UI cleanup.

const fs = require('fs');
const path = require('path');

console.log('=== TEST DE ALCANCE POR SOCIO, PERMISOS Y LIMPIEZA UI ===\n');

// 1. VERIFICACIÓN DEL HTML (index.html)
console.log('--- TEST 1: Limpieza del Topbar y Ubicación de Usuario en Sidebar ---');
const htmlContent = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf-8');

// Check 1.1: Live badge removed
if (htmlContent.includes('id="topbarLiveBadge"')) {
  console.error('❌ ERROR: #topbarLiveBadge todavía existe en index.html');
  process.exit(1);
} else {
  console.log('✅ 1.1: #topbarLiveBadge (Online · Supabase) eliminado del topbar.');
}

// Check 1.2: Duplicated Venta/Pago buttons in topbar removed
if (htmlContent.includes('id="btnTopbarVenta"') || htmlContent.includes('id="btnTopbarPago"')) {
  console.error('❌ ERROR: Botones + Venta o + Pago todavía existen en el topbar');
  process.exit(1);
} else {
  console.log('✅ 1.2: Botones duplicados + Venta y + Pago eliminados del topbar.');
}

// Check 1.3: Topbar Salir and user pill removed
if (htmlContent.includes('id="topbarUserPill"')) {
  console.error('❌ ERROR: #topbarUserPill aún existe en index.html');
  process.exit(1);
}
// Ensure no "Salir" button in topbar
const topbarMatch = htmlContent.match(/<header class="topbar">([\s\S]*?)<\/header>/);
if (topbarMatch && topbarMatch[1].includes('App.cerrarSesion')) {
  console.error('❌ ERROR: Botón Salir en topbar aún existe');
  process.exit(1);
} else {
  console.log('✅ 1.3: User pill y botón Salir eliminados del topbar.');
}

// Check 1.4: Sidebar user profile elements exist in sidebar footer
const requiredSidebarElements = [
  'id="sidebarUserSnippet"',
  'id="sidebarUserName"',
  'id="sidebarUserRole"',
  'id="sidebarUserTag"',
  'id="sidebarUserAvatar"'
];
for (const el of requiredSidebarElements) {
  if (!htmlContent.includes(el)) {
    console.error(`❌ ERROR: Falta elemento en sidebar: ${el}`);
    process.exit(1);
  }
}
console.log('✅ 1.4: Perfil de usuario completo abajo a la izquierda en el sidebar footer.');

// 2. VERIFICACIÓN DE DATASTORE Y SCOPING POR SOCIO
console.log('\n--- TEST 2: DataStore Scoping con Restricción de Socio vs Consolidado ---');

// Mock browser environment for DataStore
const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
  clear: () => { for (const k in storage) delete storage[k]; }
};

global.window = {};

// Load initial data and data.js
const initialDataJs = fs.readFileSync(path.join(__dirname, '../js/initial_data.js'), 'utf-8');
eval(initialDataJs);

const dataJs = fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf-8');
eval(dataJs);

const ds = window.DataStore;
ds.init();

// Setup mock test users in DataStore whitelist
ds.saveUsuario({
  id: 'USR-LUCAS',
  email: 'lucas@carnes.com',
  nombre: 'Lucas',
  rol: 'socio',
  socioAsignado: 'VEND-LUCAS',
  puedeConsolidar: false,
  estado: 'activo'
});

ds.saveUsuario({
  id: 'USR-FRANCO',
  email: 'franco@carnes.com',
  nombre: 'Franco',
  rol: 'socio',
  socioAsignado: 'VEND-FRANCO',
  puedeConsolidar: false,
  estado: 'activo'
});

ds.saveUsuario({
  id: 'USR-ADMIN',
  email: 'admin@carnes.com',
  nombre: 'Admin General',
  rol: 'admin',
  socioAsignado: 'todos',
  puedeConsolidar: true,
  estado: 'activo'
});

// Case A: User Lucas (restricted to VEND-LUCAS, cannot consolidate)
ds.setUsuarioActual({
  id: 'USR-LUCAS',
  email: 'lucas@carnes.com',
  nombre: 'Lucas',
  rol: 'socio',
  socioAsignado: 'VEND-LUCAS',
  puedeConsolidar: false
});

const restrictedSocio = ds.getSocioRestringido();
if (restrictedSocio !== 'VEND-LUCAS') {
  console.error(`❌ ERROR: getSocioRestringido() debería ser VEND-LUCAS, obtuvo: ${restrictedSocio}`);
  process.exit(1);
}
console.log('✅ 2.1: Lucas tiene socio restringido = VEND-LUCAS.');

const vendedoresLucas = ds.getVendedores();
if (vendedoresLucas.length !== 1 || vendedoresLucas[0].id !== 'VEND-LUCAS') {
  console.error(`❌ ERROR: ds.getVendedores() para Lucas devolvió:`, vendedoresLucas);
  process.exit(1);
}
console.log('✅ 2.2: Para Lucas sólo se lista su socio (no Franco ni Todos).');

const clientesLucas = ds.getClientes();
const tieneClienteFranco = clientesLucas.some(c => c.vendedorId === 'VEND-FRANCO');
if (tieneClienteFranco || clientesLucas.length === 0) {
  console.error('❌ ERROR: Lucas no tiene clientes o puede ver clientes de Franco!', clientesLucas.length);
  process.exit(1);
}
console.log(`✅ 2.3: Clientes filtrados para Lucas (${clientesLucas.length} clientes). Cero clientes de Franco visibles.`);

const ventasLucas = ds.getVentas();
const tieneVentaFranco = ventasLucas.some(v => v.vendedorId === 'VEND-FRANCO');
if (tieneVentaFranco || ventasLucas.length === 0) {
  console.error('❌ ERROR: Lucas no tiene ventas o puede ver ventas de Franco!', ventasLucas.length);
  process.exit(1);
}
console.log(`✅ 2.4: Ventas filtradas para Lucas (${ventasLucas.length} ventas). Cero ventas de Franco visibles.`);

const cobranzasLucas = ds.getCobranzas();
const tieneCobranzaFranco = cobranzasLucas.some(c => c.vendedorId === 'VEND-FRANCO');
if (tieneCobranzaFranco || cobranzasLucas.length === 0) {
  console.error('❌ ERROR: Lucas no tiene cobranzas o puede ver cobranzas de Franco!', cobranzasLucas.length);
  process.exit(1);
}
console.log(`✅ 2.5: Cobranzas filtradas para Lucas (${cobranzasLucas.length} cobranzas). Cero cobranzas de Franco visibles.`);

// Intento de Lucas de consultar directamente un cliente de Franco por ID
const primerClienteFranco = (ds.data.clientes || []).find(c => c.vendedorId === 'VEND-FRANCO');
if (primerClienteFranco) {
  const accesoDirectoFranco = ds.getCliente(primerClienteFranco.id);
  if (accesoDirectoFranco !== null) {
    console.error('❌ ERROR: IDOR! Lucas pudo acceder a getCliente() de un cliente de Franco');
    process.exit(1);
  }
  console.log('✅ 2.6: Control de acceso horizontal (IDOR) verificado: getCliente() devuelve null ante clientes de otro socio.');
}

// Case B: User Lucas with puedeConsolidar enabled (Admin grants consolidado)
ds.setUsuarioActual({
  id: 'USR-ADMIN',
  email: 'admin@carnes.com',
  nombre: 'Admin General',
  rol: 'admin',
  socioAsignado: 'todos',
  puedeConsolidar: true
});

ds.saveUsuario({
  id: 'USR-LUCAS',
  email: 'lucas@carnes.com',
  nombre: 'Lucas',
  rol: 'socio',
  socioAsignado: 'VEND-LUCAS',
  puedeConsolidar: true, // Concedido permiso consolidado
  estado: 'activo'
});

// Lucas logs back in
ds.setUsuarioActual({
  id: 'USR-LUCAS',
  email: 'lucas@carnes.com',
  nombre: 'Lucas',
  rol: 'socio',
  socioAsignado: 'VEND-LUCAS',
  puedeConsolidar: true
});

const restrictedLucasConsolidado = ds.getSocioRestringido();
if (restrictedLucasConsolidado !== null) {
  console.error(`❌ ERROR: Con puedeConsolidar=true el socio restringido debería ser null, obtuvo: ${restrictedLucasConsolidado}`);
  process.exit(1);
}
const vendedoresLucasConsolidado = ds.getVendedores();
if (vendedoresLucasConsolidado.length <= 1) {
  console.error('❌ ERROR: Con consolidado debería ver todos los socios.');
  process.exit(1);
}
const clientesLucasConsolidado = ds.getClientes();
console.log(`✅ 2.7: Lucas con opción Consolidado ve todos los ${vendedoresLucasConsolidado.length} socios y ${clientesLucasConsolidado.length} clientes en total.`);

// Case C: Admin user
ds.setUsuarioActual({
  id: 'USR-ADMIN',
  email: 'admin@carnes.com',
  nombre: 'Admin General',
  rol: 'admin',
  socioAsignado: 'todos',
  puedeConsolidar: true
});

const restrictedAdmin = ds.getSocioRestringido();
if (restrictedAdmin !== null) {
  console.error(`❌ ERROR: Admin no debería tener restricción, obtuvo: ${restrictedAdmin}`);
  process.exit(1);
}
console.log('✅ 2.8: Admin General tiene acceso consolidado a todos los datos sin restricción.');

console.log('\n>>> ¡TODAS LAS PRUEBAS DE ALCANCE Y CONSOLIDADO PASARON AL 100%! <<<\n');
