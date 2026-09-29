const SupabaseService = require('../js/supabase_client.js');

async function testOnlineAuth() {
  console.log('--- TEST 1: Verificando autenticación online con Supabase para mescudero@gmail.com ---');
  const res = await SupabaseService.autenticarOnline('mescudero@gmail.com', 'Tincho1346');
  console.log('Resultado login mescudero:', res.ok, res.usuario?.nombre, res.usuario?.rol);
  if (!res.ok) throw new Error('Login falló para mescudero@gmail.com');

  console.log('\n--- TEST 2: Verificando rechazo con clave errónea ---');
  const resBad = await SupabaseService.autenticarOnline('mescudero@gmail.com', 'claveErronea');
  console.log('Resultado login inválido (debe ser falso):', resBad.ok, resBad.error);
  if (resBad.ok) throw new Error('Debería haber rechazado la clave incorrecta');

  console.log('\n--- TEST 3: Verificando descarga completa del dataset desde Supabase ---');
  const dataset = await SupabaseService.descargarDatasetCompleto();
  console.log('Dataset descargado:');
  console.log('- Socios:', dataset.vendedores.length);
  console.log('- Clientes:', dataset.clientes.length);
  console.log('- Ventas:', dataset.ventas.length);
  console.log('- Cobranzas:', dataset.cobranzas.length);
  console.log('- Usuarios whitelist:', dataset.usuarios.length);

  const foundMescudero = dataset.usuarios.find(u => u.email === 'mescudero@gmail.com');
  console.log('¿Mescudero presente en dataset de Supabase?', !!foundMescudero);
  if (!foundMescudero) throw new Error('mescudero@gmail.com no está en el dataset');

  console.log('\n>>> ¡TODOS LOS TESTS DE SUPABASE ONLINE PASARON AL 100%! <<<');
}

testOnlineAuth().catch(err => {
  console.error('Error en test:', err);
  process.exit(1);
});
