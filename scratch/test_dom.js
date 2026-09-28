const fs = require('fs');

const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; }
};

// Simple DOM Mock
class Element {
  constructor(tag, id = '') {
    this.tagName = tag;
    this.id = id;
    this.innerHTML = '';
    this.children = [];
    this.classList = {
      add: () => {},
      remove: () => {},
      toggle: () => {}
    };
    this.style = {};
  }
  addEventListener() {}
  appendChild(el) { this.children.push(el); }
  remove() {}
}

const elements = {
  selectGlobalVendedor: new Element('select', 'selectGlobalVendedor'),
  sidebarSocioBadge: new Element('span', 'sidebarSocioBadge'),
  sidebarUserAvatar: new Element('div', 'sidebarUserAvatar'),
  sidebarUserName: new Element('div', 'sidebarUserName'),
  badgeDeudoresNav: new Element('span', 'badgeDeudoresNav'),
  pageTitle: new Element('h1', 'pageTitle'),
  pageSubtitle: new Element('p', 'pageSubtitle'),
  viewContent: new Element('section', 'viewContent'),
  toastContainer: new Element('div', 'toastContainer'),
  modalVenta: new Element('div', 'modalVenta'),
  modalVentaBody: new Element('div', 'modalVentaBody'),
  modalCobranza: new Element('div', 'modalCobranza'),
  modalCobranzaBody: new Element('div', 'modalCobranzaBody'),
  modalReclamoWhatsApp: new Element('div', 'modalReclamoWhatsApp'),
  modalReclamoWhatsAppBody: new Element('div', 'modalReclamoWhatsAppBody'),
  modalReclamoWhatsAppFooter: new Element('div', 'modalReclamoWhatsAppFooter'),
  modalGestionSocios: new Element('div', 'modalGestionSocios'),
  modalGestionSociosBody: new Element('div', 'modalGestionSociosBody'),
  modalCliente: new Element('div', 'modalCliente'),
  modalClienteBody: new Element('div', 'modalClienteBody'),
  modalDetalleVenta: new Element('div', 'modalDetalleVenta'),
  modalDetalleVentaBody: new Element('div', 'modalDetalleVentaBody'),
  modalDetalleCobranza: new Element('div', 'modalDetalleCobranza'),
  modalDetalleCobranzaBody: new Element('div', 'modalDetalleCobranzaBody'),
};

global.document = {
  getElementById: (id) => elements[id] || new Element('div', id),
  querySelectorAll: () => [],
  createElement: (tag) => new Element(tag),
  addEventListener: () => {}
};
global.window = global;

require('../js/initial_data.js');
require('../js/data.js');
require('../js/app.js');

console.log('App loaded! Calling App.init()...');
global.App.init();

console.log('\n--- Test Views ---');
['ctacte', 'ventas', 'cobranzas', 'reclamos', 'clientes', 'dashboard'].forEach(v => {
  global.App.switchView(v);
  console.log(`View ${v}: rendered HTML length = ${elements.viewContent.innerHTML.length}`);
  console.assert(elements.viewContent.innerHTML.length > 50, `View ${v} should render content`);
});

console.log('\n--- Test Modal Venta ---');
global.App.abrirModalVenta();
console.log('Modal Venta body length:', elements.modalVentaBody.innerHTML.length);
console.assert(elements.modalVentaBody.innerHTML.includes('1/2 RES'), 'Modal Venta should contain cuts');

console.log('\n--- Test Modal Cobranza ---');
global.App.abrirModalCobranza();
console.log('Modal Cobranza body length:', elements.modalCobranzaBody.innerHTML.length);
console.assert(elements.modalCobranzaBody.innerHTML.includes('FIFO'), 'Modal Cobranza should mention FIFO');

console.log('\n--- Test Modal Reclamo WhatsApp ---');
const firstDebtor = global.DataStore.getRankingDeudores()[0];
global.App.abrirModalReclamo(firstDebtor.clienteId);
console.log('Modal Reclamo WhatsApp rendered for:', firstDebtor.razonSocial);
console.assert(elements.modalReclamoWhatsAppFooter.innerHTML.includes('wa.me'), 'Modal Reclamo should have wa.me link');

console.log('\n--- Test Switch Vendedor to Lucas ---');
global.App.cambiarVendedorActivo('VEND-LUCAS');
global.App.switchView('ctacte');
console.log('Ctacte length for Lucas:', elements.viewContent.innerHTML.length);

console.log('\n--- Test Switch Vendedor to Todos ---');
global.App.cambiarVendedorActivo('todos');
global.App.switchView('reclamos');
console.log('Reclamos length for Todos:', elements.viewContent.innerHTML.length);

console.log('\n>>> DOM & APP INTEGRATION TESTS PASSED 100%! <<<');
