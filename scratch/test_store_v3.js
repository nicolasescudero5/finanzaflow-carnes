const storage = {};
global.localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};
global.window = global;

require('../js/initial_data.js');
require('../js/data.js');

const ds = global.DataStore;
ds.init();

console.log('=== TEST 1: Initial Dataset Loading ===');
const vendedores = ds.getVendedores();
const clientes = ds.getClientes();
const ventas = ds.getVentas();
const cobranzas = ds.getCobranzas();

console.log(`Vendedores: ${vendedores.length}`);
console.log(`Clientes: ${clientes.length}`);
console.log(`Ventas: ${ventas.length}`);
console.log(`Cobranzas: ${cobranzas.length}`);
console.assert(vendedores.length >= 2, 'Must have at least 2 vendedores (Franco and Lucas)');
console.assert(clientes.length >= 86, 'Must have at least 86 clients');

console.log('\n=== TEST 2: Multi-Vendedor Filtering ===');
const clientesFranco = ds.getClientes({ vendedorId: 'VEND-FRANCO' });
const clientesLucas = ds.getClientes({ vendedorId: 'VEND-LUCAS' });
console.log(`Clientes Franco: ${clientesFranco.length}`);
console.log(`Clientes Lucas: ${clientesLucas.length}`);
console.assert(clientesFranco.length === 86, 'Franco must have 86 clients from Excel');
console.assert(clientesLucas.length === 5, 'Lucas must have 5 clients');

console.log('\n=== TEST 3: Create New Vendedor (Martín) and assign client ===');
const newVend = ds.saveVendedor({ nombre: 'Martín' });
console.log('Created Vendedor:', newVend);
console.assert(newVend.id && newVend.nombre === 'Martín', 'New vendedor should be saved');

const newCli = ds.saveCliente({
  razonSocial: 'Carnes Don Martín',
  vendedorId: newVend.id,
  telefono: '+54 9 11 9999-8888'
});
console.log('Created Client for Martín:', newCli.razonSocial, 'Vendedor:', newCli.vendedorId);
const clientesMartin = ds.getClientes({ vendedorId: newVend.id });
console.assert(clientesMartin.length === 1, 'Martín should have 1 client');

console.log('\n=== TEST 4: New Meat Sale with Cuts and Individual Weights ===');
const sale1 = ds.saveVenta({
  clienteId: newCli.id,
  corte: '1/2 RES',
  pesos: [88.5, 89.0, 87.5], // 3 cuts
  precioKg: 7000
});
console.log('Sale 1:', {
  corte: sale1.corte,
  cantCortes: sale1.cantidadCortes,
  totalKg: sale1.totalKg,
  precioKg: sale1.precioKg,
  total: sale1.total,
  saldoPendiente: sale1.saldoPendiente
});
console.assert(sale1.cantidadCortes === 3, 'Should have 3 cuts');
console.assert(sale1.totalKg === 265.0, 'Total kg should be 265.0');
console.assert(sale1.total === 265 * 7000, 'Total should be 1,855,000');

// Create second sale
const sale2 = ds.saveVenta({
  clienteId: newCli.id,
  corte: 'MOCHO',
  pesos: [40, 42],
  precioKg: 6200
});
console.log('Sale 2 Total:', sale2.total, 'Saldo Pendiente:', sale2.saldoPendiente);

console.log('\n=== TEST 5: Automatic FIFO Payment Allocation to Oldest Sale ===');
// Register payment of $1,000,000
const pagoRes1 = ds.registrarPago({
  clienteId: newCli.id,
  monto: 1000000,
  metodo: 'Transferencia Bancaria',
  fecha: '2026-09-28'
});

console.log('Payment 1 registered. Imputations made:', pagoRes1.imputaciones);
const updatedSale1 = ds.getVenta(sale1.id);
const updatedSale2 = ds.getVenta(sale2.id);

console.log('Sale 1 status:', updatedSale1.estado, 'Cobrado:', updatedSale1.montoCobrado, 'Pendiente:', updatedSale1.saldoPendiente);
console.log('Sale 2 status:', updatedSale2.estado, 'Cobrado:', updatedSale2.montoCobrado, 'Pendiente:', updatedSale2.saldoPendiente);
console.assert(updatedSale1.montoCobrado === 1000000, 'Sale 1 should have received 1,000,000');
console.assert(updatedSale1.saldoPendiente === 855000, 'Sale 1 pending balance should be 855,000');
console.assert(updatedSale2.saldoPendiente === sale2.total, 'Sale 2 should still be completely pending');
console.assert(updatedSale1.pagosAplicados.length === 1, 'Sale 1 should list 1 applied payment');

// Register second payment of $1,000,000 (exceeds sale 1 remainder of 855,000, spills over to sale 2!)
const pagoRes2 = ds.registrarPago({
  clienteId: newCli.id,
  monto: 1000000,
  metodo: 'Efectivo',
  fecha: '2026-09-28'
});
console.log('Payment 2 registered. Imputations made:', pagoRes2.imputaciones);
const updatedSale1_b = ds.getVenta(sale1.id);
const updatedSale2_b = ds.getVenta(sale2.id);

console.log('Sale 1 status after payment 2:', updatedSale1_b.estado, 'Pendiente:', updatedSale1_b.saldoPendiente);
console.log('Sale 2 status after payment 2:', updatedSale2_b.estado, 'Cobrado:', updatedSale2_b.montoCobrado, 'Pendiente:', updatedSale2_b.saldoPendiente);
console.assert(updatedSale1_b.estado === 'cobrado', 'Sale 1 should be completely paid');
console.assert(updatedSale1_b.saldoPendiente === 0, 'Sale 1 pending should be 0');
console.assert(updatedSale2_b.montoCobrado === (1000000 - 855000), 'Sale 2 should have received remainder 145,000');

console.log('\n=== TEST 6: Cuenta Corriente (Extracto Libro Mayor) ===');
const ctaCte = ds.getExtractoCtaCte(newCli.id);
console.log(`Total movements: ${ctaCte.movimientos.length}`);
ctaCte.movimientos.forEach((m, idx) => {
  console.log(`  Row ${idx+1}: [${m.fecha}] ${m.tipo} | ${m.corte} | Debe: $${m.debe.toLocaleString()} | Haber: $${m.haber.toLocaleString()} | Saldo Acumulado: $${m.saldoAcumulado.toLocaleString()}`);
});
console.log('Totales Cta Cte:', ctaCte.totales);
console.assert(ctaCte.totales.saldoActual === (sale1.total + sale2.total - 2000000), 'Final balance must match');

console.log('\n=== TEST 7: Ranking de Deudores & WhatsApp Message Generator ===');
const ranking = ds.getRankingDeudores();
console.log(`Total debtors: ${ranking.length}`);
console.log('Top 3 Debtors:');
ranking.slice(0, 3).forEach(r => {
  console.log(`  #${r.rank}: ${r.razonSocial} (${r.vendedorNombre}) - Deuda: $${r.saldoActual.toLocaleString()}`);
});

const msgAmable = ds.getMensajeReclamo(ranking[0].clienteId, 'amable');
const msgOperativo = ds.getMensajeReclamo(ranking[0].clienteId, 'operativo');
console.log('\nSample WhatsApp Message (Operativo):');
console.log(msgOperativo);

console.log('\n>>> ALL UNIT & INTEGRATION TESTS PASSED 100%! <<<');
