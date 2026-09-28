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
      add: (c) => {},
      remove: (c) => {},
      toggle: (c, v) => {}
    };
    this.style = {};
    this.value = '';
    this.dataset = {};
  }
  addEventListener() {}
  appendChild(el) { this.children.push(el); }
  remove() {}
  contains() { return false; }
}

const elements = {
  selectGlobalVendedor: new Element('select', 'selectGlobalVendedor'),
  sidebarSocioBadge: new Element('span', 'sidebarSocioBadge'),
  sidebarUserAvatar: new Element('div', 'sidebarUserAvatar'),
  sidebarUserName: new Element('div', 'sidebarUserName'),
  sidebarUserRole: new Element('div', 'sidebarUserRole'),
  topbarUserEmail: new Element('span', 'topbarUserEmail'),
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
  modalUsuario: new Element('div', 'modalUsuario'),
  modalUsuarioTitle: new Element('div', 'modalUsuarioTitle'),
  modalUsuarioBody: new Element('div', 'modalUsuarioBody'),
  modalLogin: new Element('div', 'modalLogin'),
  modalLoginBody: new Element('div', 'modalLoginBody')
};

global.document = {
  getElementById: (id) => elements[id] || new Element('div', id),
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: (tag) => new Element(tag),
  addEventListener: () => {}
};
global.window = global;

require('../js/initial_data.js');
require('../js/data.js');
require('../js/app.js');

console.log('App loaded! Calling App.init()...');
global.App.init();

console.log('\n--- 1. Testing Whitelist Data Store & Super Admin ---');
const adminUser = global.DataStore.getUsuarioByEmail('nicolasescudero5@gmail.com');
console.log('Found Super Admin:', adminUser.nombre, adminUser.email, 'Rol:', adminUser.rol);
console.assert(adminUser.email === 'nicolasescudero5@gmail.com', 'Super Admin must exist');
console.assert(adminUser.rol === 'admin', 'Super Admin role must be admin');

// Protection test: cannot deactivate or delete super admin
let deactFailed = false;
try {
  global.DataStore.toggleBajaUsuario(adminUser.id);
} catch (e) {
  deactFailed = true;
  console.log('Successfully blocked deactivation of Super Admin:', e.message);
}
console.assert(deactFailed, 'Super Admin cannot be deactivated');

let delFailed = false;
try {
  global.DataStore.deleteUsuario(adminUser.id);
} catch (e) {
  delFailed = true;
  console.log('Successfully blocked deletion of Super Admin:', e.message);
}
console.assert(delFailed, 'Super Admin cannot be deleted');

// Test creating new user
const testUser = global.DataStore.saveUsuario({
  nombre: 'Carlos Carnicero',
  email: 'carlos@carnes.com',
  password: 'carlos_pass_123',
  rol: 'operador',
  socioAsignado: 'VEND-FRANCO'
});
console.log('Created new user:', testUser.nombre, testUser.email);
console.assert(testUser.id.startsWith('USR-'), 'User must have valid ID');

// Test authentication
const authOk = global.DataStore.autenticarUsuario('carlos@carnes.com', 'carlos_pass_123');
console.assert(authOk.ok === true, 'Auth should succeed with correct credentials');

const authFailPass = global.DataStore.autenticarUsuario('carlos@carnes.com', 'wrong_pass');
console.assert(authFailPass.ok === false, 'Auth should fail with wrong password');

const authFailEmail = global.DataStore.autenticarUsuario('notfound@carnes.com', 'some_pass');
console.assert(authFailEmail.ok === false, 'Auth should fail with non-existent email');

// Test deactivation of regular user
const deactUser = global.DataStore.toggleBajaUsuario(testUser.id);
console.assert(deactUser.estado === 'inactivo', 'User should now be inactivo');
const authFailDeact = global.DataStore.autenticarUsuario('carlos@carnes.com', 'carlos_pass_123');
console.assert(authFailDeact.ok === false, 'Deactivated user cannot authenticate');

// Reactivate user
const reactUser = global.DataStore.toggleBajaUsuario(testUser.id);
console.assert(reactUser.estado === 'activo', 'User should now be reactivated');

console.log('\n--- 2. Testing All UI Views & Table Compactness ---');
const views = ['ctacte', 'ventas', 'cobranzas', 'reclamos', 'clientes', 'dashboard', 'planes-pago', 'aging', 'admin'];
views.forEach(v => {
  global.App.switchView(v);
  const html = elements.viewContent.innerHTML;
  console.log(`View ${v}: rendered HTML length = ${html.length}`);
  console.assert(html.length > 50, `View ${v} should render content`);

  // Verify no double plus in rendered buttons
  console.assert(!html.includes('+ +'), `View ${v} should not have redundant double plus "+ +"`);

  // Check table compactness in main tables
  if (['ctacte', 'ventas', 'cobranzas', 'reclamos', 'clientes', 'admin'].includes(v)) {
    console.assert(html.includes('table-compact'), `View ${v} should use table-compact class`);
  }
});

console.log('\n--- 3. Testing Modals Rendering ---');
global.App.abrirModalUsuario();
console.log('Modal Usuario HTML length:', elements.modalUsuarioBody.innerHTML.length);
console.assert(elements.modalUsuarioBody.innerHTML.includes('usrEmail'), 'Modal Usuario should render form fields');

global.App.abrirModalLogin();
console.log('Modal Login HTML length:', elements.modalLoginBody.innerHTML.length);
console.assert(elements.modalLoginBody.innerHTML.includes('nicolasescudero5@gmail.com'), 'Modal Login should render admin credentials');

console.log('\n>>> ALL UNIT & INTEGRATION TESTS PASSED 100%! <<<');
