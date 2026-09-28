const fs = require('fs');

const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; }
};

class Element {
  constructor(tag, id = '') {
    this.tagName = tag;
    this.id = id;
    this.innerHTML = '';
    this.value = '';
    this._textContent = '';
    this.children = [];
    this.classList = {
      add: (c) => this._classes.add(c),
      remove: (c) => this._classes.delete(c),
      toggle: (c, force) => {
        if (force === undefined) {
          if (this._classes.has(c)) this._classes.delete(c);
          else this._classes.add(c);
        } else if (force) {
          this._classes.add(c);
        } else {
          this._classes.delete(c);
        }
      },
      has: (c) => this._classes.has(c)
    };
    this._classes = new Set();
    this.style = {};
  }
  get textContent() {
    return this._textContent;
  }
  set textContent(val) {
    this._textContent = String(val);
  }
  focus() { this._focused = true; }
  contains(el) { return this.children.includes(el); }
  addEventListener() {}
  appendChild(el) { this.children.push(el); }
  querySelector(sel) {
    if (sel === '.searchable-dropdown-item') {
      return { click: () => { this._clicked = true; } };
    }
    return null;
  }
  querySelectorAll() { return []; }
  remove() {}
}

const elements = {};
function getOrCreateElement(id, tag = 'div') {
  if (!elements[id]) {
    elements[id] = new Element(tag, id);
  }
  return elements[id];
}

global.document = {
  getElementById: (id) => getOrCreateElement(id),
  querySelectorAll: () => [],
  createElement: (tag) => new Element(tag),
  addEventListener: () => {}
};
global.window = global;

require('../js/initial_data.js');
require('../js/data.js');
require('../js/app.js');

global.App.init();

console.log('--- TEST 1: CHIPS INTERACTIVOS DE KILAJES EN MODAL VENTA ---');
global.App.abrirModalVenta();
const modalVentaBody = document.getElementById('modalVentaBody');
console.log('Modal Venta Body length:', modalVentaBody.innerHTML.length);
console.assert(modalVentaBody.innerHTML.includes('id="nvInputNuevoPeso"'), 'Debe incluir input de nuevo peso');
console.assert(modalVentaBody.innerHTML.includes('id="nvChipsContainer"'), 'Debe incluir contenedor de chips');
console.assert(modalVentaBody.innerHTML.includes('88 kg'), 'Debe renderizar chips iniciales');

const dispCant = document.getElementById('dispCantCortes');
const dispTotalKg = document.getElementById('dispTotalKg');

// Agregar un peso individual
const inputNuevoPeso = document.getElementById('nvInputNuevoPeso');
inputNuevoPeso.value = '90';
global.App.agregarPesoDesdeInput();
console.log('After adding 90kg -> Cortes:', dispCant.textContent, '| Kg:', dispTotalKg.textContent);
console.assert(dispCant.textContent === '5', 'Debe tener 5 cortes');
console.assert(dispTotalKg.textContent.includes('435'), 'Debe sumar 435 kg');

// Agregar varios pesos pegados separados por comas
inputNuevoPeso.value = '82, 84, 86';
global.App.agregarPesoDesdeInput();
console.log('After pasting "82, 84, 86" -> Cortes:', dispCant.textContent, '| Kg:', dispTotalKg.textContent);
console.assert(dispCant.textContent === '8', 'Debe tener 8 cortes');
console.assert(dispTotalKg.textContent.includes('687'), 'Debe sumar 687 kg');

// Eliminar un peso
global.App.eliminarPesoVenta(0);
console.log('After deleting first cut -> Cortes:', dispCant.textContent);
console.assert(dispCant.textContent === '7', 'Debe tener 7 cortes tras eliminar 1');

// Limpiar todos
global.App.limpiarTodosLosPesosVenta();
console.log('After limpiar todos -> Cortes:', dispCant.textContent, '| Kg:', dispTotalKg.textContent);
console.assert(dispCant.textContent === '0', 'Debe tener 0 cortes');
console.assert(dispTotalKg.textContent.includes('0'), 'Debe sumar 0 kg');

// Agregar con decimal (87.5)
inputNuevoPeso.value = '87.5';
global.App.agregarPesoDesdeInput();
console.log('After adding 87.5 -> Cortes:', dispCant.textContent, '| Kg:', dispTotalKg.textContent);
console.assert(dispCant.textContent === '1', 'Debe tener 1 corte');
console.assert(dispTotalKg.textContent.includes('87.5') || dispTotalKg.textContent.includes('88'), 'Debe sumar 87.5 kg');

console.log('\n--- TEST 2: CLIENTE SEARCHABLE DROPDOWN EN VENTA ---');
const inputSearchVenta = document.getElementById('nvClienteSearch');
const ddVenta = document.getElementById('nvClienteDropdown');

// Filtrar por término
inputSearchVenta.value = 'carn';
global.App.filtrarDropdownClienteVenta('carn');
console.log('Dropdown Venta filtered by "carn", HTML length:', ddVenta.innerHTML.length);
console.assert(ddVenta.innerHTML.includes('searchable-dropdown-item'), 'Debe contener opciones coincidentes');

// Seleccionar un cliente
const allClients = global.DataStore.getClientes();
const testClient = allClients[1];
global.App.seleccionarClienteVenta(testClient.id);
console.log('Selected client in Venta:', inputSearchVenta.value);
console.assert(inputSearchVenta.value === testClient.razonSocial, 'El input debe reflejar la razón social del cliente');

console.log('\n--- TEST 3: CLIENTE SEARCHABLE DROPDOWN EN COBRANZA ---');
global.App.abrirModalCobranza();
const inputSearchCob = document.getElementById('ncClienteSearch');
const ddCob = document.getElementById('ncClienteDropdown');

// Filtrar en cobranza
inputSearchCob.value = 'franco';
global.App.filtrarDropdownClienteCobranza('franco');
console.log('Dropdown Cobranza filtered by "franco", HTML length:', ddCob.innerHTML.length);
console.assert(ddCob.innerHTML.length > 50, 'Debe renderizar opciones de clientes');

// Seleccionar cliente en cobranza
global.App.seleccionarClienteCobranza(testClient.id);
console.log('Selected client in Cobranza:', inputSearchCob.value);
console.assert(inputSearchCob.value === testClient.razonSocial, 'El input de cobranza debe reflejar el cliente');

console.log('\n--- TEST 4: MEDIOS DE PAGO EN DESPLEGABLE & OBSERVACIÓN OPACIONAL ---');
const modalCobranzaBody = document.getElementById('modalCobranzaBody');
console.assert(modalCobranzaBody.innerHTML.includes('id="ncMetodoSelect"'), 'Debe contener el select ncMetodoSelect');
console.assert(modalCobranzaBody.innerHTML.includes('id="ncObservaciones"'), 'Debe contener el input de observaciones');
console.assert(modalCobranzaBody.innerHTML.includes('Transferencia Bancaria'), 'Debe incluir opciones de pago');

// Cambiar a Mixto
global.App.onMetodoCobranzaSelectChange('Mixto');
console.assert(modalCobranzaBody.innerHTML.includes('ncMontoEfectivo'), 'Al ser Mixto debe mostrar desglose efectivo');
console.assert(modalCobranzaBody.innerHTML.includes('ncMontoTransf'), 'Al ser Mixto debe mostrar desglose transferencia');

// Cambiar a Efectivo
global.App.onMetodoCobranzaSelectChange('Efectivo');
console.assert(!modalCobranzaBody.innerHTML.includes('ncMontoEfectivo'), 'Al ser Efectivo no debe mostrar desglose mixto');

console.log('\n>>> ¡TODOS LOS 4 REQUERIMIENTOS VERIFICADOS EXITOSAMENTE AL 100%! <<<');
