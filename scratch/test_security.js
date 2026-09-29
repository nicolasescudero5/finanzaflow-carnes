const fs = require('fs');
const assert = require('assert');

console.log('=== VERIFICACIÓN DE REMEDIACIONES DE SEGURIDAD (TRAIL OF BITS) ===\n');

// 1. Verificación en index.html de SRI y versión fija
console.log('--- TEST 1: Subresource Integrity (SRI) y Versión Fija en index.html ---');
const indexHtml = fs.readFileSync('index.html', 'utf8');
assert.ok(
  indexHtml.includes('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2'),
  'index.html debe fijar la versión exacta de supabase-js (2.117.2)'
);
assert.ok(
  indexHtml.includes('integrity="sha384-WgXwGL6fUsYJWNaKJgVbrJKGRQwc1vieh2oy4kw9nXqpNDz3tdSsqEYUgeHD/NuF"'),
  'index.html debe contener el atributo integrity con el hash SHA-384 válido'
);
assert.ok(
  indexHtml.includes('crossorigin="anonymous"'),
  'index.html debe incluir crossorigin="anonymous"'
);
console.log('✅ TEST 1 PASADO: Supabase JS fijado con SRI e integridad criptográfica.');

// 2. Verificación de eliminación de autologin vía URL en js/app.js
console.log('\n--- TEST 2: Ausencia de Backdoor de Autologin por Parámetro URL ---');
const appJs = fs.readFileSync('js/app.js', 'utf8');
assert.ok(
  !appJs.includes('autologin') && !appJs.includes('?autologin=admin'),
  'js/app.js no debe contener código de autologin vía URL'
);
console.log('✅ TEST 2 PASADO: Backdoor de URL autologin eliminado por completo.');

// 3. Verificación de eliminación de contraseñas de bypass en js/data.js y js/supabase_client.js
console.log('\n--- TEST 3: Ausencia de Fallbacks Hardcodeados de Contraseña ---');
const dataJs = fs.readFileSync('js/data.js', 'utf8');
const supabaseJs = fs.readFileSync('js/supabase_client.js', 'utf8');

assert.ok(
  !dataJs.includes("password === 'admin123' || password === 'admin'"),
  'js/data.js no debe permitir bypass admin123 o admin'
);
assert.ok(
  !supabaseJs.includes("password === 'admin123' || password === 'admin'"),
  'js/supabase_client.js no debe permitir bypass admin123 o admin'
);
console.log('✅ TEST 3 PASADO: Bypasses y fallbacks condicionales eliminados.');

// 4. Verificación de autenticación y protección de sesión contra inyección en localStorage
console.log('\n--- TEST 4: Blindaje de Sesión y Autenticación en DataStore ---');
const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; }
};
global.window = global;

require('../js/initial_data.js');
require('../js/data.js');

global.DataStore.init();

// Intento con contraseña errónea "admin" para el admin
const resWrong = global.DataStore.autenticarUsuario('nicolasescudero5@gmail.com', 'admin');
assert.strictEqual(resWrong.ok, false, 'Contraseña "admin" debe ser rechazada');
assert.ok(resWrong.error.includes('Contraseña incorrecta'), 'Debe informar contraseña incorrecta');

// Intento con contraseña correcta "admin123"
const resCorrect = global.DataStore.autenticarUsuario('nicolasescudero5@gmail.com', 'admin123');
assert.strictEqual(resCorrect.ok, true, 'Credencial válida debe ser aceptada');
assert.strictEqual(resCorrect.usuario.password, undefined, 'Objeto de usuario devuelto no debe exponer password');

// Intento de manipulación de localStorage con usuario falso
global.localStorage.setItem('finanzaflow_auth_user', JSON.stringify({
  id: 'USR-HACK',
  email: 'hacker@malicioso.com',
  rol: 'admin',
  nombre: 'Atacante'
}));

const sesionFalsa = global.DataStore.getSesionActiva();
assert.strictEqual(sesionFalsa, null, 'Sesión con usuario no autorizado en whitelist debe ser nula');
assert.strictEqual(global.localStorage.getItem('finanzaflow_auth_user'), null, 'LocalStorage debe ser purgado');

// Intento de elevación de privilegios: usuario operador intenta promoverse a admin en localStorage
global.localStorage.setItem('finanzaflow_auth_user', JSON.stringify({
  id: 'USR-FRANCO',
  email: 'franco@finanzaflow.com',
  rol: 'admin', // Intenta inyectar admin cuando su rol real es socio
  nombre: 'Franco'
}));

const sesionTampered = global.DataStore.getSesionActiva();
assert.ok(sesionTampered !== null, 'Usuario legítimo debe ser reconocido');
assert.strictEqual(sesionTampered.rol, 'socio', 'El rol DEBE provenir de la whitelist autorizada, ignorando el "admin" inyectado');
assert.strictEqual(sesionTampered.password, undefined, 'La sesión no debe contener password');

console.log('✅ TEST 4 PASADO: Sesión blindada contra inyección de rol y usuarios falsos.');

console.log('\n>>> ¡TODAS LAS REMEDIACIONES DE SEGURIDAD FUERON VERIFICADAS CON ÉXITO! <<<');
