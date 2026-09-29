/**
 * FINANZAFLOW ERP - CONTROLADOR Y VISTAS DE INTERFAZ (V3 SIMPLIFICADO)
 * Especializado en Comercio Cárnico, Cuenta Corriente interactiva y Reclamos WhatsApp.
 */

(function () {
  'use strict';

  // Estado global de la aplicación UI
  const state = {
    currentView: 'ctacte', // Default view: Cuenta Corriente
    selectedClienteId: '',
    activeVendedorId: 'todos', // 'todos' | 'VEND-FRANCO' | 'VEND-LUCAS' | ...
    clienteEdicionId: null,
    filters: {
      ventas: { estado: '', search: '', clienteId: '' },
      cobranzas: { search: '', clienteId: '' },
      clientes: { search: '', estado: 'todos', page: 1, pageSize: 25 },
      reclamos: { search: '' },
      admin: { search: '', rol: '', estado: '' }
    },
    // Estado para nueva venta cárnica
    nuevaVenta: {
      clienteId: '',
      fechaEmision: new Date().toISOString().split('T')[0],
      corte: '1/2 RES',
      pesosTexto: '88, 87, 85, 85',
      pesos: [88, 87, 85, 85],
      precioKg: 6900,
      observaciones: ''
    },
    // Estado para nueva cobranza
    nuevaCobranza: {
      clienteId: '',
      fecha: new Date().toISOString().split('T')[0],
      monto: 0,
      metodo: 'Transferencia',
      observaciones: '',
      ventaIdEspecifica: null,
      modoImputacion: 'fifo'
    },
    // Estado para reclamo WhatsApp
    modalReclamo: {
      clienteId: '',
      plantilla: 'operativo'
    }
  };

  // Formato monetario argentino ($ 1.250.000 sin centavos redundantes cuando son enteros)
  function formatMoney(amount) {
    if (isNaN(amount) || amount === null || amount === undefined) amount = 0;
    const hasDecimals = Math.abs(amount % 1) > 0.009;
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2
    }).format(amount).replace('ARS', '$');
  }

  // Formato de fecha (YYYY-MM-DD a DD/MM/YYYY)
  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const parts = String(dateStr).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }

  // Sanitizador HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Toast flotante
  function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div style="font-weight: 600; font-size: 0.88rem;">${message}</div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  // Abrir y cerrar modal
  function abrirModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('active');
  }

  function cerrarModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
  }

  // =============================================================
  // SESIÓN Y GATEWAY DE AUTENTICACIÓN OBLIGATORIA
  // =============================================================
  function verificarSesionYRenderizar() {
    const user = window.DataStore.getSesionActiva();
    const loginGate = document.getElementById('loginGateScreen');
    const appLayout = document.getElementById('appLayout');

    if (!user) {
      if (loginGate) loginGate.style.display = 'flex';
      if (appLayout) appLayout.style.display = 'none';
      return false;
    }

    if (loginGate) loginGate.style.display = 'none';
    if (appLayout) appLayout.style.display = 'flex';
    actualizarInfoUsuarioSesion(user);
    return true;
  }

  function ejecutarLoginGate() {
    const emailInput = document.getElementById('gateInputEmail');
    const passInput = document.getElementById('gateInputPassword');
    const errBox = document.getElementById('loginGateError');
    const btnSubmit = document.getElementById('btnGateLoginSubmit');

    const email = emailInput?.value?.trim() || '';
    const pass = passInput?.value || '';

    if (!email || !pass) {
      if (errBox) {
        errBox.textContent = 'Por favor ingresa tu correo y contraseña.';
        errBox.style.display = 'flex';
      }
      return;
    }

    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = `<span>Verificando credenciales con Supabase...</span>`;
    }

    setTimeout(async () => {
      let res;
      if (window.DataStore && window.DataStore.autenticarUsuarioAsync) {
        res = await window.DataStore.autenticarUsuarioAsync(email, pass);
      } else {
        res = window.DataStore.autenticarUsuario(email, pass);
      }

      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `
          <span>Ingresar al Sistema</span>
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        `;
      }

      if (!res.ok) {
        if (errBox) {
          errBox.textContent = res.error;
          errBox.style.display = 'flex';
        }
        return;
      }

      if (errBox) errBox.style.display = 'none';
      verificarSesionYRenderizar();
      initAppDashboard();
      showToast(`¡Bienvenido/a ${res.usuario.nombre}! Acceso autorizado.`);

      // Sincronizar en segundo plano el dataset completo de producción
      if (window.DataStore && window.DataStore.syncFromSupabase) {
        window.DataStore.syncFromSupabase();
      }
    }, 100);
  }

  function cerrarSesion() {
    window.DataStore.cerrarSesion();
    const loginGate = document.getElementById('loginGateScreen');
    const appLayout = document.getElementById('appLayout');
    const passInput = document.getElementById('gateInputPassword');
    const errBox = document.getElementById('loginGateError');

    if (passInput) passInput.value = '';
    if (errBox) errBox.style.display = 'none';
    if (loginGate) loginGate.style.display = 'flex';
    if (appLayout) appLayout.style.display = 'none';

    showToast('Sesión cerrada con éxito.');
  }

  function togglePasswordVisibility(inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      if (btnEl) btnEl.textContent = 'Ocultar';
    } else {
      input.type = 'password';
      if (btnEl) btnEl.textContent = 'Mostrar';
    }
  }

  // =============================================================
  // INICIALIZACIÓN DE LA APP
  // =============================================================
  function initApp() {
    window.DataStore.init();

    // Event listener para cuando Supabase termine la sincronización de datos
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('datastore:synced', () => {
        console.log('🔄 [FinanzaFlow] Sincronización con Supabase finalizada, refrescando interfaz.');
        actualizarBadgesNav();
        actualizarSelectorVendedoresTopbar();
        if (state.currentView) {
          switchView(state.currentView);
        }
      });
    }

    const autenticado = verificarSesionYRenderizar();
    if (!autenticado) {
      // Si no hay sesión válida, se mantiene en la pantalla de Login Gate
      return;
    }

    initAppDashboard();
  }

  let dashboardInicializado = false;
  function initAppDashboard() {
    const curUser = window.DataStore.getSesionActiva();
    aplicarPermisosUsuarioSesion(curUser);

    if (dashboardInicializado) {
      switchView(state.currentView || 'ctacte');
      return;
    }
    dashboardInicializado = true;

    // Configurar cliente seleccionado por defecto
    const clientes = window.DataStore.getClientes({ vendedorId: state.activeVendedorId });
    if (clientes.length > 0) {
      // Preferir un cliente con saldo deudor o el primero
      const deudor = clientes.find(c => c.saldoActual > 0) || clientes[0];
      state.selectedClienteId = deudor.id;
    }

    switchView(state.currentView || 'ctacte');

    // Soporte para apertura directa vía URL (ej: ?modal=venta, ?modal=cobranza, ?view=ventas)
    try {
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        const urlParams = new URLSearchParams(window.location.search);
        const viewParam = urlParams.get('view');
        const modalParam = urlParams.get('modal');
        const clienteParam = urlParams.get('clienteId');

        if (viewParam) {
          switchView(viewParam);
        }
        if (modalParam === 'venta') {
          abrirModalVenta(clienteParam || '');
          if (urlParams.get('openDropdown') === 'true') {
            setTimeout(() => abrirDropdownClienteVenta(), 80);
          }
        } else if (modalParam === 'cobranza') {
          abrirModalCobranza(clienteParam || '');
          if (urlParams.get('openDropdown') === 'true') {
            setTimeout(() => abrirDropdownClienteCobranza(), 80);
          }
        } else if (modalParam === 'login') {
          abrirModalLogin();
        } else if (modalParam === 'usuario') {
          abrirModalUsuario();
        }

      }
    } catch (e) {
      // Entorno no-browser
    }
  }


  // =============================================================
  // SELECTOR GLOBAL DE SOCIO / VENDEDOR
  // =============================================================
  function actualizarSelectorVendedoresTopbar() {
    const select = document.getElementById('selectGlobalVendedor');
    if (!select) return;

    const actor = window.DataStore.getSesionActiva();
    const socioRestringido = window.DataStore.getSocioRestringido ? window.DataStore.getSocioRestringido() : null;

    if (socioRestringido) {
      state.activeVendedorId = socioRestringido;
      const vAct = window.DataStore.getVendedor(socioRestringido);
      const nombreSocio = vAct ? vAct.nombre : socioRestringido;
      const cantClientes = window.DataStore.getClientes({ vendedorId: socioRestringido }).length;

      select.innerHTML = `<option value="${socioRestringido}" selected>👤 ${escapeHtml(nombreSocio)} (${cantClientes} clientes)</option>`;
      select.disabled = true;
      select.title = `Acceso restringido: Cartera exclusiva de ${nombreSocio}`;
      select.style.cursor = 'default';
      select.style.backgroundColor = '#f1f5f9';
      select.style.color = '#334155';

      const badge = document.getElementById('sidebarSocioBadge');
      if (badge) badge.textContent = nombreSocio;
      return;
    }

    select.disabled = false;
    select.style.cursor = 'pointer';
    select.style.backgroundColor = '';
    select.style.color = '';
    select.title = 'Filtrar clientes y cuentas por socio/vendedor';

    const vendedores = window.DataStore.getAllVendedores ? window.DataStore.getAllVendedores() : window.DataStore.getVendedores();
    const todosClientes = window.DataStore.getClientes({ vendedorId: 'todos' });

    let html = `<option value="todos" ${state.activeVendedorId === 'todos' ? 'selected' : ''}>🌟 Todos los Socios (${todosClientes.length} clientes)</option>`;

    vendedores.forEach(v => {
      const cant = todosClientes.filter(c => c.vendedorId === v.id).length;
      html += `<option value="${v.id}" ${state.activeVendedorId === v.id ? 'selected' : ''}>👤 ${v.nombre} (${cant} clientes)</option>`;
    });

    if (actor && actor.rol === 'admin') {
      html += `<option value="__GESTIONAR__">⚙️ + Administrar Socios...</option>`;
    }
    select.innerHTML = html;

    // Actualizar únicamente el badge de la card informativa
    const badge = document.getElementById('sidebarSocioBadge');
    if (badge) {
      if (state.activeVendedorId === 'todos') {
        badge.textContent = 'Consolidado';
      } else {
        const vAct = window.DataStore.getVendedor(state.activeVendedorId);
        badge.textContent = vAct ? vAct.nombre : 'Socio';
      }
    }
  }

  function cambiarVendedorActivo(vendedorId) {
    if (vendedorId === '__GESTIONAR__') {
      actualizarSelectorVendedoresTopbar();
      abrirModalGestionSocios();
      return;
    }

    const socioRestringido = window.DataStore.getSocioRestringido ? window.DataStore.getSocioRestringido() : null;
    if (socioRestringido && vendedorId !== socioRestringido) {
      showToast('No tienes permisos de Consolidado para ver otros socios.', 'warning');
      state.activeVendedorId = socioRestringido;
      actualizarSelectorVendedoresTopbar();
      return;
    }

    state.activeVendedorId = vendedorId;
    actualizarSelectorVendedoresTopbar();

    // Actualizar cliente activo si el actual no pertenece al nuevo filtro
    const clientesFiltrados = window.DataStore.getClientes({ vendedorId });
    if (clientesFiltrados.length > 0) {
      const exists = clientesFiltrados.some(c => c.id === state.selectedClienteId);
      if (!exists) {
        state.selectedClienteId = clientesFiltrados[0].id;
      }
    } else {
      state.selectedClienteId = '';
    }

    actualizarBadgesNav();
    switchView(state.currentView);
    showToast(`Visualizando: ${vendedorId === 'todos' ? 'Consolidado (Todos los socios)' : window.DataStore.getVendedor(vendedorId)?.nombre}`, 'info');
  }

  function actualizarBadgesNav() {
    const badgeReclamos = document.getElementById('badgeDeudoresNav');
    if (badgeReclamos) {
      const deudores = window.DataStore.getRankingDeudores({ vendedorId: state.activeVendedorId });
      badgeReclamos.textContent = deudores.length;
      badgeReclamos.style.display = deudores.length > 0 ? 'inline-block' : 'none';
    }
  }

  // =============================================================
  function toggleSidebarMobile(forceState) {
    const sidebar = document.getElementById('appSidebar') || (document.querySelector ? document.querySelector('.sidebar') : null);
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar) return;
    const isOpen = sidebar.classList && sidebar.classList.contains ? sidebar.classList.contains('mobile-open') : false;
    const nextState = (typeof forceState === 'boolean') ? forceState : !isOpen;
    if (nextState) {
      if (sidebar.classList && sidebar.classList.add) sidebar.classList.add('mobile-open');
      if (backdrop && backdrop.classList && backdrop.classList.add) backdrop.classList.add('active');
    } else {
      if (sidebar.classList && sidebar.classList.remove) sidebar.classList.remove('mobile-open');
      if (backdrop && backdrop.classList && backdrop.classList.remove) backdrop.classList.remove('active');
    }
  }

  // =============================================================
  // ENRUTADOR Y CONTROLADOR DE VISTAS
  // =============================================================
  function switchView(viewName, params = {}) {
    state.currentView = viewName;

    // Cerrar sidebar en dispositivos móviles al cambiar de vista
    toggleSidebarMobile(false);

    // Actualizar Sidebar Active Button
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');
    const container = document.getElementById('viewContent');
    if (!container) return;

    if (viewName === 'ctacte') {
      if (params.clienteId) state.selectedClienteId = params.clienteId;
      pageTitle.textContent = 'Cuenta Corriente';
      pageSubtitle.textContent = 'Libro mayor de ventas cárnicas, pagos e imputación automática en tiempo real';
      renderCtaCte(container);
    } else if (viewName === 'ventas') {
      if (params.estado !== undefined) state.filters.ventas.estado = params.estado;
      pageTitle.textContent = 'Ventas de Carne';
      pageSubtitle.textContent = 'Listado de entregas y despachos de medias reses y cortes cárnicos';
      renderVentas(container);
    } else if (viewName === 'cobranzas') {
      pageTitle.textContent = 'Cobranzas y Pagos';
      pageSubtitle.textContent = 'Registro de cobranzas aplicadas a la cuenta corriente e imputación FIFO';
      renderCobranzas(container);
    } else if (viewName === 'reclamos') {
      pageTitle.textContent = 'Ranking de Deuda & Reclamos';
      pageSubtitle.textContent = 'Control de mayores deudores y generador directo de mensajes WhatsApp';
      renderReclamos(container);
    } else if (viewName === 'clientes') {
      pageTitle.textContent = 'Cartera de Clientes & Socios';
      pageSubtitle.textContent = 'Directorio comercial con asignación de socio/vendedor';
      renderClientes(container);
    } else if (viewName === 'dashboard') {
      pageTitle.textContent = 'Tablero Resumen';
      pageSubtitle.textContent = 'Métricas consolidadas de facturación, cobranzas y cartera activa';
      renderDashboard(container);
    } else if (viewName === 'planes-pago') {
      pageTitle.textContent = 'Planes de Pago & Refinanciación';
      pageSubtitle.textContent = 'Acuerdos de regularización en cuotas para carnicerías y distribuidores';
      renderPlanesPago(container);
    } else if (viewName === 'aging') {
      pageTitle.textContent = 'Antigüedad de Deuda (Aging)';
      pageSubtitle.textContent = 'Clasificación temporal de saldos por tramos de vencimiento';
      renderAging(container);
    } else if (viewName === 'admin') {
      const cur = window.DataStore.getSesionActiva();
      if (!cur || cur.rol !== 'admin') {
        showToast('Acceso restringido: Solo el Administrador puede gestionar usuarios.', 'error');
        switchView('ctacte');
        return;
      }
      pageTitle.textContent = 'Control de Acceso & Whitelist';
      pageSubtitle.textContent = 'Gestión de usuarios autorizados con usuario y contraseña (Super Admin: nicolasescudero5@gmail.com)';
      renderAdmin(container);
    }

    actualizarBadgesNav();
  }

  // =============================================================
  // VISTA 1: CUENTA CORRIENTE (ESPEJO DEL EXCEL)
  // =============================================================
  function renderCtaCte(container) {
    const clientes = window.DataStore.getClientes({ vendedorId: state.activeVendedorId });

    if (clientes.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 48px 24px;">
          <div style="font-size: 2.5rem; margin-bottom: 12px;">👥</div>
          <h3 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 8px;">No hay clientes en este socio</h3>
          <p style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 16px;">Seleccione otro socio o agregue un cliente nuevo.</p>
          <button class="btn btn-primary" onclick="App.abrirModalCliente()">+ Crear Cliente</button>
        </div>
      `;
      return;
    }

    let clienteActivo = clientes.find(c => c.id === state.selectedClienteId) || clientes[0];
    state.selectedClienteId = clienteActivo.id;

    const ctaCteData = window.DataStore.getExtractoCtaCte(clienteActivo.id);
    const movs = ctaCteData.movimientos;
    const totales = ctaCteData.totales;
    const cli = ctaCteData.cliente;

    container.innerHTML = `
      <!-- Barra de Selección de Cliente y Acciones Rápidas -->
      <div class="filters-bar no-print">
        <div class="filters-bar-left">
          <label style="font-size: 0.85rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 6px; white-space: nowrap;">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            Cliente:
          </label>
          <select id="selectClienteCtaCte" class="select-filter" onchange="App.onSelectClienteCtaCte(this.value)">
            ${clientes.map(c => `
              <option value="${c.id}" ${c.id === cli.id ? 'selected' : ''}>
                ${c.razonSocial} (Socio: ${c.vendedorNombre}) - Saldo: ${formatMoney(c.saldoActual)}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="filter-group">
          <button class="btn btn-primary btn-sm" onclick="App.abrirModalVenta('${cli.id}')">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            Venta
          </button>
          
          <button class="btn btn-dark btn-sm" onclick="App.abrirModalCobranza('${cli.id}')">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            Pago
          </button>

          ${totales.saldoActual > 0 ? `
            <button class="btn btn-sm" style="background:#25d366; color:#fff; font-weight:700;" onclick="App.abrirModalReclamo('${cli.id}')">
              📲 Reclamar
            </button>
          ` : ''}

          <button class="btn btn-secondary btn-sm" onclick="App.exportarCsvCtaCte('${cli.id}')">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Excel
          </button>
          
          <button class="btn btn-secondary btn-sm" onclick="window.print()">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            Imprimir
          </button>
        </div>
      </div>

      <!-- Ficha de Encabezado de la Cuenta Corriente -->
      <div class="account-statement-header">
        <div class="account-header-top">
          <div class="account-client-info">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;">
              <span class="vendedor-badge" style="background: ${cli.vendedorColor}20; color: ${cli.vendedorColor}; border: 1px solid ${cli.vendedorColor}40;">
                👤 Socio: ${cli.vendedorNombre}
              </span>
              <span class="badge ${totales.saldoActual > 0 ? 'badge-danger' : 'badge-success'}">
                ${totales.saldoActual > 0 ? 'Con Saldo Deudor' : 'Al Día / Sin Deuda'}
              </span>
            </div>
            <h2 style="font-size: 1.6rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.02em; margin-bottom: 6px; word-break: break-word;">
              ${cli.razonSocial}
            </h2>
            <div style="display: flex; align-items: center; gap: 8px; font-size: 0.84rem; color: var(--text-secondary); flex-wrap: wrap;">
              <span><strong>Tel:</strong> ${cli.telefono || 'Sin teléfono'}</span>
              <span>•</span>
              <span><strong>Contacto:</strong> ${cli.contactoNombre || cli.razonSocial}</span>
              <span>•</span>
              <span><strong>Movimientos:</strong> ${movs.length} registros</span>
            </div>
          </div>

          <!-- Caja de Saldo Actual Destacada -->
          <div class="saldo-destacado-card" style="background-color: ${totales.saldoActual > 0 ? 'var(--danger-light)' : 'var(--accent-mint-light)'}; border: 1.5px solid ${totales.saldoActual > 0 ? 'var(--danger-border)' : 'var(--accent-mint-border)'};">
            <div style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: ${totales.saldoActual > 0 ? 'var(--danger-text)' : 'var(--accent-mint-dark)'};">
              Saldo Deudor Acumulado
            </div>
            <div style="font-size: 1.95rem; font-weight: 800; letter-spacing: -0.03em; color: ${totales.saldoActual > 0 ? 'var(--danger)' : '#059669'}; margin: 2px 0;">
              ${formatMoney(totales.saldoActual)}
            </div>
            <div style="font-size: 0.75rem; font-weight: 700; color: ${totales.saldoActual > 0 ? 'var(--danger-text)' : 'var(--accent-mint-dark)'};">
              ${totales.saldoActual > 0 ? '⚠️ Pendiente de cancelación' : '🎉 Cuenta al día / cancelada'}
            </div>
          </div>
        </div>

        <!-- Grilla de Métricas del Cliente -->
        <div class="client-meta-grid">
          <div class="client-meta-item">
            <div class="label">Total Kilos Comprados</div>
            <div class="value" style="color: var(--text-primary); font-family: var(--font-mono);">${totales.totalKg.toLocaleString()} kg</div>
          </div>
          <div class="client-meta-item">
            <div class="label">Cantidad de Cortes</div>
            <div class="value">${totales.totalCortes} cortes</div>
          </div>
          <div class="client-meta-item">
            <div class="label">Total Facturado (Debe)</div>
            <div class="value" style="color: var(--text-primary);">${formatMoney(totales.totalDebe)}</div>
          </div>
          <div class="client-meta-item">
            <div class="label">Total Pagos (Haber)</div>
            <div class="value" style="color: #059669;">${formatMoney(totales.totalHaber)}</div>
          </div>
        </div>
      </div>

      <!-- Tabla del Libro Mayor (Espejo de las solapas del Excel) -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span style="font-size: 1.1rem;">📑</span>
            Extracto Cronológico de Cuenta Corriente (Fórmulas Excel)
          </div>
          <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">
            Saldo = Saldo Anterior + Debe (Ventas) - Haber (Pagos)
          </span>
        </div>
        <div class="table-responsive">
          <table class="custom-table table-compact">
            <thead>
              <tr style="background: #f8fafc;">
                <th style="width: 70px; white-space: nowrap;">Fecha</th>
                <th style="width: 52px;">Tipo</th>
                <th style="width: 65px;">Corte</th>
                <th style="width: 90px;">Kilos x Corte</th>
                <th style="text-align: center; width: 36px;">Cant</th>
                <th style="text-align: right; width: 58px;">Tot Kg</th>
                <th style="text-align: right; width: 62px;">$/kg</th>
                <th style="text-align: right; width: 68px;">Deuda Prev</th>
                <th style="text-align: right; width: 70px; color: var(--text-primary);">Debe</th>
                <th style="text-align: right; width: 70px; color: #059669;">Haber</th>
                <th style="text-align: right; width: 75px; font-weight: 800;">Saldo</th>
                <th style="text-align: right; width: 36px;" class="no-print">Ver</th>
              </tr>
            </thead>
            <tbody>
              ${movs.length === 0 ? `
                <tr><td colspan="12" style="text-align:center; padding: 36px; color: var(--text-muted);">No hay movimientos registrados para este cliente.</td></tr>
              ` : movs.map((m, idx) => {
                const isVenta = m.tipo === 'VENTA';
                return `
                  <tr style="${isVenta ? '' : 'background-color: #f0fdf4;'}">
                    <td style="white-space: nowrap; font-weight: 600; font-size: 0.74rem;">${formatDate(m.fecha)}</td>
                    <td>
                      <span class="badge ${isVenta ? 'badge-primary' : 'badge-success'}" style="font-weight: 800; font-size: 0.68rem; padding: 1px 5px;">
                        ${isVenta ? 'VENTA' : 'PAGO'}
                      </span>
                      ${!isVenta && m.pagoEfectivo > 0 && m.pagoTransf > 0 ? '<span style="font-size: 0.65rem; color: var(--text-muted); display: block;">Mixto</span>' : ''}
                    </td>
                    <td style="font-weight: 700; font-size: 0.75rem; color: ${isVenta ? 'var(--text-primary)' : 'var(--text-muted)'};">
                      ${m.corte}
                    </td>
                    <td style="max-width: 125px;">
                      ${isVenta && m.pesos && m.pesos.length > 0 ? `
                        <div style="display: flex; flex-wrap: wrap; gap: 2px; max-width: 125px;">
                          ${m.pesos.slice(0, 4).map(p => `<span class="peso-pill" style="font-size: 0.66rem; padding: 1px 3px; margin: 1px;">${p}</span>`).join('')}
                          ${m.pesos.length > 4 ? `<span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 700; align-self: center;">+${m.pesos.length - 4}</span>` : ''}
                        </div>
                      ` : (isVenta ? '-' : `<span style="color: #15803d; font-size: 0.7rem; font-weight: 600;">${m.documentoRef.metodo || 'Pago'}</span>`)}
                    </td>
                    <td style="text-align: center; font-weight: ${isVenta ? '700' : 'normal'}; font-size: 0.75rem; color: var(--text-secondary);">
                      ${isVenta ? m.cantidadCortes : '-'}
                    </td>
                    <td style="text-align: right; font-family: var(--font-mono); font-size: 0.75rem; font-weight: ${isVenta ? '700' : 'normal'};">
                      ${isVenta ? m.totalKg.toLocaleString() + ' kg' : '-'}
                    </td>
                    <td style="text-align: right; font-family: var(--font-mono); font-size: 0.74rem;">
                      ${isVenta ? formatMoney(m.precioKg) : '-'}
                    </td>
                    <td style="text-align: right; color: var(--text-muted); font-size: 0.74rem;">
                      ${formatMoney(m.saldoDeudorPrevio)}
                    </td>
                    <td style="text-align: right; font-weight: ${m.debe > 0 ? '700' : 'normal'}; font-size: 0.75rem; color: var(--text-primary);">
                      ${m.debe > 0 ? formatMoney(m.debe) : '-'}
                    </td>
                    <td style="text-align: right; font-weight: ${m.haber > 0 ? '800' : 'normal'}; font-size: 0.75rem; color: #059669;">
                      ${m.haber > 0 ? formatMoney(m.haber) : '-'}
                    </td>
                    <td style="text-align: right; font-weight: 800; font-size: 0.8rem; color: ${m.saldoAcumulado > 0 ? 'var(--danger)' : '#059669'};">
                      ${formatMoney(m.saldoAcumulado)}
                    </td>
                    <td style="text-align: right;" class="no-print">
                      ${isVenta ? `
                        <button class="btn btn-secondary btn-sm" style="padding: 1px 5px; font-size: 0.68rem;" onclick="App.verDetalleVenta('${m.id}')" title="Ver detalles y pagos aplicados">Ver</button>
                      ` : `
                        <button class="btn btn-secondary btn-sm" style="padding: 1px 5px; font-size: 0.68rem;" onclick="App.verDetalleCobranza('${m.id}')" title="Ver recibo">Recibo</button>
                      `}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="background: #f1f5f9; font-weight: 800; font-size: 0.76rem; border-top: 2px solid var(--border-color);">
                <td colspan="4" style="text-align: right; text-transform: uppercase;">Totales Acumulados:</td>
                <td style="text-align: center;">${totales.totalCortes}</td>
                <td style="text-align: right; font-family: var(--font-mono);">${totales.totalKg.toLocaleString()} kg</td>
                <td></td>
                <td></td>
                <td style="text-align: right; color: var(--text-primary);">${formatMoney(totales.totalDebe)}</td>
                <td style="text-align: right; color: #059669;">${formatMoney(totales.totalHaber)}</td>
                <td style="text-align: right; font-size: 0.92rem; color: ${totales.saldoActual > 0 ? 'var(--danger)' : '#059669'};">
                  ${formatMoney(totales.saldoActual)}
                </td>
                <td class="no-print"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  }

  function onSelectClienteCtaCte(clienteId) {
    state.selectedClienteId = clienteId;
    const container = document.getElementById('viewContent');
    renderCtaCte(container);
  }

  // =============================================================
  // VISTA 2: VENTAS DE CARNE (CON BOTÓN DIRECTO DE PAGO)
  // =============================================================
  function renderVentas(container) {
    const ventas = window.DataStore.getVentas({
      vendedorId: state.activeVendedorId,
      estado: state.filters.ventas.estado,
      search: state.filters.ventas.search,
      clienteId: state.filters.ventas.clienteId
    });
    const clientes = window.DataStore.getClientes({ vendedorId: state.activeVendedorId });

    container.innerHTML = `
      <div class="filters-bar">
        <div class="search-box">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" id="inputSearchVentas" placeholder="Buscar por número, cliente o corte..." value="${state.filters.ventas.search}">
        </div>

        <div class="filter-group">
          <select id="selectFiltroEstadoVentas" class="select-filter" onchange="App.onFiltroVentasChange('estado', this.value)">
            <option value="" ${state.filters.ventas.estado === '' ? 'selected' : ''}>Todos los estados</option>
            <option value="pendientes" ${state.filters.ventas.estado === 'pendientes' ? 'selected' : ''}>⚠️ Con saldo pendiente</option>
            <option value="parciales" ${state.filters.ventas.estado === 'parciales' ? 'selected' : ''}>Cobro parcial</option>
            <option value="cobradas" ${state.filters.ventas.estado === 'cobradas' ? 'selected' : ''}>✅ Totalmente cobradas</option>
          </select>

          <select id="selectFiltroClienteVentas" class="select-filter" onchange="App.onFiltroVentasChange('clienteId', this.value)">
            <option value="">Todos los clientes</option>
            ${clientes.map(c => `
              <option value="${c.id}" ${state.filters.ventas.clienteId === c.id ? 'selected' : ''}>${c.razonSocial}</option>
            `).join('')}
          </select>

          <button class="btn btn-primary" onclick="App.abrirModalVenta()">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            Cargar Venta
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span style="font-size: 1.1rem;">🥩</span>
            Ventas y Despachos Cárnicos (${ventas.length})
          </div>
          <span style="font-size: 0.8rem; color: var(--text-muted);">
            Se puede registrar el pago directamente con el botón verde en cada venta.
          </span>
        </div>
        <div class="table-responsive">
          <table class="custom-table table-compact">
            <thead>
              <tr>
                <th style="width: 82px;">Comprobante</th>
                <th>Cliente & Socio</th>
                <th style="width: 78px;">Corte</th>
                <th style="text-align: center; width: 44px;">Cant</th>
                <th style="text-align: right; width: 68px;">Tot Kg</th>
                <th style="text-align: right; width: 68px;">$/kg</th>
                <th style="text-align: right; width: 80px;">Total</th>
                <th style="text-align: right; width: 80px; color: #059669;">Cobrado</th>
                <th style="text-align: right; width: 80px;">Saldo Impago</th>
                <th style="width: 78px;">Estado</th>
                <th style="text-align: right; width: 92px;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${ventas.length === 0 ? `
                <tr><td colspan="11" style="text-align:center; padding: 36px; color: var(--text-muted);">No se encontraron ventas con los filtros seleccionados.</td></tr>
              ` : ventas.slice(0, 100).map(v => {
                let badgeHtml = '';
                if (v.estado === 'cobrado') {
                  badgeHtml = '<span class="badge badge-success" style="font-size: 0.68rem; padding: 1px 5px;"><span class="badge-dot"></span> Cancelado</span>';
                } else if (v.estado === 'parcial') {
                  badgeHtml = '<span class="badge badge-warning" style="font-size: 0.68rem; padding: 1px 5px;"><span class="badge-dot"></span> Parcial</span>';
                } else {
                  badgeHtml = '<span class="badge badge-danger" style="font-size: 0.68rem; padding: 1px 5px;"><span class="badge-dot"></span> Pendiente</span>';
                }

                return `
                  <tr>
                    <td>
                      <div style="font-weight: 700; font-family: var(--font-mono); font-size: 0.74rem; color: var(--text-primary);">${v.numero}</div>
                      <div style="font-size: 0.68rem; color: var(--text-muted);">${formatDate(v.fechaEmision)}</div>
                    </td>
                    <td>
                      <div style="font-weight: 700; font-size: 0.76rem;">${v.clienteNombre}</div>
                      <div style="font-size: 0.68rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
                        <span style="color: ${v.vendedorColor};">●</span> ${v.vendedorNombre}
                      </div>
                    </td>
                    <td>
                      <span style="font-weight: 700; font-size: 0.74rem; color: #1e293b;">${v.corte}</span>
                    </td>
                    <td style="text-align: center;">
                      <span class="badge badge-secondary" style="font-weight: 700; font-size: 0.7rem; padding: 1px 5px;">${v.cantidadCortes}</span>
                    </td>
                    <td style="text-align: right; font-family: var(--font-mono); font-size: 0.74rem; font-weight: 600;">
                      ${(v.totalKg || 0).toLocaleString()} kg
                    </td>
                    <td style="text-align: right; font-family: var(--font-mono); font-size: 0.74rem;">
                      ${formatMoney(v.precioKg)}
                    </td>
                    <td style="text-align: right; font-weight: 700; font-size: 0.76rem;">
                      ${formatMoney(v.total)}
                    </td>
                    <td style="text-align: right; font-weight: 600; font-size: 0.75rem; color: #059669;">
                      ${v.montoCobrado > 0 ? formatMoney(v.montoCobrado) : '-'}
                    </td>
                    <td style="text-align: right; font-weight: 800; font-size: 0.78rem; color: ${v.saldoPendiente > 0 ? 'var(--danger)' : 'var(--text-muted)'};">
                      ${formatMoney(v.saldoPendiente)}
                    </td>
                    <td>${badgeHtml}</td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; gap: 4px;">
                        ${v.saldoPendiente > 0 ? `
                          <button class="btn btn-success btn-sm" style="font-weight: 800; font-size: 0.68rem; padding: 2px 6px;" onclick="App.abrirModalCobranza('${v.clienteId}', '${v.id}')">
                            💵 Cobrar
                          </button>
                        ` : ''}
                        <button class="btn btn-secondary btn-sm" style="font-size: 0.68rem; padding: 2px 5px;" onclick="App.verDetalleVenta('${v.id}')">
                          Detalle
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Listener buscador
    const inp = document.getElementById('inputSearchVentas');
    if (inp) {
      inp.addEventListener('input', (e) => {
        state.filters.ventas.search = e.target.value;
        renderVentas(container);
      });
    }
  }

  function onFiltroVentasChange(field, val) {
    state.filters.ventas[field] = val;
    const container = document.getElementById('viewContent');
    renderVentas(container);
  }

  // =============================================================
  // VISTA 3: COBRANZAS Y PAGOS (IMPUTACIÓN FIFO)
  // =============================================================
  function renderCobranzas(container) {
    const cobranzas = window.DataStore.getCobranzas({
      vendedorId: state.activeVendedorId,
      search: state.filters.cobranzas.search,
      clienteId: state.filters.cobranzas.clienteId
    });
    const clientes = window.DataStore.getClientes({ vendedorId: state.activeVendedorId });

    container.innerHTML = `
      <div class="filters-bar">
        <div class="search-box">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" id="inputSearchCobranzas" placeholder="Buscar por recibo, cliente o método..." value="${state.filters.cobranzas.search}">
        </div>

        <div class="filter-group">
          <select id="selectFiltroClienteCobranzas" class="select-filter" onchange="App.onFiltroCobranzasChange('clienteId', this.value)">
            <option value="">Todos los clientes</option>
            ${clientes.map(c => `
              <option value="${c.id}" ${state.filters.cobranzas.clienteId === c.id ? 'selected' : ''}>${c.razonSocial}</option>
            `).join('')}
          </select>

          <button class="btn btn-dark" onclick="App.abrirModalCobranza()">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            Registrar Pago
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span style="font-size: 1.1rem;">💵</span>
            Historial de Cobranzas y Pagos (${cobranzas.length})
          </div>
          <span style="font-size: 0.8rem; color: var(--text-muted);">
            Impacto automático en la Cuenta Corriente y cancelación FIFO de ventas viejas.
          </span>
        </div>
        <div class="table-responsive">
          <table class="custom-table table-compact">
            <thead>
              <tr>
                <th style="width: 82px;">Recibo / Fecha</th>
                <th>Cliente & Observación</th>
                <th style="width: 85px;">Socio</th>
                <th style="width: 95px;">Método</th>
                <th>Ventas Canceladas (FIFO)</th>
                <th style="text-align: right; width: 80px;">Saldo Favor</th>
                <th style="text-align: right; width: 90px; color: #059669;">Percibido</th>
                <th style="text-align: right; width: 75px;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${cobranzas.length === 0 ? `
                <tr><td colspan="8" style="text-align:center; padding: 36px; color: var(--text-muted);">No se encontraron recibos de cobranza con los filtros seleccionados.</td></tr>
              ` : cobranzas.slice(0, 100).map(c => `
                <tr>
                  <td>
                    <div style="font-weight: 700; font-family: var(--font-mono); font-size: 0.74rem; color: var(--text-primary);">${c.numero}</div>
                    <div style="font-size: 0.68rem; color: var(--text-muted);">${formatDate(c.fecha)}</div>
                  </td>
                  <td>
                    <div style="font-weight: 700; font-size: 0.76rem;">${c.clienteNombre}</div>
                    <div style="font-size: 0.68rem; color: var(--text-muted);">${c.observaciones || 'Pago a cuenta'}</div>
                  </td>
                  <td>
                    <div style="font-size: 0.7rem; color: var(--text-secondary); display: flex; align-items: center; gap: 4px;">
                      <span style="color: ${c.vendedorColor};">●</span> ${c.vendedorNombre}
                    </div>
                  </td>
                  <td>
                    <span class="badge ${c.metodo === 'Efectivo' ? 'badge-primary' : 'badge-secondary'}" style="font-weight: 700; font-size: 0.68rem; padding: 1px 5px;">
                      ${c.metodo}
                    </span>
                    ${c.efectivo > 0 && c.transferencia > 0 ? `
                      <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 1px;">
                        Ef: ${formatMoney(c.efectivo)} | Trf: ${formatMoney(c.transferencia)}
                      </div>
                    ` : ''}
                  </td>
                  <td>
                    ${c.imputaciones && c.imputaciones.length > 0 ? `
                      <div style="font-size: 0.72rem; line-height: 1.3;">
                        ${c.imputaciones.map(imp => `
                          <div>• Venta <strong>${imp.numeroVenta}</strong>: ${formatMoney(imp.montoImputado)}</div>
                        `).join('')}
                      </div>
                    ` : '<span style="color: var(--text-muted); font-size: 0.72rem;">Imputación a cuenta corriente</span>'}
                  </td>
                  <td style="text-align: right; font-weight: 600; font-size: 0.75rem; color: ${c.saldoAFavor > 0 ? '#059669' : 'var(--text-muted)'};">
                    ${c.saldoAFavor > 0 ? formatMoney(c.saldoAFavor) : '-'}
                  </td>
                  <td style="text-align: right; font-weight: 800; font-size: 0.84rem; color: #059669;">
                    ${formatMoney(c.totalCobrado)}
                  </td>
                  <td style="text-align: right;">
                    <button class="btn btn-secondary btn-sm" style="font-size: 0.68rem; padding: 2px 6px;" onclick="App.verDetalleCobranza('${c.id}')">
                      Recibo
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const inp = document.getElementById('inputSearchCobranzas');
    if (inp) {
      inp.addEventListener('input', (e) => {
        state.filters.cobranzas.search = e.target.value;
        renderCobranzas(container);
      });
    }
  }

  function onFiltroCobranzasChange(field, val) {
    state.filters.cobranzas[field] = val;
    const container = document.getElementById('viewContent');
    renderCobranzas(container);
  }

  // =============================================================
  // VISTA 4: RANKING DE DEUDORES & RECLAMOS WHATSAPP
  // =============================================================
  function renderReclamos(container) {
    const deudores = window.DataStore.getRankingDeudores({
      vendedorId: state.activeVendedorId,
      search: state.filters.reclamos.search
    });

    const totalDeuda = deudores.reduce((acc, d) => acc + d.saldoActual, 0);

    container.innerHTML = `
      <!-- Banner Superior de Resumen de Mora -->
      <div class="metrics-grid">
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-label">Total Cartera en Deuda</span>
            <div class="kpi-icon red">
              <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
          <div class="kpi-value" style="color: var(--danger);">${formatMoney(totalDeuda)}</div>
          <div class="kpi-footer"><span>Distribuidos en <strong>${deudores.length} clientes deudores</strong></span></div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-label">Mayor Deudor Actual (#1)</span>
            <div class="kpi-icon yellow" style="font-size: 1.2rem;">🥇</div>
          </div>
          <div class="kpi-value" style="font-size: 1.3rem;">
            ${deudores[0] ? deudores[0].razonSocial : 'Sin deudas'}
          </div>
          <div class="kpi-footer">
            <span>Deuda: <strong>${deudores[0] ? formatMoney(deudores[0].saldoActual) : '$ 0,00'}</strong> (${deudores[0] ? deudores[0].vendedorNombre : '-'})</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-label">Gestión Inmediata</span>
            <div class="kpi-icon green" style="font-size: 1.2rem;">📲</div>
          </div>
          <div class="kpi-value" style="font-size: 1.15rem; font-weight: 800; color: #15803d;">WhatsApp Directo</div>
          <div class="kpi-footer"><span>Plantillas con detalle de deuda y CBU listas en 1-clic</span></div>
        </div>
      </div>

      <!-- Buscador -->
      <div class="filters-bar">
        <div class="search-box" style="flex: 1;">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" id="inputSearchReclamos" placeholder="Buscar deudor por nombre..." value="${state.filters.reclamos.search}">
        </div>
      </div>

      <!-- Tabla de Ranking de Deudores -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span style="font-size: 1.1rem;">📊</span>
            Ranking de Mayores Deudores (Ordenado de Mayor a Menor Deuda)
          </div>
          <span style="font-size: 0.8rem; color: var(--text-muted);">
            Haga clic en "Reclamar WhatsApp" para abrir la plantilla con los datos del cliente.
          </span>
        </div>
        <div class="table-responsive">
          <table class="custom-table table-compact">
            <thead>
              <tr>
                <th style="width: 44px; text-align: center;">Rank</th>
                <th>Cliente Deudor</th>
                <th style="width: 85px;">Socio</th>
                <th style="text-align: right; width: 95px; color: var(--danger);">Deuda Total</th>
                <th style="width: 130px;">Venta Impaga</th>
                <th style="width: 120px;">Último Pago</th>
                <th style="text-align: right; width: 140px;">Acción de Reclamo</th>
              </tr>
            </thead>
            <tbody>
              ${deudores.length === 0 ? `
                <tr><td colspan="7" style="text-align:center; padding: 36px; color: var(--text-muted);">¡Excelente! No hay clientes con saldo deudor pendiente.</td></tr>
              ` : deudores.map(d => {
                let medal = `#${d.rank}`;
                if (d.rank === 1) medal = '🥇 #1';
                else if (d.rank === 2) medal = '🥈 #2';
                else if (d.rank === 3) medal = '🥉 #3';

                return `
                  <tr>
                    <td style="text-align: center; font-weight: 800; font-size: 0.76rem; color: ${d.rank <= 3 ? '#b45309' : 'var(--text-secondary)'};">
                      ${medal}
                    </td>
                    <td>
                      <div style="font-weight: 800; font-size: 0.78rem; color: var(--text-primary);">${d.razonSocial}</div>
                      <div style="font-size: 0.68rem; color: var(--text-muted);">${d.contactoNombre} • ${d.telefono}</div>
                    </td>
                    <td>
                      <div style="font-size: 0.7rem; color: var(--text-secondary); display: flex; align-items: center; gap: 4px;">
                        <span style="color: ${d.vendedorColor};">●</span> ${d.vendedorNombre}
                      </div>
                    </td>
                    <td style="text-align: right; font-weight: 800; font-size: 0.82rem; color: var(--danger);">
                      ${formatMoney(d.saldoActual)}
                      <div style="font-size: 0.66rem; color: var(--text-muted); font-weight: 600;">${d.ventasPendientesCount} impagas</div>
                    </td>
                    <td>
                      ${d.ventaMasVieja ? `
                        <div style="font-size: 0.72rem;">
                          <strong>Venta ${d.ventaMasVieja.numero}</strong> (${d.ventaMasVieja.corte})
                        </div>
                        <div style="font-size: 0.68rem; color: var(--danger); font-weight: 600;">
                          ${formatDate(d.ventaMasVieja.fecha)} (${d.ventaMasVieja.diasAtraso}d mora)
                        </div>
                      ` : '<span style="color: var(--text-muted); font-size: 0.72rem;">-</span>'}
                    </td>
                    <td>
                      ${d.ultimoPago ? `
                        <div style="font-size: 0.72rem;">
                          <strong>${formatMoney(d.ultimoPago.monto)}</strong>
                        </div>
                        <div style="font-size: 0.68rem; color: var(--text-muted);">
                          ${formatDate(d.ultimoPago.fecha)} (${d.ultimoPago.metodo})
                        </div>
                      ` : '<span style="color: var(--text-muted); font-size: 0.7rem;">Sin pagos</span>'}
                    </td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; gap: 4px;">
                        <button class="btn btn-sm btn-whatsapp-action" style="font-size: 0.68rem; padding: 2px 6px;" onclick="App.abrirModalReclamo('${d.clienteId}')">
                          📲 WhatsApp
                        </button>
                        <button class="btn btn-secondary btn-sm" style="font-size: 0.68rem; padding: 2px 6px;" onclick="App.switchView('ctacte', { clienteId: '${d.clienteId}' })" title="Ver cuenta corriente completa">
                          Cta Cte
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const inp = document.getElementById('inputSearchReclamos');
    if (inp) {
      inp.addEventListener('input', (e) => {
        state.filters.reclamos.search = e.target.value;
        renderReclamos(container);
      });
    }
  }

  // =============================================================
  // VISTA 5: CLIENTES & SOCIOS
  // =============================================================
  function renderClientes(container) {
    const clientes = window.DataStore.getClientes({
      vendedorId: state.activeVendedorId,
      search: state.filters.clientes.search
    });

    container.innerHTML = `
      <div class="filters-bar">
        <div class="search-box">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" id="inputSearchClientes" placeholder="Buscar por nombre, teléfono o contacto..." value="${state.filters.clientes.search}">
        </div>

        <div class="filter-group">
          <button class="btn btn-secondary" onclick="App.abrirModalGestionSocios()">
            👥 Administrar Socios
          </button>
          
          <button class="btn btn-primary" onclick="App.abrirModalCliente()">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            Nuevo Cliente
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span style="font-size: 1.1rem;">👥</span>
            Cartera de Clientes Cárnicos (${clientes.length})
          </div>
        </div>
        <div class="table-responsive">
          <table class="custom-table table-compact">
            <thead>
              <tr>
                <th>Cliente / Razón Social</th>
                <th style="width: 85px;">Socio</th>
                <th style="width: 140px;">Contacto & Teléfono</th>
                <th style="text-align: right; width: 85px;">Facturado</th>
                <th style="text-align: right; width: 85px; color: #059669;">Cobrado</th>
                <th style="text-align: right; width: 85px; font-weight: 800;">Saldo Actual</th>
                <th style="width: 75px;">Estado</th>
                <th style="text-align: right; width: 110px;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${clientes.length === 0 ? `
                <tr><td colspan="8" style="text-align:center; padding: 36px; color: var(--text-muted);">No se encontraron clientes con los filtros seleccionados.</td></tr>
              ` : clientes.slice(0, 100).map(c => `
                <tr>
                  <td>
                    <div style="font-weight: 800; font-size: 0.78rem; color: var(--text-primary);">${c.razonSocial}</div>
                    <div style="font-size: 0.68rem; color: var(--text-muted);">${c.direccion || 'Gran Buenos Aires'}</div>
                  </td>
                  <td>
                    <div style="font-size: 0.7rem; color: var(--text-secondary); display: flex; align-items: center; gap: 4px;">
                      <span style="color: ${c.vendedorColor};">●</span> ${c.vendedorNombre}
                    </div>
                  </td>
                  <td>
                    <div style="font-size: 0.74rem;"><strong>${c.contactoNombre}</strong></div>
                    <div style="font-size: 0.68rem; color: var(--text-muted);">${c.telefono}</div>
                  </td>
                  <td style="text-align: right; font-weight: 600; font-size: 0.74rem;">
                    ${formatMoney(c.totalFacturado)}
                  </td>
                  <td style="text-align: right; font-weight: 600; font-size: 0.74rem; color: #059669;">
                    ${formatMoney(c.totalCobrado)}
                  </td>
                  <td style="text-align: right; font-weight: 800; font-size: 0.8rem; color: ${c.saldoActual > 0 ? 'var(--danger)' : '#059669'};">
                    ${formatMoney(c.saldoActual)}
                  </td>
                  <td>
                    <span class="badge ${c.estado === 'activo' ? 'badge-success' : 'badge-danger'}" style="font-size: 0.66rem; padding: 1px 5px;">
                      ${c.estado === 'activo' ? 'Habilitado' : 'Suspendido'}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    <div style="display: inline-flex; gap: 4px;">
                      <button class="btn btn-secondary btn-sm" style="font-size: 0.68rem; padding: 2px 6px;" onclick="App.switchView('ctacte', { clienteId: '${c.id}' })">
                        Cta Cte
                      </button>
                      <button class="btn btn-secondary btn-sm" style="font-size: 0.68rem; padding: 2px 6px;" onclick="App.abrirModalCliente('${c.id}')">
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const inp = document.getElementById('inputSearchClientes');
    if (inp) {
      inp.addEventListener('input', (e) => {
        state.filters.clientes.search = e.target.value;
        renderClientes(container);
      });
    }
  }

  // =============================================================
  // VISTA 6: TABLERO DE CONTROL (RESUMEN)
  // =============================================================
  function renderDashboard(container) {
    const metrics = window.DataStore.getDashboardMetrics({ vendedorId: state.activeVendedorId });

    container.innerHTML = `
      <div class="metrics-grid">
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-label">Saldo Total a Cobrar</span>
            <div class="kpi-icon red">
              <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
          <div class="kpi-value" style="color: var(--danger);">${formatMoney(metrics.totalDeudaGlobal)}</div>
          <div class="kpi-footer">
            <span>En <strong>${metrics.clientesConDeudaCount} clientes</strong> con deuda activa</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-label">Total Cobranzas Percibidas</span>
            <div class="kpi-icon green">
              <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
          </div>
          <div class="kpi-value" style="color: #059669;">${formatMoney(metrics.totalCobradoHistorico)}</div>
          <div class="kpi-footer">
            <span>Cobranzas asentadas en cuentas</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-label">Volumen Total Cárnico</span>
            <div class="kpi-icon purple">
              <span style="font-size: 1.2rem;">🥩</span>
            </div>
          </div>
          <div class="kpi-value" style="font-family: var(--font-mono);">${metrics.totalKgHistorico.toLocaleString()} kg</div>
          <div class="kpi-footer">
            <span>Medias reses y cortes comercializados</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-label">Padrón de Clientes</span>
            <div class="kpi-icon blue">
              <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
            </div>
          </div>
          <div class="kpi-value">${metrics.totalClientes}</div>
          <div class="kpi-footer">
            <span>Cuentas activas en la cartera</span>
          </div>
        </div>
      </div>

      <!-- Top 5 Deudores Prioritarios -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span style="font-size: 1.1rem;">🚨</span>
            Top 5 Mayores Deudores para Reclamo
          </div>
          <button class="btn btn-secondary btn-sm" onclick="App.switchView('reclamos')">Ver Ranking Completo</button>
        </div>
        <div class="table-responsive">
          <table class="custom-table" style="font-size: 0.84rem;">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Cliente</th>
                <th>Socio</th>
                <th style="text-align: right; color: var(--danger);">Deuda Pendiente</th>
                <th>Venta Más Vieja</th>
                <th style="text-align: right;">Acción Inmediata</th>
              </tr>
            </thead>
            <tbody>
              ${metrics.topDeudores.map(d => `
                <tr>
                  <td style="font-weight: 800;">#${d.rank}</td>
                  <td>
                    <div style="font-weight: 700;">${d.razonSocial}</div>
                    <div style="font-size: 0.74rem; color: var(--text-muted);">${d.telefono}</div>
                  </td>
                  <td>
                    <span class="vendedor-badge" style="background: ${d.vendedorColor}20; color: ${d.vendedorColor};">
                      👤 ${d.vendedorNombre}
                    </span>
                  </td>
                  <td style="text-align: right; font-weight: 800; font-size: 1rem; color: var(--danger);">
                    ${formatMoney(d.saldoActual)}
                  </td>
                  <td>
                    ${d.ventaMasVieja ? `
                      <span style="font-weight: 600;">${d.ventaMasVieja.numero}</span> (${d.ventaMasVieja.diasAtraso} días atrás)
                    ` : '-'}
                  </td>
                  <td style="text-align: right;">
                    <button class="btn btn-sm btn-whatsapp-action" onclick="App.abrirModalReclamo('${d.clienteId}')">
                      📲 Reclamar WhatsApp
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // =============================================================
  // VISTAS SECUNDARIAS CONSERVADAS (PLANES DE PAGO & AGING)
  // =============================================================
  function renderPlanesPago(container) {
    const planes = window.DataStore.getPlanesPago();
    container.innerHTML = `
      <div class="filters-bar">
        <div><p style="font-size: 0.85rem; color: var(--text-muted);">Acuerdos de refinanciación y pago en cuotas.</p></div>
        <button class="btn btn-primary" onclick="App.abrirModalNuevoPlan()">+ Nuevo Plan</button>
      </div>
      <div class="card">
        <div class="card-body" style="padding: 24px;">
          ${planes.length === 0 ? '<p style="color:var(--text-muted);">No hay convenios registrados actualmente.</p>' : `
            <ul>${planes.map(p => `<li><strong>${p.clienteNombre}</strong>: ${formatMoney(p.montoTotalDeuda)} en cuotas (${p.frecuencia})</li>`).join('')}</ul>
          `}
        </div>
      </div>
    `;
  }

  function renderAging(container) {
    const deudores = window.DataStore.getRankingDeudores({ vendedorId: state.activeVendedorId });
    container.innerHTML = `
      <div class="card">
        <div class="card-header"><div class="card-title">Matriz de Antigüedad de Deuda</div></div>
        <div class="table-responsive">
          <table class="custom-table" style="font-size:0.84rem;">
            <thead><tr><th>Cliente</th><th>Socio</th><th style="text-align:right;">Saldo Total</th><th>Días de Mora</th></tr></thead>
            <tbody>
              ${deudores.map(d => `
                <tr>
                  <td><strong>${d.razonSocial}</strong></td>
                  <td>${d.vendedorNombre}</td>
                  <td style="text-align:right; font-weight:700; color:var(--danger);">${formatMoney(d.saldoActual)}</td>
                  <td>${d.ventaMasVieja ? d.ventaMasVieja.diasAtraso + ' días' : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // =============================================================
  // VISTA 8: CONTROL DE ACCESO & WHITELIST DE USUARIOS
  // =============================================================
  function renderAdmin(container) {
    const usuarios = window.DataStore.getUsuarios ? window.DataStore.getUsuarios() : [];
    const search = (state.filters.admin && state.filters.admin.search) ? state.filters.admin.search.toLowerCase() : '';
    const rolFiltro = (state.filters.admin && state.filters.admin.rol) ? state.filters.admin.rol : '';
    const estadoFiltro = (state.filters.admin && state.filters.admin.estado) ? state.filters.admin.estado : '';

    const filtrados = usuarios.filter(u => {
      const matchSearch = !search || (u.nombre && u.nombre.toLowerCase().includes(search)) || (u.email && u.email.toLowerCase().includes(search));
      const matchRol = !rolFiltro || u.rol === rolFiltro;
      const matchEstado = !estadoFiltro || u.estado === estadoFiltro;
      return matchSearch && matchRol && matchEstado;
    });

    const totalUsuarios = usuarios.length;
    const activosCount = usuarios.filter(u => u.estado === 'activo').length;
    const inactivosCount = usuarios.filter(u => u.estado === 'inactivo').length;

    container.innerHTML = `
      <!-- Métricas Resumen de Whitelist -->
      <div class="metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-bottom: 20px;">
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-label">Total en Whitelist</span>
            <div class="kpi-icon blue" style="font-size: 1.1rem;">🛡️</div>
          </div>
          <div class="kpi-value">${totalUsuarios}</div>
          <div class="kpi-footer">Cuentas con acceso configurado</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-label">Usuarios Activos</span>
            <div class="kpi-icon green" style="font-size: 1.1rem;">✅</div>
          </div>
          <div class="kpi-value" style="color: #059669;">${activosCount}</div>
          <div class="kpi-footer">Habilitados para ingresar</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-label">Dados de Baja</span>
            <div class="kpi-icon red" style="font-size: 1.1rem;">🚫</div>
          </div>
          <div class="kpi-value" style="color: ${inactivosCount > 0 ? 'var(--danger)' : 'var(--text-muted)'};">${inactivosCount}</div>
          <div class="kpi-footer">Acceso bloqueado / suspendido</div>
        </div>

        <div class="kpi-card" style="border-left: 4px solid #6366f1;">
          <div class="kpi-top">
            <span class="kpi-label">Super Administrador</span>
            <div class="kpi-icon purple" style="font-size: 1.1rem;">👑</div>
          </div>
          <div style="font-weight: 800; font-size: 0.92rem; color: #1e1b4b; margin: 6px 0; word-break: break-all;">nicolasescudero5@gmail.com</div>
          <div class="kpi-footer" style="color: #4f46e5; font-weight: 700;">Control total y permisos raíz</div>
        </div>
      </div>

      <!-- Barra de Filtros y Acción de Alta -->
      <div class="filters-bar">
        <div class="search-box">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" id="inputSearchUsuarios" placeholder="Buscar usuario por nombre o correo..." value="${state.filters.admin ? escapeHtml(state.filters.admin.search) : ''}">
        </div>

        <div class="filter-group">
          <select id="selectFiltroRolUsuarios" class="select-filter" onchange="App.onFiltroUsuariosChange('rol', this.value)">
            <option value="">Todos los roles</option>
            <option value="admin" ${rolFiltro === 'admin' ? 'selected' : ''}>Administradores</option>
            <option value="operador" ${rolFiltro === 'operador' ? 'selected' : ''}>Operadores</option>
            <option value="socio" ${rolFiltro === 'socio' ? 'selected' : ''}>Socios Comerciales</option>
          </select>

          <select id="selectFiltroEstadoUsuarios" class="select-filter" onchange="App.onFiltroUsuariosChange('estado', this.value)">
            <option value="">Todos los estados</option>
            <option value="activo" ${estadoFiltro === 'activo' ? 'selected' : ''}>Solo Activos</option>
            <option value="inactivo" ${estadoFiltro === 'inactivo' ? 'selected' : ''}>Dados de Baja</option>
          </select>

          <button class="btn btn-primary" onclick="App.abrirModalUsuario()">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            Nuevo Usuario
          </button>
        </div>
      </div>

      <!-- Tabla de Usuarios Whitelist -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span style="font-size: 1.1rem;">🛡️</span>
            Lista Blanca de Acceso (Whitelist - Usuarios y Contraseñas)
          </div>
          <span style="font-size: 0.8rem; color: var(--text-muted);">
            Solo los correos y contraseñas registrados aquí podrán acceder al sistema.
          </span>
        </div>
        <div class="table-responsive">
          <table class="custom-table table-compact">
            <thead>
              <tr>
                <th style="width: 140px;">Usuario</th>
                <th>Email Autorizado</th>
                <th style="width: 110px;">Rol</th>
                <th style="width: 95px;">Socio Asignado</th>
                <th style="width: 90px;">Estado</th>
                <th style="width: 110px;">Último Acceso</th>
                <th style="text-align: right; width: 140px;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${filtrados.length === 0 ? `
                <tr><td colspan="7" style="text-align:center; padding: 36px; color: var(--text-muted);">No se encontraron usuarios con los filtros seleccionados.</td></tr>
              ` : filtrados.map(u => {
                const isSuperAdmin = u.email.toLowerCase() === 'nicolasescudero5@gmail.com';
                const isActivo = u.estado === 'activo';
                return `
                  <tr style="${isActivo ? '' : 'background-color: #fef2f2; opacity: 0.85;'}">
                    <td>
                      <div style="font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                        <span style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: ${isSuperAdmin ? '#4f46e5' : '#0284c7'}; color: #fff; font-size: 0.7rem; font-weight: 800;">
                          ${(u.nombre || 'U').slice(0, 2).toUpperCase()}
                        </span>
                        ${escapeHtml(u.nombre)}
                      </div>
                    </td>
                    <td>
                      <div style="font-family: var(--font-mono); font-size: 0.76rem; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                        ${escapeHtml(u.email)}
                        ${isSuperAdmin ? '<span class="badge" style="background: #e0e7ff; color: #3730a3; font-size: 0.65rem; padding: 1px 6px;">👑 Super Admin</span>' : ''}
                      </div>
                    </td>
                    <td>
                      <span class="badge ${u.rol === 'admin' ? 'badge-primary' : 'badge-secondary'}" style="font-size: 0.68rem; text-transform: uppercase;">
                        ${u.rol === 'admin' ? 'Admin' : (u.rol === 'socio' ? 'Socio' : 'Operador')}
                      </span>
                    </td>
                    <td>
                      <span style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 600;">
                        ${(u.puedeConsolidar || u.socioAsignado === 'todos') 
                          ? `<span class="badge" style="background:#fef3c7; color:#92400e; font-size:0.65rem; border:1px solid #fde68a;">🌟 Consolidado</span> ${u.socioAsignado !== 'todos' ? `(${escapeHtml(window.DataStore.getVendedor(u.socioAsignado)?.nombre || u.socioAsignado)})` : ''}` 
                          : `👤 ${escapeHtml(window.DataStore.getVendedor(u.socioAsignado)?.nombre || u.socioAsignado)}`}
                      </span>
                    </td>
                    <td>
                      <span class="badge ${isActivo ? 'badge-success' : 'badge-danger'}" style="font-size: 0.68rem;">
                        <span class="badge-dot"></span> ${isActivo ? 'Activo' : 'Baja'}
                      </span>
                    </td>
                    <td style="font-size: 0.72rem; color: var(--text-muted);">
                      ${u.ultimoAcceso || 'Sin ingresos'}
                    </td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; gap: 4px;">
                        <button class="btn btn-secondary btn-sm" style="padding: 2px 7px; font-size: 0.7rem;" onclick="App.abrirModalUsuario('${u.id}')" title="Editar datos del usuario">
                          Editar
                        </button>
                        ${isSuperAdmin ? `
                          <span class="badge" style="background: #f1f5f9; color: #94a3b8; font-size: 0.68rem; padding: 2px 6px;" title="El Super Admin principal no puede ser modificado">Fijo</span>
                        ` : `
                          <button class="btn ${isActivo ? 'btn-danger' : 'btn-success'} btn-sm" style="padding: 2px 7px; font-size: 0.7rem;" onclick="App.toggleBajaUsuario('${u.id}')" title="${isActivo ? 'Dar de baja (bloquear acceso)' : 'Reactivar acceso'}">
                            ${isActivo ? 'Baja' : 'Activar'}
                          </button>
                          <button class="btn btn-secondary btn-sm" style="padding: 2px 6px; font-size: 0.7rem; color: var(--danger);" onclick="App.eliminarUsuario('${u.id}')" title="Eliminar de la whitelist">
                            🗑️
                          </button>
                        `}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const inp = document.getElementById('inputSearchUsuarios');
    if (inp) {
      inp.addEventListener('input', (e) => {
        if (!state.filters.admin) state.filters.admin = { search: '', rol: '', estado: '' };
        state.filters.admin.search = e.target.value;
        renderAdmin(container);
      });
    }
  }

  function onFiltroUsuariosChange(field, val) {
    if (!state.filters.admin) state.filters.admin = { search: '', rol: '', estado: '' };
    state.filters.admin[field] = val;
    const container = document.getElementById('viewContent');
    renderAdmin(container);
  }

  // =============================================================
  // MODALES Y MÉTODOS DE SEGURIDAD / WHITELIST
  // =============================================================
  function abrirModalUsuario(usuarioId = null) {
    const curActor = window.DataStore.getSesionActiva();
    if (!curActor || curActor.rol !== 'admin') {
      showToast('Acceso denegado: Solo el Administrador puede gestionar usuarios.', 'error');
      return;
    }

    const title = document.getElementById('modalUsuarioTitle');
    const body = document.getElementById('modalUsuarioBody');
    if (!body) return;

    let user = null;
    if (usuarioId) {
      user = window.DataStore.getUsuario(usuarioId);
    }

    if (title) {
      title.textContent = user ? `Editar Usuario: ${user.nombre}` : 'Nuevo Usuario en Whitelist';
    }

    const vendedores = window.DataStore.getAllVendedores ? window.DataStore.getAllVendedores() : window.DataStore.getVendedores();
    const isSuperAdmin = user && user.email.toLowerCase() === 'nicolasescudero5@gmail.com';
    const actorIsSuperAdmin = curActor.email.toLowerCase() === 'nicolasescudero5@gmail.com';

    body.innerHTML = `
      <form id="formUsuarioWhitelist" onsubmit="event.preventDefault(); App.guardarUsuarioForm();">
        <input type="hidden" id="usrId" value="${user ? user.id : ''}">
        
        <div class="form-group" style="margin-bottom: 12px;">
          <label class="form-label">Nombre Completo <span class="required">*</span></label>
          <input type="text" id="usrNombre" class="form-control" value="${user ? escapeHtml(user.nombre) : ''}" placeholder="Ej: Marcos Escudero" required>
        </div>

        <div class="form-group" style="margin-bottom: 12px;">
          <label class="form-label">Usuario / Correo Electrónico (Login) <span class="required">*</span></label>
          <input type="text" id="usrEmail" class="form-control" value="${user ? escapeHtml(user.email) : ''}" placeholder="Ej: franco o usuario@empresa.com" ${isSuperAdmin ? 'readonly' : ''} required autocomplete="off">
          ${isSuperAdmin ? '<span style="font-size: 0.72rem; color: var(--primary); display:block; margin-top:3px;">El usuario del Super Admin principal no puede alterarse.</span>' : ''}
        </div>

        <div class="form-group" style="margin-bottom: 12px;">
          <label class="form-label">Contraseña de Acceso ${user ? '<span style="font-size: 0.75rem; color: var(--text-muted);">(dejar en blanco para conservar la actual)</span>' : '<span class="required">*</span>'}</label>
          <input type="password" id="usrPassword" class="form-control" placeholder="${user ? '••••••••' : 'Ingrese clave segura'}" ${user ? '' : 'required'}>
        </div>

        <div class="form-row" style="margin-bottom: 12px;">
          <div class="form-group" style="flex: 1;">
            <label class="form-label">Rol en el Sistema</label>
            <select id="usrRol" class="form-control" ${isSuperAdmin ? 'disabled' : ''}>
              ${actorIsSuperAdmin ? `<option value="admin" ${user && user.rol === 'admin' ? 'selected' : ''}>Administrador (Total)</option>` : (user && user.rol === 'admin' ? `<option value="admin" selected>Administrador</option>` : '')}
              <option value="operador" ${(!user || user.rol === 'operador') ? 'selected' : ''}>Operador Cuentas Corrientes</option>
              <option value="socio" ${user && user.rol === 'socio' ? 'selected' : ''}>Socio Comercial / Vendedor</option>
            </select>
            ${!actorIsSuperAdmin ? '<span style="font-size: 0.7rem; color: var(--text-muted);">Solo el Super Admin puede asignar permisos de Administrador.</span>' : ''}
          </div>

          <div class="form-group" style="flex: 1;">
            <label class="form-label">Socio Asignado</label>
            <select id="usrSocioAsignado" class="form-control" onchange="App.onUsuarioSocioAsignadoChange(this.value)">
              <option value="todos" ${!user || user.socioAsignado === 'todos' ? 'selected' : ''}>🌟 Consolidado (Todos)</option>
              ${vendedores.map(v => `
                <option value="${v.id}" ${user && user.socioAsignado === v.id ? 'selected' : ''}>👤 ${v.nombre}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <!-- Opción Consolidado para ver todos los socios -->
        <div class="form-group" style="margin-bottom: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px;">
          <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer; margin: 0;">
            <input type="checkbox" id="usrPuedeConsolidar" style="margin-top: 3px; accent-color: var(--primary);" 
              ${(!user || user.puedeConsolidar || user.socioAsignado === 'todos') ? 'checked' : ''} 
              ${(!user || user.socioAsignado === 'todos') ? 'disabled' : ''}>
            <div>
              <strong style="font-size: 0.82rem; color: #0f172a; display: block;">Opción Consolidado (Ver todos los socios)</strong>
              <span style="font-size: 0.72rem; color: #64748b; display: block; margin-top: 2px;">
                Permite al usuario ver las cuentas corrientes, ventas y estadísticas de <strong>todos</strong> los socios. Si no está tildada, el usuario <strong>únicamente</strong> podrá acceder a la cartera del socio asignado.
              </span>
            </div>
          </label>
        </div>

        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label">Estado de la Cuenta</label>
          <select id="usrEstado" class="form-control" ${isSuperAdmin ? 'disabled' : ''}>
            <option value="activo" ${!user || user.estado === 'activo' ? 'selected' : ''}>🟢 Activo (Puede ingresar al sistema)</option>
            <option value="inactivo" ${user && user.estado === 'inactivo' ? 'selected' : ''}>🔴 Dado de Baja (Acceso bloqueado)</option>
          </select>
        </div>
      </form>
    `;

    abrirModal('modalUsuario');
  }

  function onUsuarioSocioAsignadoChange(val) {
    const chk = document.getElementById('usrPuedeConsolidar');
    if (!chk) return;
    if (val === 'todos') {
      chk.checked = true;
      chk.disabled = true;
    } else {
      chk.disabled = false;
    }
  }

  async function guardarUsuarioForm() {
    const curActor = window.DataStore.getSesionActiva();
    if (!curActor || curActor.rol !== 'admin') {
      showToast('Acceso denegado: No tienes permisos para gestionar usuarios.', 'error');
      return;
    }

    const id = document.getElementById('usrId')?.value || null;
    const nombre = document.getElementById('usrNombre')?.value?.trim();
    const email = document.getElementById('usrEmail')?.value?.trim();
    const password = document.getElementById('usrPassword')?.value?.trim();
    const rol = document.getElementById('usrRol')?.value || 'operador';
    const socioAsignado = document.getElementById('usrSocioAsignado')?.value || 'todos';
    const chkConsolidar = document.getElementById('usrPuedeConsolidar');
    const puedeConsolidar = chkConsolidar ? chkConsolidar.checked : (socioAsignado === 'todos');
    const estado = document.getElementById('usrEstado')?.value || 'activo';

    if (!nombre || !email) {
      showToast('Por favor complete nombre y correo electrónico / usuario.', 'error');
      return;
    }
    if (!id && !password) {
      showToast('Debe ingresar una contraseña para el nuevo usuario.', 'error');
      return;
    }

    try {
      const payload = {
        id: id || undefined,
        nombre,
        email,
        rol,
        socioAsignado,
        puedeConsolidar,
        estado
      };
      if (password) {
        payload.password = password;
      }
      const savedUser = window.DataStore.saveUsuario(payload);

      // Esperar persistencia en Supabase
      if (window.SupabaseService && window.SupabaseService.guardarUsuario) {
        await window.SupabaseService.guardarUsuario(savedUser);
      }

      cerrarModal('modalUsuario');
      showToast(`¡Usuario ${nombre} guardado correctamente e impactado en Supabase!`, 'success');

      if (state.currentView === 'admin') {
        const container = document.getElementById('viewContent');
        renderAdmin(container);
      }
    } catch (err) {
      showToast('Error al guardar: ' + err.message, 'error');
    }
  }

  async function toggleBajaUsuario(id) {
    const curActor = window.DataStore.getSesionActiva();
    if (!curActor || curActor.rol !== 'admin') {
      showToast('Acceso denegado: No tienes permisos para suspender usuarios.', 'error');
      return;
    }

    try {
      const u = window.DataStore.toggleBajaUsuario(id);
      if (window.SupabaseService && window.SupabaseService.cambiarEstadoUsuario) {
        await window.SupabaseService.cambiarEstadoUsuario(id, u.estado);
      }
      showToast(`Usuario ${u.nombre} ahora está ${u.estado === 'activo' ? 'Activo' : 'Dado de Baja'}.`, 'info');
      if (state.currentView === 'admin') {
        const container = document.getElementById('viewContent');
        renderAdmin(container);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function eliminarUsuario(id) {
    const curActor = window.DataStore.getSesionActiva();
    if (!curActor || curActor.rol !== 'admin') {
      showToast('Acceso denegado: No tienes permisos para eliminar usuarios.', 'error');
      return;
    }

    const u = window.DataStore.getUsuario(id);
    if (!u) return;
    if (confirm(`¿Confirma eliminar permanentemente a ${u.nombre} (${u.email}) de la whitelist y de Supabase?`)) {
      try {
        window.DataStore.deleteUsuario(id);
        if (window.SupabaseService && window.SupabaseService.eliminarUsuario) {
          await window.SupabaseService.eliminarUsuario(id);
        }
        showToast(`Usuario ${u.nombre} eliminado permanentemente.`, 'info');
        if (state.currentView === 'admin') {
          const container = document.getElementById('viewContent');
          renderAdmin(container);
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  }

  function abrirModalLogin() {
    const body = document.getElementById('modalLoginBody');
    if (!body) return;

    const actual = window.DataStore.getUsuarioActual();
    const usuarios = window.DataStore.getUsuarios ? window.DataStore.getUsuarios() : [];

    body.innerHTML = `
      <div style="padding: 6px 0;">
        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; margin-bottom: 16px;">
          <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 800; color: var(--text-muted); margin-bottom: 4px;">Sesión Activa</div>
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-weight: 800; font-size: 0.96rem; color: var(--text-primary);">${actual ? escapeHtml(actual.nombre) : 'Nicolás Escudero'}</div>
              <div style="font-family: var(--font-mono); font-size: 0.76rem; color: var(--primary);">${actual ? escapeHtml(actual.email) : 'nicolasescudero5@gmail.com'}</div>
            </div>
            <span class="badge badge-primary" style="font-size: 0.72rem;">${actual && actual.rol === 'admin' ? '👑 Super Admin' : 'Usuario'}</span>
          </div>
        </div>

        <form id="formLoginAuth" onsubmit="event.preventDefault(); App.ejecutarLogin();">
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Correo Electrónico Autorizado</label>
            <input type="email" id="loginEmail" class="form-control" placeholder="nicolasescudero5@gmail.com" value="${actual ? escapeHtml(actual.email) : 'nicolasescudero5@gmail.com'}" required>
          </div>

          <div class="form-group" style="margin-bottom: 14px;">
            <label class="form-label">Contraseña</label>
            <input type="password" id="loginPassword" class="form-control" placeholder="admin123" value="admin123" required>
          </div>

          <div id="loginErrorMsg" style="display: none; color: var(--danger); font-size: 0.8rem; margin-bottom: 10px; font-weight: 600;"></div>

          <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; font-weight: 800; padding: 10px;">
            Validar Acceso y Entrar
          </button>
        </form>

        <div style="margin-top: 18px; border-top: 1px dashed var(--border-color); padding-top: 12px;">
          <div style="font-size: 0.74rem; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">Cambio rápido de perfil (Demo):</div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${usuarios.filter(u => u.estado === 'activo').map(u => `
              <button type="button" class="btn btn-secondary btn-sm" style="justify-content: flex-start; text-align: left; font-size: 0.74rem; padding: 6px 10px;" onclick="App.loginRapidoComo('${u.email}')">
                👤 <strong>${escapeHtml(u.nombre)}</strong> &nbsp;<span style="color:var(--text-muted); font-size:0.7rem;">(${escapeHtml(u.email)})</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    abrirModal('modalLogin');
  }

  function ejecutarLogin() {
    const email = document.getElementById('loginEmail')?.value?.trim();
    const pass = document.getElementById('loginPassword')?.value;
    const errBox = document.getElementById('loginErrorMsg');

    const res = window.DataStore.autenticarUsuario(email, pass);
    if (!res.ok) {
      if (errBox) {
        errBox.textContent = res.error;
        errBox.style.display = 'block';
      }
      return;
    }

    if (errBox) errBox.style.display = 'none';
    cerrarModal('modalLogin');
    aplicarPermisosUsuarioSesion(res.usuario);
    switchView(state.currentView || 'ctacte');
    showToast(`¡Bienvenido/a ${res.usuario.nombre}! Acceso autorizado.`);
  }

  function loginRapidoComo(email) {
    const u = window.DataStore.getUsuarioByEmail(email);
    if (u) {
      window.DataStore.setUsuarioActual(u);
      cerrarModal('modalLogin');
      aplicarPermisosUsuarioSesion(u);
      switchView(state.currentView || 'ctacte');
      showToast(`Cambiado a usuario: ${u.nombre}`);
    }
  }

  function actualizarInfoUsuarioSesion(u) {
    if (!u) return;

    const sName = document.getElementById('sidebarUserName');
    if (sName) sName.textContent = u.nombre || u.email;

    const sRole = document.getElementById('sidebarUserRole');
    if (sRole) sRole.textContent = u.email;

    const sTag = document.getElementById('sidebarUserTag');
    if (sTag) {
      if (u.rol === 'admin') {
        sTag.textContent = 'Admin';
        sTag.style.background = '#6366f1';
        sTag.style.color = '#ffffff';
      } else if (u.rol === 'socio') {
        sTag.textContent = 'Socio';
        sTag.style.background = '#2563eb';
        sTag.style.color = '#ffffff';
      } else {
        sTag.textContent = 'Operador';
        sTag.style.background = '#059669';
        sTag.style.color = '#ffffff';
      }
    }

    const sAvatar = document.getElementById('sidebarUserAvatar');
    if (sAvatar) sAvatar.textContent = (u.nombre || u.email || 'U').slice(0, 2).toUpperCase();

    // Control estricto de visibilidad del menú "Seguridad & Admin"
    const navSectionAdmin = document.getElementById('navSectionAdmin');
    const navItemAdmin = document.getElementById('navItemAdmin');
    const esAdmin = (u.rol === 'admin');

    if (navSectionAdmin) {
      navSectionAdmin.style.display = esAdmin ? 'block' : 'none';
    }
    if (navItemAdmin) {
      navItemAdmin.style.display = esAdmin ? 'flex' : 'none';
    }

    // Si el usuario logueado NO es admin pero estaba en la vista de administración, expulsar a ctacte
    if (!esAdmin && state.currentView === 'admin') {
      switchView('ctacte');
    }
  }

  function aplicarPermisosUsuarioSesion(u) {
    if (!u) return;
    actualizarInfoUsuarioSesion(u);

    const socioRestringido = window.DataStore.getSocioRestringido ? window.DataStore.getSocioRestringido() : null;
    if (socioRestringido) {
      state.activeVendedorId = socioRestringido;
    } else {
      if (state.activeVendedorId !== 'todos' && !window.DataStore.getVendedor(state.activeVendedorId)) {
        state.activeVendedorId = 'todos';
      }
    }

    actualizarSelectorVendedoresTopbar();
    actualizarBadgesNav();

    // Sincronizar cliente seleccionado según la cartera accesible
    const clientes = window.DataStore.getClientes({ vendedorId: state.activeVendedorId });
    if (clientes.length > 0) {
      const exists = clientes.some(c => c.id === state.selectedClienteId);
      if (!exists) {
        const deudor = clientes.find(c => c.saldoActual > 0) || clientes[0];
        state.selectedClienteId = deudor.id;
      }
    } else {
      state.selectedClienteId = '';
    }
  }

  function onUserPillClick() {
    const u = window.DataStore.getSesionActiva();
    if (u && u.rol === 'admin') {
      switchView('admin');
    } else if (u) {
      showToast(`Sesión: ${u.nombre} (${u.rol === 'operador' ? 'Operador Comercial' : 'Socio'})`, 'info');
    }
  }

  // =============================================================
  // MODAL 1: CARGA SIMPLIFICADA DE VENTA CÁRNICA
  // =============================================================
  function abrirModalVenta(clienteIdPre = '') {
    const clientes = window.DataStore.getClientes({ vendedorId: state.activeVendedorId });
    const defaultCli = clienteIdPre || (clientes[0] ? clientes[0].id : '');

    state.nuevaVenta = {
      clienteId: defaultCli,
      fechaEmision: new Date().toISOString().split('T')[0],
      corte: '1/2 RES',
      pesos: [88, 87, 85, 85],
      precioKg: 6900,
      observaciones: 'Despacho cárnico frigorífico'
    };

    renderModalVentaContent();
    abrirModal('modalVenta');
  }

  function parsePesosInput(str) {
    if (!str) return [];
    // Normalizar coma decimal ej: "87,5" -> "87.5"
    const normalized = String(str).trim().replace(/(\d+),(\d{1,2})(?!\d)/g, '$1.$2');
    return normalized
      .split(/[\s,;]+/)
      .map(Number)
      .filter(n => !isNaN(n) && n > 0);
  }

  function renderModalVentaContent() {
    const body = document.getElementById('modalVentaBody');
    if (!body) return;

    const nv = state.nuevaVenta;
    const cliActual = window.DataStore.getCliente(nv.clienteId);

    const pesos = nv.pesos || [];
    const totalKg = pesos.reduce((a, b) => a + b, 0);
    const cantCortes = pesos.length;
    const totalVenta = Math.round(totalKg * (Number(nv.precioKg) || 0));
    const saldoPrevio = cliActual ? cliActual.saldoActual : 0;
    const nuevoSaldo = saldoPrevio + totalVenta;

    const cortesRapidos = ['1/2 RES', 'MOCHO', 'PECHO', 'CHEMO', 'TRINIDAD', 'GOLF', 'ASADO', 'BIFE', 'BRUCHI', 'DELANT', 'PARRI'];

    body.innerHTML = `
      <form id="formNuevaVenta" onsubmit="event.preventDefault(); App.guardarNuevaVenta();">
        <div class="form-row">
          <!-- Búsqueda Desplegable de Cliente en Tiempo Real -->
          <div class="form-group" style="flex: 2; position: relative;">
            <label class="form-label">Cliente <span class="required">*</span></label>
            <div class="searchable-select-container" id="ventaClienteSelectContainer">
              <div class="searchable-input-wrapper">
                <input type="text" 
                       id="nvClienteSearch" 
                       class="form-control searchable-input" 
                       autocomplete="off" 
                       placeholder="🔍 Escriba para buscar cliente..." 
                       value="${cliActual ? escapeHtml(cliActual.razonSocial) : ''}" 
                       onfocus="App.abrirDropdownClienteVenta()" 
                       oninput="App.filtrarDropdownClienteVenta(this.value)"
                       onkeydown="App.onKeydownClienteVenta(event)">
                <div class="searchable-actions-wrapper">
                  <button type="button" class="searchable-clear-btn" onclick="App.limpiarBusquedaClienteVenta()" title="Borrar búsqueda">✕</button>
                  <button type="button" class="searchable-arrow-btn" id="nvArrowBtn" onclick="App.toggleDropdownClienteVenta()" title="Ver lista completa">▼</button>
                </div>
              </div>
              <div class="searchable-dropdown" id="nvClienteDropdown" style="display: none;"></div>
            </div>
            <input type="hidden" id="nvClienteId" value="${nv.clienteId}">
          </div>

          <div class="form-group" style="flex: 1;">
            <label class="form-label">Fecha de Venta <span class="required">*</span></label>
            <input type="date" id="nvFechaEmision" class="form-control" value="${nv.fechaEmision}" onchange="state.nuevaVenta.fechaEmision = this.value" required>
          </div>
        </div>

        <!-- Tipo de Corte con Botones Rápidos -->
        <div class="form-group">
          <label class="form-label">Tipo de Corte Cárnico:</label>
          <div class="corte-selector-chips">
            ${cortesRapidos.map(c => `
              <button type="button" class="corte-chip-btn ${nv.corte === c ? 'active' : ''}" onclick="App.seleccionarCorteVenta('${c}')">
                ${c}
              </button>
            `).join('')}
          </div>
          <input type="text" id="nvCorteCustom" class="form-control" value="${escapeHtml(nv.corte)}" placeholder="O escriba otro corte..." oninput="state.nuevaVenta.corte = this.value; App.actualizarBotonesCorte();">
        </div>

        <!-- Carga Ágil de Kilaje en Chips -->
        <div class="form-group">
          <label class="form-label" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
            <span>Kilaje Individual de cada Corte (kg):</span>
            <span style="font-size: 0.74rem; color: var(--text-muted);">Enter o coma para agregar chip</span>
          </label>
          
          <div class="pesos-input-group">
            <input type="text" 
                   id="nvInputNuevoPeso" 
                   class="form-control" 
                   style="font-family: var(--font-mono); font-size: 1rem; font-weight: 700;" 
                   placeholder="Ej: 88 (Enter o coma para agregar)" 
                   autocomplete="off" 
                   onkeydown="App.onNuevoPesoKeydown(event)">
            <button type="button" class="btn btn-primary" onclick="App.agregarPesoDesdeInput()" style="white-space: nowrap; padding: 0 16px;">
              <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
              + Agregar
            </button>
          </div>

          <!-- Contenedor visual de Chips -->
          <div class="pesos-chips-wrapper">
            <div class="pesos-chips-header">
              <span>Cortes cargados (<strong id="nvChipsCount">${cantCortes}</strong>):</span>
              ${cantCortes > 0 ? `
                <button type="button" class="pesos-chips-clear-btn" id="btnLimpiarPesos" onclick="App.limpiarTodosLosPesosVenta()">Limpiar todos</button>
              ` : `
                <button type="button" class="pesos-chips-clear-btn" id="btnLimpiarPesos" style="display:none;" onclick="App.limpiarTodosLosPesosVenta()">Limpiar todos</button>
              `}
            </div>
            <div class="pesos-chips-container" id="nvChipsContainer">
              ${renderChipsHtml(pesos)}
            </div>
          </div>
          
          <!-- Resumen en Tiempo Real de Cortes y Kilos -->
          <div class="pesos-display-box">
            <div>
              <span style="font-size: 0.8rem; color: var(--text-secondary);">Cantidad de Cortes:</span>
              <strong id="dispCantCortes" style="font-size: 1.05rem; color: var(--text-primary); margin-left: 5px;">${cantCortes}</strong>
            </div>
            <div>
              <span style="font-size: 0.8rem; color: var(--text-secondary);">Total Kilos:</span>
              <strong id="dispTotalKg" style="font-size: 1.2rem; color: #0f172a; font-family: var(--font-mono); margin-left: 5px;">${totalKg.toLocaleString()} kg</strong>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group" style="flex: 1;">
            <label class="form-label">Precio por Kilo ($/kg) <span class="required">*</span></label>
            <input type="number" id="nvPrecioKg" class="form-control" style="font-family: var(--font-mono); font-size: 1rem; font-weight: 700;" value="${nv.precioKg}" min="1" step="50" oninput="App.onPrecioVentaInput(this.value)" required>
          </div>

          <div class="form-group" style="flex: 1;">
            <label class="form-label">Total Venta Calculado ($)</label>
            <div id="dispTotalVenta" style="background: #f1f5f9; padding: 10px 14px; border-radius: var(--radius-sm); font-size: 1.25rem; font-weight: 800; color: var(--text-primary); text-align: right; border: 1px solid var(--border-color);">
              ${formatMoney(totalVenta)}
            </div>
          </div>
        </div>

        <!-- Impacto en Cuenta Corriente -->
        <div style="background: #f8fafc; border: 1.5px dashed var(--border-color); border-radius: var(--radius-md); padding: 12px 16px; margin-top: 6px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 4px;">
            <span>Deuda actual del cliente:</span>
            <strong id="dispDeudaActual">${formatMoney(saldoPrevio)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.95rem; font-weight: 800; color: var(--danger); border-top: 1px solid #e2e8f0; padding-top: 6px;">
            <span>Nuevo Saldo Estimado:</span>
            <span id="dispNuevoSaldo">${formatMoney(nuevoSaldo)}</span>
          </div>
        </div>
      </form>
    `;
  }

  function renderChipsHtml(pesos) {
    if (!pesos || pesos.length === 0) {
      return `<div class="pesos-chips-empty">No hay cortes agregados aún. Escriba un kilaje y presione Enter o "+ Agregar".</div>`;
    }
    return pesos.map((p, idx) => `
      <span class="peso-chip" data-idx="${idx}">
        <span class="peso-chip-index">#${idx + 1}</span>
        <span class="peso-chip-val">${p} kg</span>
        <button type="button" class="peso-chip-remove" onclick="App.eliminarPesoVenta(${idx})" title="Eliminar corte #${idx + 1} (${p} kg)">✕</button>
      </span>
    `).join('');
  }

  function agregarPesoDesdeInput() {
    const inp = document.getElementById('nvInputNuevoPeso');
    if (!inp) return;
    const raw = inp.value;
    const values = parsePesosInput(raw);
    if (values.length > 0) {
      if (!state.nuevaVenta.pesos) state.nuevaVenta.pesos = [];
      state.nuevaVenta.pesos.push(...values);
      inp.value = '';
      actualizarChipsYCalculosVenta();
    }
    inp.focus();
  }

  function onNuevoPesoKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      agregarPesoDesdeInput();
    } else if (e.key === ',') {
      setTimeout(() => {
        const inp = document.getElementById('nvInputNuevoPeso');
        if (inp && inp.value.includes(',')) {
          if (/^\d+,$/.test(inp.value.trim())) {
            inp.value = inp.value.replace(',', '');
            agregarPesoDesdeInput();
          }
        }
      }, 10);
    }
  }

  function eliminarPesoVenta(idx) {
    if (state.nuevaVenta.pesos && state.nuevaVenta.pesos.length > idx) {
      state.nuevaVenta.pesos.splice(idx, 1);
      actualizarChipsYCalculosVenta();
    }
  }

  function limpiarTodosLosPesosVenta() {
    state.nuevaVenta.pesos = [];
    actualizarChipsYCalculosVenta();
    const inp = document.getElementById('nvInputNuevoPeso');
    if (inp) inp.focus();
  }

  function actualizarChipsYCalculosVenta() {
    const pesos = state.nuevaVenta.pesos || [];
    const container = document.getElementById('nvChipsContainer');
    const badgeCount = document.getElementById('nvChipsCount');
    const btnLimpiar = document.getElementById('btnLimpiarPesos');

    if (container) container.innerHTML = renderChipsHtml(pesos);
    if (badgeCount) badgeCount.textContent = pesos.length;
    if (btnLimpiar) btnLimpiar.style.display = pesos.length > 0 ? 'inline-block' : 'none';

    actualizarCalculosVentaModal();
  }

  function seleccionarCorteVenta(corte) {
    state.nuevaVenta.corte = corte;
    const inp = document.getElementById('nvCorteCustom');
    if (inp) inp.value = corte;
    actualizarBotonesCorte();
  }

  function actualizarBotonesCorte() {
    document.querySelectorAll('.corte-chip-btn').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.trim() === state.nuevaVenta.corte);
    });
  }

  function onPrecioVentaInput(precio) {
    state.nuevaVenta.precioKg = Number(precio) || 0;
    actualizarCalculosVentaModal();
  }

  function actualizarCalculosVentaModal() {
    const pesos = state.nuevaVenta.pesos || [];
    const totalKg = pesos.reduce((a, b) => a + b, 0);
    const cantCortes = pesos.length;
    const totalVenta = Math.round(totalKg * (Number(state.nuevaVenta.precioKg) || 0));

    const cli = window.DataStore.getCliente(state.nuevaVenta.clienteId);
    const saldoPrevio = cli ? cli.saldoActual : 0;
    const nuevoSaldo = saldoPrevio + totalVenta;

    const elCortes = document.getElementById('dispCantCortes');
    const elKg = document.getElementById('dispTotalKg');
    const elVta = document.getElementById('dispTotalVenta');
    const elDeuda = document.getElementById('dispDeudaActual');
    const elNvoSaldo = document.getElementById('dispNuevoSaldo');

    if (elCortes) elCortes.textContent = cantCortes;
    if (elKg) elKg.textContent = `${totalKg.toLocaleString()} kg`;
    if (elVta) elVta.textContent = formatMoney(totalVenta);
    if (elDeuda) elDeuda.textContent = formatMoney(saldoPrevio);
    if (elNvoSaldo) elNvoSaldo.textContent = formatMoney(nuevoSaldo);
  }

  // --- Searchable Dropdown de Cliente en Venta ---
  function abrirDropdownClienteVenta() {
    const inp = document.getElementById('nvClienteSearch');
    filtrarDropdownClienteVenta(inp ? inp.value : '');
  }

  function cerrarDropdownClienteVenta() {
    const dd = document.getElementById('nvClienteDropdown');
    const arrow = document.getElementById('nvArrowBtn');
    if (dd) dd.style.display = 'none';
    if (arrow) arrow.classList.remove('open');
  }

  function toggleDropdownClienteVenta() {
    const dd = document.getElementById('nvClienteDropdown');
    if (dd && dd.style.display === 'block') {
      cerrarDropdownClienteVenta();
    } else {
      abrirDropdownClienteVenta();
    }
  }

  function filtrarDropdownClienteVenta(query) {
    const dd = document.getElementById('nvClienteDropdown');
    const arrow = document.getElementById('nvArrowBtn');
    if (!dd) return;

    const q = (query || '').toLowerCase().trim();
    const clientes = window.DataStore.getClientes({ vendedorId: state.activeVendedorId });
    const filtrados = q 
      ? clientes.filter(c => 
          c.razonSocial.toLowerCase().includes(q) ||
          (c.contactoNombre && c.contactoNombre.toLowerCase().includes(q)) ||
          (c.vendedorNombre && c.vendedorNombre.toLowerCase().includes(q)) ||
          (c.id && c.id.toLowerCase().includes(q))
        )
      : clientes;

    if (filtrados.length === 0) {
      dd.innerHTML = `<div class="searchable-dropdown-empty">No se encontraron clientes para "<strong>${escapeHtml(query)}</strong>"</div>`;
    } else {
      dd.innerHTML = filtrados.map(c => `
        <div class="searchable-dropdown-item ${c.id === state.nuevaVenta.clienteId ? 'selected' : ''}" 
             onclick="App.seleccionarClienteVenta('${c.id}')">
          <div class="searchable-item-row1">
            <span class="searchable-item-name">${escapeHtml(c.razonSocial)}</span>
            <span class="vendedor-badge" style="background: ${c.vendedorColor}20; color: ${c.vendedorColor};">
              👤 ${escapeHtml(c.vendedorNombre)}
            </span>
          </div>
          <div class="searchable-item-row2">
            <span>${c.contactoNombre ? escapeHtml(c.contactoNombre) + ' • ' : ''}${c.telefono || 'Sin tel'}</span>
            <span class="searchable-item-saldo ${c.saldoActual > 0 ? 'text-danger' : 'text-success'}">
              ${c.saldoActual > 0 ? 'Debe: ' + formatMoney(c.saldoActual) : 'Al día ($0)'}
            </span>
          </div>
        </div>
      `).join('');
    }

    dd.style.display = 'block';
    if (arrow) arrow.classList.add('open');
  }

  function limpiarBusquedaClienteVenta() {
    const inp = document.getElementById('nvClienteSearch');
    if (inp) {
      inp.value = '';
      inp.focus();
    }
    filtrarDropdownClienteVenta('');
  }

  function seleccionarClienteVenta(clienteId) {
    state.nuevaVenta.clienteId = clienteId;
    const cli = window.DataStore.getCliente(clienteId);
    const inp = document.getElementById('nvClienteSearch');
    if (inp && cli) inp.value = cli.razonSocial;
    const hid = document.getElementById('nvClienteId');
    if (hid) hid.value = clienteId;
    cerrarDropdownClienteVenta();
    actualizarCalculosVentaModal();
  }

  function onKeydownClienteVenta(event) {
    if (event.key === 'Escape') {
      cerrarDropdownClienteVenta();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const dd = document.getElementById('nvClienteDropdown');
      const firstItem = dd ? dd.querySelector('.searchable-dropdown-item') : null;
      if (firstItem) {
        firstItem.click();
      }
    }
  }

  function onClienteChangeVenta(clienteId) {
    seleccionarClienteVenta(clienteId);
  }

  function onPesosVentaInput(text) {
    state.nuevaVenta.pesos = parsePesosInput(text);
    actualizarChipsYCalculosVenta();
  }

  function guardarNuevaVenta() {
    const nv = state.nuevaVenta;
    if (!nv.clienteId) {
      showToast('Por favor seleccione un cliente de la lista.', 'danger');
      return;
    }

    const pesos = nv.pesos || [];
    if (pesos.length === 0) {
      showToast('Por favor agregue los cortes cárnicos con su kilaje.', 'danger');
      const inp = document.getElementById('nvInputNuevoPeso');
      if (inp) inp.focus();
      return;
    }

    if (!nv.precioKg || nv.precioKg <= 0) {
      showToast('Ingrese un precio por kilo válido.', 'danger');
      return;
    }

    try {
      const vta = window.DataStore.saveVenta({
        clienteId: nv.clienteId,
        fechaEmision: nv.fechaEmision,
        corte: nv.corte || '1/2 RES',
        pesos: pesos,
        precioKg: nv.precioKg,
        observaciones: nv.observaciones
      });

      cerrarModal('modalVenta');
      showToast(`¡Venta ${vta.numero} registrada exitosamente por ${formatMoney(vta.total)}!`);

      // Refrescar vista activa
      state.selectedClienteId = nv.clienteId;
      switchView(state.currentView, { clienteId: nv.clienteId });
    } catch (e) {
      showToast(e.message || 'Error al guardar venta.', 'danger');
    }
  }

  // =============================================================
  // MODAL 2: REGISTRO SIMPLIFICADO DE PAGO (CON FIFO)
  // =============================================================
  function abrirModalCobranza(clienteIdPre = '', ventaIdPre = '') {
    const clientes = window.DataStore.getClientes({ vendedorId: state.activeVendedorId });
    const defaultCli = clienteIdPre || (clientes[0] ? clientes[0].id : '');
    const cli = window.DataStore.getCliente(defaultCli);

    let montoSugerido = cli ? Math.max(0, cli.saldoActual) : 0;
    if (ventaIdPre) {
      const v = window.DataStore.getVenta(ventaIdPre);
      if (v) montoSugerido = v.saldoPendiente;
    }

    state.nuevaCobranza = {
      clienteId: defaultCli,
      fecha: new Date().toISOString().split('T')[0],
      monto: montoSugerido,
      metodo: 'Transferencia',
      montoEfectivo: 0,
      montoTransf: 0,
      observaciones: '',
      ventaIdEspecifica: ventaIdPre,
      modoImputacion: 'fifo'
    };

    renderModalCobranzaContent();
    abrirModal('modalCobranza');
  }

  function renderModalCobranzaContent() {
    const body = document.getElementById('modalCobranzaBody');
    if (!body) return;

    const nc = state.nuevaCobranza;
    const cli = window.DataStore.getCliente(nc.clienteId);
    const saldoActual = cli ? cli.saldoActual : 0;

    body.innerHTML = `
      <form id="formNuevaCobranza" onsubmit="event.preventDefault(); App.guardarNuevaCobranza();">
        <div class="form-row">
          <!-- Búsqueda Desplegable de Cliente en Cobranza -->
          <div class="form-group" style="flex: 2; position: relative;">
            <label class="form-label">Cliente que realiza el Pago <span class="required">*</span></label>
            <div class="searchable-select-container" id="cobranzaClienteSelectContainer">
              <div class="searchable-input-wrapper">
                <input type="text" 
                       id="ncClienteSearch" 
                       class="form-control searchable-input" 
                       autocomplete="off" 
                       placeholder="🔍 Escriba para buscar cliente..." 
                       value="${cli ? escapeHtml(cli.razonSocial) : ''}" 
                       onfocus="App.abrirDropdownClienteCobranza()" 
                       oninput="App.filtrarDropdownClienteCobranza(this.value)"
                       onkeydown="App.onKeydownClienteCobranza(event)">
                <div class="searchable-actions-wrapper">
                  <button type="button" class="searchable-clear-btn" onclick="App.limpiarBusquedaClienteCobranza()" title="Borrar búsqueda">✕</button>
                  <button type="button" class="searchable-arrow-btn" id="ncArrowBtn" onclick="App.toggleDropdownClienteCobranza()" title="Ver lista completa">▼</button>
                </div>
              </div>
              <div class="searchable-dropdown" id="ncClienteDropdown" style="display: none;"></div>
            </div>
            <input type="hidden" id="ncClienteId" value="${nc.clienteId}">
          </div>

          <div class="form-group" style="flex: 1;">
            <label class="form-label">Fecha del Pago <span class="required">*</span></label>
            <input type="date" id="ncFecha" class="form-control" value="${nc.fecha}" onchange="state.nuevaCobranza.fecha = this.value" required>
          </div>
        </div>

        <!-- Monto a Pagar -->
        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 5px;">
            <label class="form-label" style="margin-bottom: 0;">Monto Cobrado ($) <span class="required">*</span></label>
            ${saldoActual > 0 ? `
              <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.75rem;" onclick="App.setMontoTotalDeuda(${saldoActual})">
                Cobrar Deuda Total (${formatMoney(saldoActual)})
              </button>
            ` : ''}
          </div>
          <input type="number" id="ncMonto" class="form-control" style="font-family: var(--font-mono); font-size: 1.25rem; font-weight: 800; color: #059669;" value="${nc.monto}" min="1" step="1000" oninput="App.onMontoCobranzaInput(this.value)" required>
        </div>

        <!-- Medio de Pago: Desplegable -->
        <div class="form-group">
          <label class="form-label">Medio de Pago <span class="required">*</span></label>
          <select id="ncMetodoSelect" class="form-control" onchange="App.onMetodoCobranzaSelectChange(this.value)" style="font-weight: 600;">
            <option value="Transferencia" ${nc.metodo === 'Transferencia' ? 'selected' : ''}>🏦 Transferencia Bancaria</option>
            <option value="Efectivo" ${nc.metodo === 'Efectivo' ? 'selected' : ''}>💵 Efectivo</option>
            <option value="Cheque" ${nc.metodo === 'Cheque' ? 'selected' : ''}>💳 Cheque</option>
            <option value="Mixto" ${nc.metodo === 'Mixto' ? 'selected' : ''}>⚖️ Mixto (Efectivo y Transferencia)</option>
            <option value="Depósito" ${nc.metodo === 'Depósito' ? 'selected' : ''}>🏛️ Depósito en Cuenta</option>
          </select>
        </div>

        ${nc.metodo === 'Mixto' ? `
          <div style="background: #f8fafc; border: 1.5px dashed var(--border-color); border-radius: var(--radius-sm); padding: 12px 14px; margin-bottom: 14px;">
            <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px;">
              Desglose de Pago Mixto (Efectivo + Transferencia):
            </div>
            <div class="form-row">
              <div class="form-group" style="flex: 1; margin-bottom: 0;">
                <label class="form-label" style="font-size: 0.74rem;">Parte Efectivo ($)</label>
                <input type="number" id="ncMontoEfectivo" class="form-control" style="font-family: var(--font-mono); font-weight: 700;" value="${nc.montoEfectivo || ''}" placeholder="0" min="0" oninput="App.onMontoMixtoInput()">
              </div>
              <div class="form-group" style="flex: 1; margin-bottom: 0;">
                <label class="form-label" style="font-size: 0.74rem;">Parte Transferencia ($)</label>
                <input type="number" id="ncMontoTransf" class="form-control" style="font-family: var(--font-mono); font-weight: 700;" value="${nc.montoTransf || ''}" placeholder="0" min="0" oninput="App.onMontoMixtoInput()">
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Observación Aparte Opcional -->
        <div class="form-group">
          <label class="form-label">Observaciones o Referencia <span style="font-weight: normal; color: var(--text-muted); font-size: 0.78rem;">(Opcional)</span></label>
          <input type="text" id="ncObservaciones" class="form-control" value="${escapeHtml(nc.observaciones || '')}" placeholder="Ej: Transf Galicia #4829, entrega en flete, etc." oninput="state.nuevaCobranza.observaciones = this.value">
        </div>

        <!-- Vista Previa de Imputación FIFO -->
        <div id="fifoPreviewContainer">
          ${renderFifoPreviewHtml(nc.clienteId, nc.monto)}
        </div>
      </form>
    `;
  }

  function renderFifoPreviewHtml(clienteId, monto) {
    const ventasImpagas = (window.DataStore.data.ventas || [])
      .filter(v => v.clienteId === clienteId && (v.saldoPendiente || 0) > 0.01)
      .sort((a, b) => new Date(a.fechaEmision) - new Date(b.fechaEmision));

    let rem = Number(monto) || 0;
    const ventasPreview = [];
    for (const v of ventasImpagas) {
      if (rem <= 0) break;
      const cob = Math.min(rem, v.saldoPendiente);
      ventasPreview.push({
        numero: v.numero,
        fecha: v.fechaEmision,
        corte: v.corte,
        pendienteOriginal: v.saldoPendiente,
        imputado: cob,
        quedara: v.saldoPendiente - cob
      });
      rem -= cob;
    }

    return `
      <div class="fifo-preview-card">
        <div class="fifo-title">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          Impacto Automático FIFO (Aplicación a las ventas más viejas):
        </div>
        ${ventasPreview.length === 0 ? `
          <div style="font-size: 0.8rem; color: #166534;">El cliente no tiene ventas pendientes. El importe quedará registrado como <strong>saldo a favor</strong> para futuras compras.</div>
        ` : `
          <div>
            ${ventasPreview.map(vp => `
              <div class="fifo-item">
                <span>Venta <strong>${vp.numero}</strong> (${vp.corte} - ${formatDate(vp.fecha)})</span>
                <span>
                  Cancela <strong>${formatMoney(vp.imputado)}</strong>
                  ${vp.quedara <= 0.01 ? '<span class="badge badge-success" style="font-size:0.65rem; padding:1px 4px; margin-left:4px;">Total</span>' : `<span style="font-size:0.72rem; color:var(--text-muted); margin-left:4px;">(Resta ${formatMoney(vp.quedara)})</span>`}
                </span>
              </div>
            `).join('')}
            ${rem > 0 ? `
              <div style="margin-top: 6px; font-size: 0.78rem; color: #047857; font-weight: 700;">
                Remanente como saldo a favor en cuenta corriente: ${formatMoney(rem)}
              </div>
            ` : ''}
          </div>
        `}
      </div>
    `;
  }

  function actualizarFifoPreview() {
    const container = document.getElementById('fifoPreviewContainer');
    if (container) {
      container.innerHTML = renderFifoPreviewHtml(state.nuevaCobranza.clienteId, state.nuevaCobranza.monto);
    }
  }

  // --- Searchable Dropdown de Cliente en Cobranza ---
  function abrirDropdownClienteCobranza() {
    const inp = document.getElementById('ncClienteSearch');
    filtrarDropdownClienteCobranza(inp ? inp.value : '');
  }

  function cerrarDropdownClienteCobranza() {
    const dd = document.getElementById('ncClienteDropdown');
    const arrow = document.getElementById('ncArrowBtn');
    if (dd) dd.style.display = 'none';
    if (arrow) arrow.classList.remove('open');
  }

  function toggleDropdownClienteCobranza() {
    const dd = document.getElementById('ncClienteDropdown');
    if (dd && dd.style.display === 'block') {
      cerrarDropdownClienteCobranza();
    } else {
      abrirDropdownClienteCobranza();
    }
  }

  function filtrarDropdownClienteCobranza(query) {
    const dd = document.getElementById('ncClienteDropdown');
    const arrow = document.getElementById('ncArrowBtn');
    if (!dd) return;

    const q = (query || '').toLowerCase().trim();
    const clientes = window.DataStore.getClientes({ vendedorId: state.activeVendedorId });
    const filtrados = q 
      ? clientes.filter(c => 
          c.razonSocial.toLowerCase().includes(q) ||
          (c.contactoNombre && c.contactoNombre.toLowerCase().includes(q)) ||
          (c.vendedorNombre && c.vendedorNombre.toLowerCase().includes(q)) ||
          (c.id && c.id.toLowerCase().includes(q))
        )
      : clientes;

    if (filtrados.length === 0) {
      dd.innerHTML = `<div class="searchable-dropdown-empty">No se encontraron clientes para "<strong>${escapeHtml(query)}</strong>"</div>`;
    } else {
      dd.innerHTML = filtrados.map(c => `
        <div class="searchable-dropdown-item ${c.id === state.nuevaCobranza.clienteId ? 'selected' : ''}" 
             onclick="App.seleccionarClienteCobranza('${c.id}')">
          <div class="searchable-item-row1">
            <span class="searchable-item-name">${escapeHtml(c.razonSocial)}</span>
            <span class="vendedor-badge" style="background: ${c.vendedorColor}20; color: ${c.vendedorColor};">
              👤 ${escapeHtml(c.vendedorNombre)}
            </span>
          </div>
          <div class="searchable-item-row2">
            <span>${c.contactoNombre ? escapeHtml(c.contactoNombre) + ' • ' : ''}${c.telefono || 'Sin tel'}</span>
            <span class="searchable-item-saldo ${c.saldoActual > 0 ? 'text-danger' : 'text-success'}">
              ${c.saldoActual > 0 ? 'Debe: ' + formatMoney(c.saldoActual) : 'Al día ($0)'}
            </span>
          </div>
        </div>
      `).join('');
    }

    dd.style.display = 'block';
    if (arrow) arrow.classList.add('open');
  }

  function limpiarBusquedaClienteCobranza() {
    const inp = document.getElementById('ncClienteSearch');
    if (inp) {
      inp.value = '';
      inp.focus();
    }
    filtrarDropdownClienteCobranza('');
  }

  function seleccionarClienteCobranza(clienteId) {
    state.nuevaCobranza.clienteId = clienteId;
    const cli = window.DataStore.getCliente(clienteId);
    state.nuevaCobranza.monto = cli ? Math.max(0, cli.saldoActual) : 0;
    renderModalCobranzaContent();
    const inp = document.getElementById('ncClienteSearch');
    if (inp && cli) inp.value = cli.razonSocial;
  }


  function onKeydownClienteCobranza(event) {
    if (event.key === 'Escape') {
      cerrarDropdownClienteCobranza();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const dd = document.getElementById('ncClienteDropdown');
      const firstItem = dd ? dd.querySelector('.searchable-dropdown-item') : null;
      if (firstItem) {
        firstItem.click();
      }
    }
  }

  function onClienteChangeCobranza(clienteId) {
    seleccionarClienteCobranza(clienteId);
  }

  function setMontoTotalDeuda(monto) {
    state.nuevaCobranza.monto = monto;
    const inp = document.getElementById('ncMonto');
    if (inp) inp.value = monto;
    actualizarFifoPreview();
  }

  function onMontoCobranzaInput(val) {
    state.nuevaCobranza.monto = Number(val) || 0;
    actualizarFifoPreview();
  }

  function onMetodoCobranzaSelectChange(metodo) {
    state.nuevaCobranza.metodo = metodo;
    renderModalCobranzaContent();
  }

  function seleccionarMetodoCobranza(metodo) {
    onMetodoCobranzaSelectChange(metodo);
  }

  function onMontoMixtoInput() {
    const ef = Number(document.getElementById('ncMontoEfectivo')?.value) || 0;
    const tr = Number(document.getElementById('ncMontoTransf')?.value) || 0;
    state.nuevaCobranza.montoEfectivo = ef;
    state.nuevaCobranza.montoTransf = tr;
    if (ef + tr > 0) {
      state.nuevaCobranza.monto = ef + tr;
      const inp = document.getElementById('ncMonto');
      if (inp) inp.value = ef + tr;
      actualizarFifoPreview();
    }
  }

  function guardarNuevaCobranza() {
    const nc = state.nuevaCobranza;
    if (!nc.clienteId) {
      showToast('Seleccione un cliente.', 'danger');
      return;
    }

    if (!nc.monto || nc.monto <= 0) {
      showToast('Ingrese un monto a cobrar válido mayor a cero.', 'danger');
      return;
    }

    try {
      const res = window.DataStore.registrarPago({
        clienteId: nc.clienteId,
        fecha: nc.fecha,
        monto: nc.monto,
        metodo: nc.metodo,
        efectivo: nc.montoEfectivo || 0,
        transferencia: nc.montoTransf || 0,
        observaciones: nc.observaciones,
        ventaIdEspecifica: nc.ventaIdEspecifica,
        modoImputacion: nc.modoImputacion
      });

      cerrarModal('modalCobranza');
      showToast(`¡Pago de ${formatMoney(res.cobranza.totalCobrado)} registrado y aplicado a las ventas con éxito!`);

      // Refrescar
      state.selectedClienteId = nc.clienteId;
      switchView(state.currentView, { clienteId: nc.clienteId });
    } catch (e) {
      showToast(e.message || 'Error al guardar el pago.', 'danger');
    }
  }

  // =============================================================
  // MODAL 3: RECLAMO WHATSAPP
  // =============================================================
  function abrirModalReclamo(clienteId) {
    state.modalReclamo.clienteId = clienteId;
    state.modalReclamo.plantilla = 'operativo';
    renderModalReclamoContent();
    abrirModal('modalReclamoWhatsApp');
  }

  function renderModalReclamoContent() {
    const body = document.getElementById('modalReclamoWhatsAppBody');
    const footer = document.getElementById('modalReclamoWhatsAppFooter');
    if (!body || !footer) return;

    const cli = window.DataStore.getCliente(state.modalReclamo.clienteId);
    if (!cli) return;

    const mensaje = window.DataStore.getMensajeReclamo(cli.id, state.modalReclamo.plantilla);
    const phoneClean = (cli.telefono || '').replace(/[^0-9]/g, '');
    const waUrl = `https://wa.me/${phoneClean}?text=${encodeURIComponent(mensaje)}`;

    body.innerHTML = `
      <!-- Selector de Plantilla -->
      <div style="margin-bottom: 12px;">
        <label class="form-label">Seleccionar Tipo de Mensaje:</label>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn btn-sm ${state.modalReclamo.plantilla === 'amable' ? 'btn-primary' : 'btn-secondary'}" onclick="App.cambiarPlantillaReclamo('amable')">
            😊 Amable / Recordatorio
          </button>
          <button type="button" class="btn btn-sm ${state.modalReclamo.plantilla === 'operativo' ? 'btn-primary' : 'btn-secondary'}" onclick="App.cambiarPlantillaReclamo('operativo')">
            🥩 Operativo con Cortes & CBU
          </button>
          <button type="button" class="btn btn-sm ${state.modalReclamo.plantilla === 'intimacion' ? 'btn-primary' : 'btn-secondary'}" onclick="App.cambiarPlantillaReclamo('intimacion')">
            🚨 Aviso de Suspensión de Carga
          </button>
        </div>
      </div>

      <!-- Preview estilo WhatsApp -->
      <div class="whatsapp-chat-preview">
        <div style="font-size: 0.74rem; color: #54656f; margin-bottom: 8px; font-weight: 600;">
          Para: <strong>${cli.razonSocial}</strong> (${cli.telefono})
        </div>
        <div class="whatsapp-bubble" id="whatsappBubbleText">${mensaje}</div>
      </div>

      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label">Editar texto si desea personalizarlo:</label>
        <textarea id="txtMensajeReclamo" class="form-control" rows="4" style="font-size: 0.85rem;" oninput="document.getElementById('whatsappBubbleText').textContent = this.value">${mensaje}</textarea>
      </div>
    `;

    footer.innerHTML = `
      <button type="button" class="btn btn-secondary" onclick="App.cerrarModal('modalReclamoWhatsApp')">Cerrar</button>
      <button type="button" class="btn btn-secondary" onclick="App.copiarTextoReclamo()">
        📋 Copiar Texto
      </button>
      <a href="${waUrl}" target="_blank" class="btn btn-whatsapp-action" onclick="App.cerrarModal('modalReclamoWhatsApp')">
        <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.062-2.123-.53-1.63-.675-2.673-2.338-2.755-2.447-.079-.111-.643-.859-.643-1.637 0-.779.408-1.162.553-1.32.145-.158.318-.198.423-.198.106 0 .212.002.304.006.097.005.228-.037.357.273.132.318.452 1.103.492 1.185.04.082.067.178.013.285-.053.107-.079.174-.158.267-.08.092-.167.206-.239.277-.08.08-.163.167-.07.327.093.159.414.685.889 1.109.611.545 1.127.714 1.286.793.159.079.252.069.346-.039.093-.108.397-.463.503-.622.106-.159.212-.132.357-.079.145.053.927.437 1.086.516.159.079.265.118.305.185.039.066.039.385-.105.79z"/></svg>
        Abrir en WhatsApp Web
      </a>
    `;
  }

  function cambiarPlantillaReclamo(plantilla) {
    state.modalReclamo.plantilla = plantilla;
    renderModalReclamoContent();
  }

  function copiarTextoReclamo() {
    const txt = document.getElementById('txtMensajeReclamo');
    if (txt) {
      navigator.clipboard.writeText(txt.value).then(() => {
        showToast('¡Mensaje copiado al portapapeles!');
      });
    }
  }

  // =============================================================
  // MODAL 4: ADMINISTRACIÓN DE SOCIOS / VENDEDORES
  // =============================================================
  function abrirModalGestionSocios() {
    renderModalGestionSociosContent();
    abrirModal('modalGestionSocios');
  }

  function renderModalGestionSociosContent() {
    const body = document.getElementById('modalGestionSociosBody');
    if (!body) return;

    const vendedores = window.DataStore.getVendedores();
    const todosClientes = window.DataStore.getClientes();

    body.innerHTML = `
      <div style="margin-bottom: 16px;">
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px;">
          Cada socio o vendedor tiene su propia cartera de clientes y cuenta corriente. Aquí puede agregar nuevos socios (como Martín, Hernán, etc.).
        </p>

        <!-- Lista de Socios Actuales -->
        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
          ${vendedores.map(v => {
            const cant = todosClientes.filter(c => c.vendedorId === v.id).length;
            return `
              <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid var(--border-color); padding: 10px 14px; border-radius: var(--radius-sm);">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="width: 14px; height: 14px; border-radius: 9999px; background: ${v.color};"></span>
                  <strong>${v.nombre}</strong>
                </div>
                <span class="badge badge-secondary" style="font-weight: 700;">${cant} clientes asignados</span>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Formulario para Agregar Nuevo Socio -->
        <div style="background: #f1f5f9; padding: 16px; border-radius: var(--radius-md); border: 1.5px dashed #cbd5e1;">
          <h4 style="font-size: 0.92rem; font-weight: 800; margin-bottom: 10px; color: var(--text-primary);">
            + Dar de Alta Nuevo Socio / Vendedor
          </h4>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="inputNuevoSocioNombre" class="form-control" placeholder="Nombre (Ej: Martín o Hernán)" style="flex: 1;" required>
            <button type="button" class="btn btn-primary" onclick="App.guardarNuevoSocio()">
              Guardar Socio
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function guardarNuevoSocio() {
    const inp = document.getElementById('inputNuevoSocioNombre');
    if (!inp || !inp.value.trim()) {
      showToast('Por favor ingrese el nombre del socio/vendedor.', 'danger');
      return;
    }

    const nuevo = window.DataStore.saveVendedor({ nombre: inp.value.trim() });
    showToast(`¡Socio ${nuevo.nombre} creado con éxito!`);
    actualizarSelectorVendedoresTopbar();
    renderModalGestionSociosContent();
  }

  // =============================================================
  // MODAL 5: ALTA / EDICIÓN DE CLIENTE
  // =============================================================
  function abrirModalCliente(clienteId = '') {
    state.clienteEdicionId = clienteId;
    renderModalClienteContent();
    abrirModal('modalCliente');
  }

  function renderModalClienteContent() {
    const body = document.getElementById('modalClienteBody');
    if (!body) return;

    const socioRestringido = window.DataStore.getSocioRestringido ? window.DataStore.getSocioRestringido() : null;
    const vendedores = window.DataStore.getVendedores();
    let cli = {
      id: '',
      razonSocial: '',
      vendedorId: socioRestringido || (state.activeVendedorId !== 'todos' ? state.activeVendedorId : (vendedores[0] ? vendedores[0].id : '')),
      telefono: '+54 9 11 ',
      contactoNombre: '',
      direccion: '',
      limiteCredito: 5000000,
      plazoDias: 14
    };

    if (state.clienteEdicionId) {
      cli = window.DataStore.getCliente(state.clienteEdicionId) || cli;
    }

    body.innerHTML = `
      <form id="formCliente" onsubmit="event.preventDefault(); App.guardarClienteForm();">
        <div class="form-row">
          <div class="form-group" style="flex: 2;">
            <label class="form-label">Nombre / Razón Social <span class="required">*</span></label>
            <input type="text" id="cliRazonSocial" class="form-control" value="${cli.razonSocial}" placeholder="Ej: Carnicería Don Julio o BATY" required>
          </div>

          <div class="form-group" style="flex: 1;">
            <label class="form-label">Socio / Vendedor <span class="required">*</span></label>
            <select id="cliVendedorId" class="form-control" ${socioRestringido ? 'disabled style="background:#f1f5f9; cursor:not-allowed;"' : ''} required>
              ${vendedores.map(v => `
                <option value="${v.id}" ${v.id === cli.vendedorId ? 'selected' : ''}>${v.nombre}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Persona de Contacto</label>
            <input type="text" id="cliContacto" class="form-control" value="${cli.contactoNombre || ''}" placeholder="Ej: Juan Carlos (Dueño)">
          </div>

          <div class="form-group">
            <label class="form-label">Teléfono / WhatsApp (para reclamos)</label>
            <input type="text" id="cliTelefono" class="form-control" value="${cli.telefono || ''}" placeholder="+54 9 11 4455-8899">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Dirección comercial / de descarga</label>
          <input type="text" id="cliDireccion" class="form-control" value="${cli.direccion || ''}" placeholder="Ej: Av. San Martín 1234, Lanús">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Límite de Crédito Acordado ($)</label>
            <input type="number" id="cliLimite" class="form-control" value="${cli.limiteCredito}" min="0" step="500000">
          </div>

          <div class="form-group">
            <label class="form-label">Días de Plazo de Pago</label>
            <input type="number" id="cliPlazo" class="form-control" value="${cli.plazoDias}" min="0" step="1">
          </div>
        </div>
      </form>
    `;
  }

  function guardarClienteForm() {
    const razonSocial = document.getElementById('cliRazonSocial')?.value.trim();
    const socioRestringido = window.DataStore.getSocioRestringido ? window.DataStore.getSocioRestringido() : null;
    const vendedorId = socioRestringido || document.getElementById('cliVendedorId')?.value;
    if (!razonSocial || !vendedorId) {
      showToast('Por favor ingrese el nombre y asigne un socio.', 'danger');
      return;
    }

    const clienteData = {
      id: state.clienteEdicionId,
      razonSocial,
      vendedorId,
      contactoNombre: document.getElementById('cliContacto')?.value.trim(),
      telefono: document.getElementById('cliTelefono')?.value.trim(),
      direccion: document.getElementById('cliDireccion')?.value.trim(),
      limiteCredito: Number(document.getElementById('cliLimite')?.value) || 5000000,
      plazoDias: Number(document.getElementById('cliPlazo')?.value) || 14
    };

    const saved = window.DataStore.saveCliente(clienteData);
    cerrarModal('modalCliente');
    showToast(`¡Cliente ${saved.razonSocial} guardado con éxito!`);

    state.selectedClienteId = saved.id;
    actualizarSelectorVendedoresTopbar();
    switchView(state.currentView, { clienteId: saved.id });
  }

  // =============================================================
  // MODALES DE DETALLE (VENTA & COBRANZA)
  // =============================================================
  function verDetalleVenta(ventaId) {
    const v = window.DataStore.getVenta(ventaId);
    if (!v) return;

    const body = document.getElementById('modalDetalleVentaBody');
    if (!body) return;

    body.innerHTML = `
      <div style="background: #f8fafc; padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary);">${v.numero}</h3>
            <span style="font-size: 0.8rem; color: var(--text-muted);">${formatDate(v.fechaEmision)}</span>
          </div>
          <span class="vendedor-badge" style="background: ${v.vendedorColor}20; color: ${v.vendedorColor};">
            👤 Socio: ${v.vendedorNombre}
          </span>
        </div>
        <div style="margin-top: 8px; font-size: 0.9rem;">
          <strong>Cliente:</strong> ${v.clienteNombre}
        </div>
      </div>

      <div class="card" style="margin-bottom: 16px;">
        <div class="card-header"><div class="card-title">Detalle Cárnico</div></div>
        <div style="padding: 12px 16px; font-size: 0.88rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span>Tipo de Corte:</span>
            <strong>${v.corte}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span>Cantidad de Cortes:</span>
            <strong>${v.cantidadCortes}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span>Kilaje Total:</span>
            <strong style="font-family: var(--font-mono); font-size: 1rem;">${v.totalKg.toLocaleString()} kg</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span>Precio pactado:</span>
            <strong style="font-family: var(--font-mono);">${formatMoney(v.precioKg)} / kg</strong>
          </div>
          ${v.pesos && v.pesos.length > 0 ? `
            <div style="margin-top: 10px; border-top: 1px dashed var(--border-color); padding-top: 8px;">
              <span style="font-size: 0.78rem; color: var(--text-muted);">Kilaje individual de cada corte:</span>
              <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">
                ${v.pesos.map(p => `<span class="peso-pill">${p} kg</span>`).join('')}
              </div>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 8px; font-size: 1.15rem; font-weight: 800; color: var(--text-primary);">
            <span>TOTAL VENTA:</span>
            <span>${formatMoney(v.total)}</span>
          </div>
        </div>
      </div>

      <!-- Pagos Aplicados a esta Venta -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Pagos Imputados a esta Venta</div>
          <span style="font-size: 0.8rem; font-weight: 700; color: ${v.saldoPendiente <= 0 ? '#059669' : 'var(--danger)'};">
            ${v.saldoPendiente <= 0 ? '✅ Totalmente Pagada' : `⚠️ Saldo Restante: ${formatMoney(v.saldoPendiente)}`}
          </span>
        </div>
        <div style="padding: 12px 16px;">
          ${!v.pagosAplicados || v.pagosAplicados.length === 0 ? `
            <p style="color: var(--text-muted); font-size: 0.84rem;">No hay pagos imputados a esta venta todavía.</p>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${v.pagosAplicados.map(pa => `
                <div style="display: flex; justify-content: space-between; font-size: 0.84rem; padding: 6px 0; border-bottom: 1px dashed #e2e8f0;">
                  <span>Recibo <strong>${pa.numeroRecibo || pa.pagoId}</strong> (${formatDate(pa.fecha)}) [${pa.metodo}]</span>
                  <strong style="color: #059669;">${formatMoney(pa.monto)}</strong>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;

    abrirModal('modalDetalleVenta');
  }

  function verDetalleCobranza(cobranzaId) {
    const c = window.DataStore.getCobranza(cobranzaId);
    if (!c) return;

    const body = document.getElementById('modalDetalleCobranzaBody');
    if (!body) return;

    body.innerHTML = `
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px; border-radius: var(--radius-sm); margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: #15803d;">${c.numero}</h3>
            <span style="font-size: 0.8rem; color: var(--text-muted);">${formatDate(c.fecha)}</span>
          </div>
          <span class="vendedor-badge" style="background: ${c.vendedorColor}20; color: ${c.vendedorColor};">
            👤 Socio: ${c.vendedorNombre}
          </span>
        </div>
        <div style="margin-top: 8px; font-size: 0.9rem;">
          <strong>Cliente:</strong> ${c.clienteNombre}
        </div>
      </div>

      <div class="card" style="margin-bottom: 16px;">
        <div class="card-header"><div class="card-title">Valores Percibidos</div></div>
        <div style="padding: 12px 16px; font-size: 0.88rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span>Método de cobro:</span>
            <strong>${c.metodo}</strong>
          </div>
          ${c.efectivo > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span>Efectivo:</span>
              <strong>${formatMoney(c.efectivo)}</strong>
            </div>
          ` : ''}
          ${c.transferencia > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span>Transferencia Bancaria:</span>
              <strong>${formatMoney(c.transferencia)}</strong>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 8px; font-size: 1.2rem; font-weight: 800; color: #059669;">
            <span>TOTAL COBRADO:</span>
            <span>${formatMoney(c.totalCobrado)}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">Ventas Canceladas por este Recibo</div></div>
        <div style="padding: 12px 16px;">
          ${!c.imputaciones || c.imputaciones.length === 0 ? `
            <p style="color: var(--text-muted); font-size: 0.84rem;">Acreditado a la cuenta corriente del cliente.</p>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${c.imputaciones.map(imp => `
                <div style="display: flex; justify-content: space-between; font-size: 0.84rem; padding: 6px 0; border-bottom: 1px dashed #e2e8f0;">
                  <span>Venta <strong>${imp.numeroVenta}</strong> (${imp.corte || 'Carne'} - ${formatDate(imp.fechaVenta)})</span>
                  <strong style="color: #059669;">${formatMoney(imp.montoImputado)}</strong>
                </div>
              `).join('')}
            </div>
          `}
          ${c.saldoAFavor > 0 ? `
            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--border-color); color: #047857; font-weight: 700; font-size: 0.84rem;">
              Remanente como saldo a favor: ${formatMoney(c.saldoAFavor)}
            </div>
          ` : ''}
        </div>
      </div>
    `;

    abrirModal('modalDetalleCobranza');
  }

  // =============================================================
  // EXPORTACIÓN A EXCEL / CSV
  // =============================================================
  function exportarCsvCtaCte(clienteId) {
    const ctaCteData = window.DataStore.getExtractoCtaCte(clienteId);
    if (!ctaCteData) return;

    const cli = ctaCteData.cliente;
    const movs = ctaCteData.movimientos;

    let csvContent = '\uFEFF'; // BOM UTF-8 para Excel
    csvContent += `CUENTA CORRIENTE - ${cli.razonSocial}\n`;
    csvContent += `Socio;${cli.vendedorNombre};Teléfono;${cli.telefono}\n`;
    csvContent += `Fecha Emisión;${new Date().toLocaleDateString('es-AR')}\n\n`;

    csvContent += 'Fecha;Concepto;Corte;Kilajes;Cant. Cortes;Total Kg;Precio/Kg;Deuda Anterior;Debe (Venta);Haber (Pago);Saldo Acumulado\n';

    movs.forEach(m => {
      const kilajes = m.pesos ? m.pesos.join(' ') : '';
      csvContent += `${m.fecha};${m.concepto};${m.corte};"${kilajes}";${m.cantidadCortes};${m.totalKg};${m.precioKg};${m.saldoDeudorPrevio};${m.debe};${m.haber};${m.saldoAcumulado}\n`;
    });

    csvContent += `\nTOTALES;;;;${ctaCteData.totales.totalCortes};${ctaCteData.totales.totalKg};;;${ctaCteData.totales.totalDebe};${ctaCteData.totales.totalHaber};${ctaCteData.totales.saldoActual}\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CtaCte_${cli.razonSocial.replace(/[^A-Za-z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('¡Archivo Excel (CSV) generado y descargado!');
  }

  function handleTopbarSearch(query) {
    if (!query) return;
    const q = query.toLowerCase();
    const clientes = window.DataStore.getClientes({ vendedorId: state.activeVendedorId, search: q });
    if (clientes.length > 0) {
      state.selectedClienteId = clientes[0].id;
      switchView('ctacte', { clienteId: clientes[0].id });
    }
  }

  function resetearDemo() {
    if (confirm('¿Desea restablecer los datos al estado original del archivo Excel?')) {
      window.DataStore.resetToDefault();
      state.activeVendedorId = 'todos';
      actualizarSelectorVendedoresTopbar();
      const clis = window.DataStore.getClientes();
      if (clis.length > 0) state.selectedClienteId = clis[0].id;
      switchView('ctacte');
      showToast('¡Datos restablecidos con éxito!');
    }
  }

  // =============================================================
  // INTERFAZ PÚBLICA DE APP
  // =============================================================
  window.App = {
    init: initApp,
    switchView,
    toggleSidebarMobile,
    cambiarVendedorActivo,
    onSelectClienteCtaCte,
    onFiltroVentasChange,
    onFiltroCobranzasChange,
    handleTopbarSearch,
    resetearDemo,

    // Venta modal & Chips
    abrirModalVenta,
    seleccionarCorteVenta,
    actualizarBotonesCorte,
    agregarPesoDesdeInput,
    onNuevoPesoKeydown,
    eliminarPesoVenta,
    limpiarTodosLosPesosVenta,
    abrirDropdownClienteVenta,
    cerrarDropdownClienteVenta,
    toggleDropdownClienteVenta,
    filtrarDropdownClienteVenta,
    limpiarBusquedaClienteVenta,
    seleccionarClienteVenta,
    onKeydownClienteVenta,
    onClienteChangeVenta,
    onPesosVentaInput,
    onPrecioVentaInput,
    guardarNuevaVenta,
    verDetalleVenta,

    // Cobranza modal & Desplegables
    abrirModalCobranza,
    abrirDropdownClienteCobranza,
    cerrarDropdownClienteCobranza,
    toggleDropdownClienteCobranza,
    filtrarDropdownClienteCobranza,
    limpiarBusquedaClienteCobranza,
    seleccionarClienteCobranza,
    onKeydownClienteCobranza,
    onClienteChangeCobranza,
    setMontoTotalDeuda,
    onMontoCobranzaInput,
    onMetodoCobranzaSelectChange,
    seleccionarMetodoCobranza,
    onMontoMixtoInput,
    actualizarFifoPreview,
    guardarNuevaCobranza,
    verDetalleCobranza,

    // Reclamo WhatsApp
    abrirModalReclamo,
    cambiarPlantillaReclamo,
    copiarTextoReclamo,

    // Socios
    abrirModalGestionSocios,
    guardarNuevoSocio,

    // Clientes
    abrirModalCliente,
    guardarClienteForm,

    // Admin & Whitelist & Autenticación
    abrirModalUsuario,
    onUsuarioSocioAsignadoChange,
    guardarUsuarioForm,
    toggleBajaUsuario,
    eliminarUsuario,
    onFiltroUsuariosChange,
    abrirModalLogin,
    ejecutarLogin,
    ejecutarLoginGate,
    cerrarSesion,
    togglePasswordVisibility,
    verificarSesionYRenderizar,
    loginRapidoComo,
    actualizarInfoUsuarioSesion,
    onUserPillClick,

    // Generales
    cerrarModal,
    exportarCsvCtaCte
  };

  // Cerrar desplegables de clientes al hacer clic fuera
  document.addEventListener('click', function (e) {
    const vCont = document.getElementById('ventaClienteSelectContainer');
    if (vCont && !vCont.contains(e.target)) {
      cerrarDropdownClienteVenta();
    }
    const cCont = document.getElementById('cobranzaClienteSelectContainer');
    if (cCont && !cCont.contains(e.target)) {
      cerrarDropdownClienteCobranza();
    }
  });

  // Inicializar al cargar el DOM
  document.addEventListener('DOMContentLoaded', initApp);

})();

