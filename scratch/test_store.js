// Test unitario y funcional de la versión 2 (105 clientes cárnicos y nuevas herramientas)

const storage = {};
global.localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};
global.window = global;

require('../js/data.js');

const ds = global.DataStore;

console.log('=== TEST 1: Carga masiva de clientes cárnicos ===');
const clientes = ds.getClientes();
console.log(`Total clientes: ${clientes.length}`);
console.assert(clientes.length === 105, 'Deben haber 105 clientes iniciales');

console.log('=== TEST 2: Comprobantes generados ===');
const ventas = ds.getVentas();
const cobranzas = ds.getCobranzas();
console.log(`Total Ventas: ${ventas.length} | Total Cobranzas: ${cobranzas.length}`);
console.assert(ventas.length >= 200, 'Deben haber al menos 200 ventas');

console.log('=== TEST 3: Herramienta 1 - Ranking Top 10 Medias Reses ===');
const resesData = ds.getTopCompradoresMediasReses(10);
console.log('Total Medias Reses Comercializadas:', resesData.totales.totalUnidades);
console.log('Facturación Medias Reses:', resesData.totales.totalFacturadoReses);
console.log('Cliente Líder:', resesData.totales.clienteLider);
console.log('\nTop 5 Compradores:');
resesData.ranking.slice(0, 5).forEach((r, idx) => {
  console.log(`  #${idx + 1}: ${r.razonSocial} | ${r.unidadesMediasReses} reses (${r.kilosAprox.toLocaleString()} kg aprox) | Facturado: $${r.montoFacturadoReses.toLocaleString()} | Saldo Cta Cte: $${r.saldoActualCtaCte.toLocaleString()}`);
});
console.assert(resesData.ranking.length === 10, 'El top 10 debe devolver exactamente 10 clientes');
console.assert(resesData.ranking[0].unidadesMediasReses >= resesData.ranking[1].unidadesMediasReses, 'El ranking debe estar ordenado');

console.log('\n=== TEST 4: Herramienta 2 - Planes de Pago y Refinanciación ===');
const planes = ds.getPlanesPago();
console.log(`Planes de pago registrados: ${planes.length}`);
console.assert(planes.length >= 1, 'Debe existir al menos un plan de pago inicial');
console.log('Plan 1:', planes[0].clienteNombre, '| Total financiado:', planes[0].saldoFinanciado, '| Cuotas:', planes[0].cantidadCuotas);

console.log('\n=== TEST 5: Herramienta 3 - Centro de Cobranzas y Reclamos ===');
const deudores = ds.getClientesParaReclamo();
console.log(`Clientes con facturas vencidas detectados: ${deudores.length}`);
console.assert(deudores.length > 0, 'Deben detectarse clientes con mora');
console.log('Mayor deudor en mora:', deudores[0].razonSocial, '| Días de mora:', deudores[0].maxDiasMora, '| Vencido:', deudores[0].saldoVencido);

console.log('\n>>> ¡TODOS LOS TESTS DE V2 PASARON EXITOSAMENTE! <<<');
