const fs = require('fs');

function getRelativeDate(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

const nombresCarnicerias = [
  "Carnicería La Estancia", "Carnicería El Chañar", "Carnes Don Hugo", "La Boutique de la Carne",
  "Carnicería El Progreso", "Carnes San Cayetano", "Carnicería Los Primos", "Frigorífico & Carnes El Trébol",
  "Carnicería La Nueva Querencia", "Carnes & Cortes Pampeanos", "Carnicería Don Julio", "Carnicería El Buen Corte",
  "Carnicería La Tradición", "Carnes Premium Baires", "Carnicería El Ombú", "Carnicería San Martín",
  "Carnicería El Amanecer", "Carnes del Valle", "Carnicería Central", "Carnicería La Familia",
  "Carnes Argentinas Express", "Carnicería Los Amigos", "Carnicería San Jorge", "Carnes Criollas del Sur",
  "Carnicería Don Pedro", "Carnicería Belgrano", "Carnicería Urquiza", "Carnicería Palermo Soho",
  "Carnes Las Lilas", "Carnicería El Rincón Gaucho", "Carnes La Porteña", "Carnicería Mitre",
  "Carnicería Santa Fe", "Carnicería La Chaqueña", "Carnes Seleccionadas Norte", "Carnicería El Litoral",
  "Carnicería Don Bautista", "Carnicería Los Vascos", "Carnicería La Pampa", "Carnes & Asador El Rodeo",
  "Carnicería Granja del Carmen", "Carnicería Quilmes Centro", "Carnicería Lanús Oeste", "Carnes Banfield",
  "Carnicería Morón Sur", "Carnicería San Justo", "Carnes Mataderos", "Carnicería Ramos Mejía",
  "Carnicería Tigre Delta", "Carnicería Vicente López"
];

const nombresSupermercados = [
  "Supermercado La Tranquera", "Autoservicio El Sol", "Supermercados El Trebol", "Cadena Los Hermanos",
  "Supermercado Alianza", "Supermercados El Triunfo", "Autoservicio San José", "Supermercado Mayorista Sur",
  "Supermercados Delta", "Autoservicio Pampa Mía", "Supermercado Oroño", "Supermercados San Antonio",
  "Autoservicio Avenida", "Supermercado Costa Azul", "Supermercados Horizonte", "Autoservicio 25 de Mayo",
  "Supermercado San Lorenzo", "Supermercados El Puente", "Autoservicio La Plaza", "Supermercado Belgrano Market",
  "Supermercados La Ribera", "Autoservicio Centenario", "Supermercado El Parque", "Supermercados San Luis",
  "Autoservicio Don Juan"
];

const nombresDistribuidores = [
  "Distribuidora Cárnica Baires S.A.", "Abastecedora Sur Carnes S.R.L.", "Distribuidora Ganadera Andina",
  "Comercializadora de Carnes del Plata", "Frigorífico Ciclo II San Telmo", "Distribuidora Mayorista Pampeana",
  "Logística Cárnica Metropolitana S.A.", "Abastecedora Cárnica San Juan", "Distribuidora de Carnes Litoral",
  "Frigocarne Mayorista S.R.L.", "Distribuidora Avellaneda Carnes", "Abastecedora Cárnica Mar del Plata",
  "Distribuidora Ganadera del Centro", "Consorcio Frigorífico Rioplatense", "Distribuidora Oeste Carnes"
];

const nombresGastronomicos = [
  "Parrilla El Asador Criollo", "Restaurante Don Julio del Valle", "Parrilla La Querencia",
  "Estancia Steakhouse", "Parrilla Los Amigos del Parque", "Restaurante Fogón Gaucho",
  "Parrilla La Rueda", "Asador Campestre Las Cañitas", "Parrilla El Ombú Dorado",
  "Restaurante El Bife Criollo", "Parrilla San Isidro", "Asador Tradicional Moreno",
  "Parrilla La Estación", "Restaurante Las Brasas", "Parrilla Puerto Madero Meat"
];

const todosNombres = [
  ...nombresCarnicerias,
  ...nombresSupermercados,
  ...nombresDistribuidores,
  ...nombresGastronomicos
];

const clientes = todosNombres.map((nombre, idx) => {
  const idNum = idx + 1;
  const cuitPrefix = idNum % 3 === 0 ? '30' : (idNum % 2 === 0 ? '33' : '27');
  const cuitMiddle = String(60000000 + idNum * 12345).slice(0, 8);
  const cuit = `${cuitPrefix}-${cuitMiddle}-${idNum % 9}`;
  
  let limite = 3000000;
  let plazo = 14;
  if (nombre.includes('Distribuidora') || nombre.includes('Frigorífico') || nombre.includes('Consorcio')) {
    limite = 18000000 + (idNum % 5) * 2000000;
    plazo = 30;
  } else if (nombre.includes('Supermercado') || nombre.includes('Cadena')) {
    limite = 9000000 + (idNum % 4) * 1500000;
    plazo = 21;
  } else if (nombre.includes('Parrilla') || nombre.includes('Restaurante')) {
    limite = 3500000 + (idNum % 3) * 500000;
    plazo = 7;
  } else {
    limite = 4500000 + (idNum % 6) * 500000;
    plazo = 14;
  }

  const cleanEmail = nombre.toLowerCase().replace(/[^a-z0-9]/g, '') + '@gmail.com';
  const telefono = `+54 9 11 ${4000 + (idNum * 13) % 5000}-${String(1000 + (idNum * 37) % 8999)}`;

  return {
    id: `CLI-${String(idNum).padStart(3, '0')}`,
    razonSocial: nombre,
    cuit,
    condicionIva: idNum % 5 === 0 ? 'Monotributo' : 'Responsable Inscripto',
    email: cleanEmail,
    telefono,
    direccion: `Av. San Martín ${100 + idNum * 25}, Buenos Aires`,
    limiteCredito: limite,
    plazoDias: plazo,
    estado: 'activo'
  };
});

// Tipos de artículos cárnicos
const cortesMediasReses = [
  { desc: "Media Res Novillito Especial (aprox. 120 kg)", precio: 580000 },
  { desc: "Media Res Ternera Premium (aprox. 100 kg)", precio: 540000 },
  { desc: "Media Res Vaca Buena (aprox. 135 kg)", precio: 490000 },
  { desc: "Media Res Vaquillona Liviana (aprox. 95 kg)", precio: 510000 }
];

const otrosCortes = [
  { desc: "Cuarto Delantero c/ Asado y Cogote (x 55 kg)", precio: 220000 },
  { desc: "Cuarto Trasero Pistola con Lomo (x 65 kg)", precio: 320000 },
  { desc: "Lote Achuras y Menudencias (Molleja, Chinchulín, Hígado)", precio: 95000 },
  { desc: "Caja Matambre y Vacío Envasado al Vacío (x 25 kg)", precio: 175000 }
];

const ventas = [];
const cobranzas = [];
let vtaCount = 1;
let cobCount = 1;

// Asignar compras de medias reses para crear un Top 10 claro y realista:
// Top compradores definidos:
// CLI-076: Distribuidora Cárnica Baires S.A.
// CLI-077: Abastecedora Sur Carnes S.R.L.
// CLI-001: Carnicería La Estancia
// CLI-051: Supermercado La Tranquera
// CLI-003: Carnes Don Hugo
// CLI-078: Distribuidora Ganadera Andina
// CLI-055: Supermercado Alianza
// CLI-007: Carnicería Los Primos
// CLI-080: Frigorífico Ciclo II San Telmo
// CLI-002: Carnicería El Chañar
const topBuyerIndexes = [75, 76, 0, 50, 2, 77, 54, 6, 79, 1]; // 0-indexed in clientes array

// Generar compras fuertes para el Top 10
topBuyerIndexes.forEach((idx, rank) => {
  const cli = clientes[idx];
  // Cuanto menor el rank, más compras
  const numCompras = 5 + (10 - rank); // 15 compras para el #1, 6 compras para el #10
  const cantResesPorCompra = 6 + Math.floor((10 - rank) * 1.5); // Entre 6 y 21 medias reses por pedido

  for (let c = 0; c < numCompras; c++) {
    const daysAgo = (c * 6) + (rank * 2) + 2;
    const resTipo = cortesMediasReses[c % cortesMediasReses.length];
    const cantRes = cantResesPorCompra + (c % 3);
    const subtotal = cantRes * resTipo.precio;
    const iva = Math.round(subtotal * 0.105); // Alícuota carnes 10.5%
    const total = subtotal + iva;

    const vtaId = `VTA-${String(vtaCount).padStart(3, '0')}`;
    const vtaNum = `0001-${String(vtaCount).padStart(8, '0')}`;
    vtaCount++;

    ventas.push({
      id: vtaId,
      clienteId: cli.id,
      tipo: 'Factura A',
      numero: vtaNum,
      fechaEmision: getRelativeDate(-daysAgo),
      fechaVencimiento: getRelativeDate(-daysAgo + cli.plazoDias),
      condicionPago: `${cli.plazoDias} días`,
      items: [
        { descripcion: resTipo.desc, cantidad: cantRes, precioUnitario: resTipo.precio, subtotal }
      ],
      subtotal,
      alicuotaIva: 10.5,
      iva,
      total,
      observaciones: `Entrega con Camión Frigorífico térmico Senasa N° 451`
    });

    // Registrar cobranza parcial o total para algunas de las facturas más viejas
    if (daysAgo > cli.plazoDias) {
      const cobId = `COB-${String(cobCount).padStart(3, '0')}`;
      const cobNum = `0001-${String(cobCount).padStart(8, '0')}`;
      cobCount++;

      // Cobro total o parcial del 75%
      const montoCobro = (c % 3 === 0) ? Math.round(total * 0.7) : total;

      cobranzas.push({
        id: cobId,
        clienteId: cli.id,
        numero: cobNum,
        fecha: getRelativeDate(-daysAgo + Math.floor(cli.plazoDias * 0.8)),
        totalCobrado: montoCobro,
        observaciones: `Pago Factura ${vtaNum} medias reses`,
        mediosPago: [
          { tipo: (cobCount % 2 === 0 ? 'Transferencia Bancaria' : 'Cheque Diferido'), banco: 'Banco Galicia', referencia: `TRF-${900000 + cobCount}`, fechaCobro: getRelativeDate(-daysAgo + 5), monto: montoCobro }
        ],
        imputaciones: [
          { ventaId: vtaId, montoImputado: montoCobro }
        ]
      });
    }
  }
});

// Generar compras normales para el resto de los clientes (los otros 95 clientes)
clientes.forEach((cli, idx) => {
  if (topBuyerIndexes.includes(idx)) return; // ya procesados

  // Cada cliente tiene 1 o 2 ventas
  const compras = 1 + (idx % 2);
  for (let k = 0; k < compras; k++) {
    const daysAgo = ((idx * 3 + k * 12) % 70) + 3;
    const compraMediasReses = (idx % 2 === 0);

    let items = [];
    if (compraMediasReses) {
      const res = cortesMediasReses[idx % cortesMediasReses.length];
      const cant = 1 + (idx % 3); // 1 a 3 medias reses
      items.push({ descripcion: res.desc, cantidad: cant, precioUnitario: res.precio, subtotal: cant * res.precio });
    } else {
      const corte = otrosCortes[idx % otrosCortes.length];
      const cant = 2 + (idx % 4);
      items.push({ descripcion: corte.desc, cantidad: cant, precioUnitario: corte.precio, subtotal: cant * corte.precio });
    }

    const subtotal = items.reduce((acc, it) => acc + it.subtotal, 0);
    const iva = Math.round(subtotal * 0.105);
    const total = subtotal + iva;

    const vtaId = `VTA-${String(vtaCount).padStart(3, '0')}`;
    const vtaNum = `0001-${String(vtaCount).padStart(8, '0')}`;
    vtaCount++;

    ventas.push({
      id: vtaId,
      clienteId: cli.id,
      tipo: 'Factura A',
      numero: vtaNum,
      fechaEmision: getRelativeDate(-daysAgo),
      fechaVencimiento: getRelativeDate(-daysAgo + cli.plazoDias),
      condicionPago: `${cli.plazoDias} días`,
      items,
      subtotal,
      alicuotaIva: 10.5,
      iva,
      total,
      observaciones: `Despacho frigorífico estándar`
    });

    // Cobranzas en el 60% de los casos
    if (idx % 3 !== 0 && daysAgo > cli.plazoDias) {
      const cobId = `COB-${String(cobCount).padStart(3, '0')}`;
      const cobNum = `0001-${String(cobCount).padStart(8, '0')}`;
      cobCount++;

      cobranzas.push({
        id: cobId,
        clienteId: cli.id,
        numero: cobNum,
        fecha: getRelativeDate(-daysAgo + cli.plazoDias),
        totalCobrado: total,
        observaciones: `Cancelación Factura ${vtaNum}`,
        mediosPago: [
          { tipo: 'Transferencia Bancaria', banco: 'Banco Santander', referencia: `TRF-${800000 + cobCount}`, fechaCobro: getRelativeDate(-daysAgo + cli.plazoDias), monto: total }
        ],
        imputaciones: [
          { ventaId: vtaId, montoImputado: total }
        ]
      });
    }
  }
});

console.log(`Generación completada:`);
console.log(`- Clientes: ${clientes.length}`);
console.log(`- Ventas: ${ventas.length}`);
console.log(`- Cobranzas: ${cobranzas.length}`);
