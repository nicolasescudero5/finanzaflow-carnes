/**
 * FINANZAFLOW ERP - GESTOR DE DATOS Y MOTOR CONTABLE FIFO (V3 SIMPLIFICADO)
 * Especializado en Comercio de Carne y Distribución Frigorífica
 * Soporte multi-socio (Franco, Lucas y nuevos socios), carga ágil de cortes cárnicos,
 * imputación automática FIFO a la venta más vieja, ranking de deudores y reclamos WhatsApp.
 */

(function (window) {
  'use strict';

  const STORAGE_KEY = 'cuentas_corrientes_db_v3';

  // Helper para generar fechas relativas YYYY-MM-DD
  function getRelativeDate(daysOffset) {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().split('T')[0];
  }

  const DataStore = {
    data: {
      vendedores: [],
      clientes: [],
      ventas: [],
      cobranzas: [],
      planesPago: []
    },

    init() {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          this.data = JSON.parse(stored);
          // Si por alguna razón faltan vendedores en una versión vieja, restaurar
          if (!this.data.vendedores || this.data.vendedores.length === 0) {
            this.initFromPreloaded();
          }
          this.initUsuariosWhitelist();
          return;
        } catch (e) {
          console.warn('Error al leer datos locales, inicializando dataset base:', e);
        }
      }
      this.initFromPreloaded();
      this.initUsuariosWhitelist();
    },


    initFromPreloaded() {
      const preloaded = (typeof window !== 'undefined' ? window : global).INITIAL_DATASET;
      if (preloaded) {
        this.data = JSON.parse(JSON.stringify(preloaded));
      } else {
        // Fallback básico si no estuviese cargado el script
        this.data = {
          vendedores: [
            { id: 'VEND-FRANCO', nombre: 'Franco', activo: true, color: '#2563eb' },
            { id: 'VEND-LUCAS', nombre: 'Lucas', activo: true, color: '#059669' }
          ],
          clientes: [],
          ventas: [],
          cobranzas: [],
          planesPago: []
        };
      }
      this.save();
    },

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      } catch (e) {
        console.error('Error al persistir en localStorage:', e);
      }
    },

    resetToDefault() {
      localStorage.removeItem(STORAGE_KEY);
      this.initFromPreloaded();
      return true;
    },

    // =============================================================
    // 1. GESTIÓN DE SOCIOS / VENDEDORES
    // =============================================================
    getVendedores(soloActivos = true) {
      if (!this.data.vendedores) this.data.vendedores = [];
      return this.data.vendedores.filter(v => !soloActivos || v.activo);
    },

    getVendedor(id) {
      if (!this.data.vendedores) return null;
      return this.data.vendedores.find(v => v.id === id) || null;
    },

    saveVendedor(vendedor) {
      if (!this.data.vendedores) this.data.vendedores = [];
      if (!vendedor.id) {
        const cleanName = (vendedor.nombre || 'SOCIO').toUpperCase().replace(/[^A-Z0-9]/g, '');
        vendedor.id = `VEND-${cleanName}-${Date.now().toString().slice(-4)}`;
        if (vendedor.activo === undefined) vendedor.activo = true;
        if (!vendedor.color) {
          const colors = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];
          vendedor.color = colors[this.data.vendedores.length % colors.length];
        }
        this.data.vendedores.push(vendedor);
      } else {
        const idx = this.data.vendedores.findIndex(v => v.id === vendedor.id);
        if (idx >= 0) {
          this.data.vendedores[idx] = { ...this.data.vendedores[idx], ...vendedor };
        }
      }
      this.save();
      return vendedor;
    },

    deleteVendedor(id) {
      const idx = this.data.vendedores.findIndex(v => v.id === id);
      if (idx >= 0) {
        this.data.vendedores[idx].activo = false;
        this.save();
        return true;
      }
      return false;
    },

    // =============================================================
    // 2. GESTIÓN DE CLIENTES
    // =============================================================
    getClientes(filters = {}) {
      let list = this.data.clientes || [];

      // Filtro por Vendedor / Socio
      if (filters.vendedorId && filters.vendedorId !== 'todos') {
        list = list.filter(c => c.vendedorId === filters.vendedorId);
      }

      // Filtro por Estado Comercial
      if (filters.estado && filters.estado !== 'todos') {
        list = list.filter(c => c.estado === filters.estado);
      }

      // Búsqueda textual
      if (filters.search) {
        const s = filters.search.toLowerCase().trim();
        list = list.filter(c => 
          (c.razonSocial && c.razonSocial.toLowerCase().includes(s)) ||
          (c.contactoNombre && c.contactoNombre.toLowerCase().includes(s)) ||
          (c.telefono && c.telefono.toLowerCase().includes(s)) ||
          (c.direccion && c.direccion.toLowerCase().includes(s))
        );
      }

      // Enriquecer con saldos y métricas
      return list.map(c => {
        const resumen = this.getClienteResumen(c.id);
        const vendedor = this.getVendedor(c.vendedorId) || { nombre: 'Sin Asignar', color: '#64748b' };
        return {
          ...c,
          vendedorNombre: vendedor.nombre,
          vendedorColor: vendedor.color,
          saldoActual: resumen.saldoActual,
          totalFacturado: resumen.totalFacturado,
          totalCobrado: resumen.totalCobrado,
          ventasPendientesCount: resumen.ventasPendientesCount,
          ultimaActividad: resumen.ultimaActividad
        };
      });
    },

    getCliente(id) {
      const cli = (this.data.clientes || []).find(c => c.id === id);
      if (!cli) return null;
      const resumen = this.getClienteResumen(id);
      const vendedor = this.getVendedor(cli.vendedorId) || { nombre: 'Sin Asignar', color: '#64748b' };
      return {
        ...cli,
        vendedorNombre: vendedor.nombre,
        vendedorColor: vendedor.color,
        saldoActual: resumen.saldoActual,
        totalFacturado: resumen.totalFacturado,
        totalCobrado: resumen.totalCobrado,
        ventasPendientesCount: resumen.ventasPendientesCount,
        diasMora: resumen.diasMora,
        ultimaActividad: resumen.ultimaActividad
      };
    },

    saveCliente(cliente) {
      if (!this.data.clientes) this.data.clientes = [];
      if (!cliente.id) {
        cliente.id = `CLI-${Date.now().toString().slice(-6)}`;
        if (!cliente.fechaAlta) cliente.fechaAlta = new Date().toISOString().split('T')[0];
        if (!cliente.estado) cliente.estado = 'activo';
        if (!cliente.limiteCredito) cliente.limiteCredito = 5000000;
        if (!cliente.plazoDias) cliente.plazoDias = 14;
        this.data.clientes.push(cliente);
      } else {
        const idx = this.data.clientes.findIndex(c => c.id === cliente.id);
        if (idx >= 0) {
          this.data.clientes[idx] = { ...this.data.clientes[idx], ...cliente };
        }
      }
      this.save();
      return cliente;
    },

    toggleBloqueoCliente(clienteId, motivo = '') {
      const cli = (this.data.clientes || []).find(c => c.id === clienteId);
      if (cli) {
        cli.estado = cli.estado === 'bloqueado' ? 'activo' : 'bloqueado';
        cli.motivoBloqueo = cli.estado === 'bloqueado' ? (motivo || 'Bloqueo preventivo') : '';
        this.save();
        return cli;
      }
      return null;
    },

    // =============================================================
    // 3. VENTAS CÁRNICAS (CORTES, KILAJES, PRECIO, IMPUTACIÓN)
    // =============================================================
    getVentas(filters = {}) {
      let list = this.data.ventas || [];

      // Filtro por Vendedor
      if (filters.vendedorId && filters.vendedorId !== 'todos') {
        list = list.filter(v => v.vendedorId === filters.vendedorId);
      }

      // Filtro por Cliente
      if (filters.clienteId) {
        list = list.filter(v => v.clienteId === filters.clienteId);
      }

      // Filtro por Estado de Cobro
      if (filters.estado) {
        if (filters.estado === 'pendientes') {
          list = list.filter(v => (v.saldoPendiente || 0) > 0.01);
        } else if (filters.estado === 'cobradas') {
          list = list.filter(v => (v.saldoPendiente || 0) <= 0.01);
        } else if (filters.estado === 'parciales') {
          list = list.filter(v => (v.montoCobrado || 0) > 0 && (v.saldoPendiente || 0) > 0.01);
        }
      }

      // Búsqueda
      if (filters.search) {
        const s = filters.search.toLowerCase().trim();
        list = list.filter(v => {
          const cli = (this.data.clientes || []).find(c => c.id === v.clienteId);
          const cliName = cli ? cli.razonSocial.toLowerCase() : '';
          return (v.numero && v.numero.toLowerCase().includes(s)) ||
                 (v.corte && v.corte.toLowerCase().includes(s)) ||
                 cliName.includes(s);
        });
      }

      return list.map(v => {
        const cli = (this.data.clientes || []).find(c => c.id === v.clienteId);
        const vend = this.getVendedor(v.vendedorId || (cli ? cli.vendedorId : ''));
        return {
          ...v,
          clienteNombre: cli ? cli.razonSocial : 'Cliente Desconocido',
          clienteTelefono: cli ? cli.telefono : '',
          vendedorNombre: vend ? vend.nombre : 'Sin Asignar',
          vendedorColor: vend ? vend.color : '#64748b'
        };
      }).sort((a, b) => new Date(b.fechaEmision) - new Date(a.fechaEmision));
    },

    getVenta(id) {
      const v = (this.data.ventas || []).find(item => item.id === id);
      if (!v) return null;
      const cli = (this.data.clientes || []).find(c => c.id === v.clienteId);
      const vend = this.getVendedor(v.vendedorId || (cli ? cli.vendedorId : ''));
      return {
        ...v,
        clienteNombre: cli ? cli.razonSocial : 'Cliente Desconocido',
        clienteTelefono: cli ? cli.telefono : '',
        vendedorNombre: vend ? vend.nombre : 'Sin Asignar',
        vendedorColor: vend ? vend.color : '#64748b'
      };
    },

    saveVenta(ventaData) {
      if (!this.data.ventas) this.data.ventas = [];
      const cli = (this.data.clientes || []).find(c => c.id === ventaData.clienteId);
      if (!cli) throw new Error('Cliente no encontrado');

      // Procesar kilajes individuales
      let pesos = [];
      if (Array.isArray(ventaData.pesos)) {
        pesos = ventaData.pesos.map(Number).filter(n => !isNaN(n) && n > 0);
      } else if (typeof ventaData.pesos === 'string') {
        pesos = ventaData.pesos.split(/[\s,]+/).map(Number).filter(n => !isNaN(n) && n > 0);
      }

      const totalKg = pesos.length > 0 
        ? pesos.reduce((a, b) => a + b, 0) 
        : (Number(ventaData.totalKg) || 0);

      const cantCortes = pesos.length > 0 
        ? pesos.length 
        : (Number(ventaData.cantidadCortes) || 1);

      const precioKg = Number(ventaData.precioKg) || 0;
      const totalVenta = Math.round(totalKg * precioKg);

      const count = this.data.ventas.length + 1;
      const nuevaVenta = {
        id: ventaData.id || `VTA-${Date.now().toString().slice(-6)}`,
        numero: ventaData.numero || `VTA-${String(count).padStart(6, '0')}`,
        clienteId: cli.id,
        vendedorId: cli.vendedorId || 'VEND-FRANCO',
        fechaEmision: ventaData.fechaEmision || new Date().toISOString().split('T')[0],
        corte: ventaData.corte || '1/2 RES',
        pesos: pesos,
        cantidadCortes: cantCortes,
        totalKg: Math.round(totalKg * 100) / 100,
        precioKg: precioKg,
        total: totalVenta,
        montoCobrado: 0,
        saldoPendiente: totalVenta,
        estado: 'pendiente',
        pagosAplicados: [],
        observaciones: ventaData.observaciones || 'Despacho cárnico frigorífico'
      };

      this.data.ventas.push(nuevaVenta);

      // Si el cliente tenía saldo a favor previo en cobranzas anteriores, aplicar inmediatamente
      this.reconciliarSaldoAFavorCliente(cli.id);

      this.save();
      return nuevaVenta;
    },

    // =============================================================
    // 4. REGISTRO DE PAGOS CON IMPUTACIÓN AUTOMÁTICA FIFO A LA VENTA MÁS VIEJA
    // =============================================================
    getCobranzas(filters = {}) {
      let list = this.data.cobranzas || [];

      if (filters.vendedorId && filters.vendedorId !== 'todos') {
        list = list.filter(c => c.vendedorId === filters.vendedorId);
      }

      if (filters.clienteId) {
        list = list.filter(c => c.clienteId === filters.clienteId);
      }

      if (filters.search) {
        const s = filters.search.toLowerCase().trim();
        list = list.filter(cob => {
          const cli = (this.data.clientes || []).find(c => c.id === cob.clienteId);
          const cliName = cli ? cli.razonSocial.toLowerCase() : '';
          return (cob.numero && cob.numero.toLowerCase().includes(s)) ||
                 (cob.metodo && cob.metodo.toLowerCase().includes(s)) ||
                 cliName.includes(s);
        });
      }

      return list.map(cob => {
        const cli = (this.data.clientes || []).find(c => c.id === cob.clienteId);
        const vend = this.getVendedor(cob.vendedorId || (cli ? cli.vendedorId : ''));
        return {
          ...cob,
          clienteNombre: cli ? cli.razonSocial : 'Cliente Desconocido',
          vendedorNombre: vend ? vend.nombre : 'Sin Asignar',
          vendedorColor: vend ? vend.color : '#64748b'
        };
      }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    },

    getCobranza(id) {
      const cob = (this.data.cobranzas || []).find(c => c.id === id);
      if (!cob) return null;
      const cli = (this.data.clientes || []).find(c => c.id === cob.clienteId);
      const vend = this.getVendedor(cob.vendedorId || (cli ? cli.vendedorId : ''));
      return {
        ...cob,
        clienteNombre: cli ? cli.razonSocial : 'Cliente Desconocido',
        vendedorNombre: vend ? vend.nombre : 'Sin Asignar',
        vendedorColor: vend ? vend.color : '#64748b'
      };
    },

    /**
     * Registra un pago y aplica automáticamente a la venta más vieja (FIFO).
     */
    registrarPago({ clienteId, fecha, monto, metodo = 'Transferencia', efectivo = 0, transferencia = 0, observaciones = '', ventaIdEspecifica = null, modoImputacion = 'fifo' }) {
      if (!this.data.cobranzas) this.data.cobranzas = [];
      const cli = (this.data.clientes || []).find(c => c.id === clienteId);
      if (!cli) throw new Error('Cliente no encontrado');

      let totalCobrado = Number(monto) || 0;
      let montoEfectivo = Number(efectivo) || 0;
      let montoTransf = Number(transferencia) || 0;

      if (totalCobrado === 0 && (montoEfectivo > 0 || montoTransf > 0)) {
        totalCobrado = montoEfectivo + montoTransf;
      } else if (totalCobrado > 0 && montoEfectivo === 0 && montoTransf === 0) {
        if (metodo.toLowerCase().includes('efectivo')) {
          montoEfectivo = totalCobrado;
        } else {
          montoTransf = totalCobrado;
        }
      }

      if (totalCobrado <= 0) {
        throw new Error('El importe del pago debe ser mayor a cero.');
      }

      const count = this.data.cobranzas.length + 1;
      const cobId = `COB-${Date.now().toString().slice(-6)}`;
      const cobNum = `REC-${String(count).padStart(6, '0')}`;
      const fechaPago = fecha || new Date().toISOString().split('T')[0];

      const nuevoPago = {
        id: cobId,
        numero: cobNum,
        clienteId: cli.id,
        vendedorId: cli.vendedorId || 'VEND-FRANCO',
        fecha: fechaPago,
        totalCobrado: totalCobrado,
        efectivo: montoEfectivo,
        transferencia: montoTransf,
        metodo: metodo,
        observaciones: observaciones || `Cobro asentado en Cuenta Corriente (${metodo})`,
        imputaciones: [],
        saldoAFavor: 0
      };

      // =========================================================
      // APLICACIÓN A LA(S) VENTA(S) MÁS VIEJA(S) (FIFO)
      // =========================================================
      let remMonto = totalCobrado;

      // Obtener todas las ventas pendientes del cliente ordenadas cronológicamente (más vieja primero)
      const ventasDelCliente = (this.data.ventas || [])
        .filter(v => v.clienteId === cli.id)
        .sort((a, b) => new Date(a.fechaEmision) - new Date(b.fechaEmision));

      // Si el usuario pidió imputar específicamente a una venta primero
      if (modoImputacion === 'especifica' && ventaIdEspecifica) {
        const vEsp = ventasDelCliente.find(v => v.id === ventaIdEspecifica);
        if (vEsp && (vEsp.saldoPendiente || 0) > 0) {
          const impEsp = Math.min(remMonto, vEsp.saldoPendiente);
          vEsp.montoCobrado = (vEsp.montoCobrado || 0) + impEsp;
          vEsp.saldoPendiente = Math.max(0, vEsp.total - vEsp.montoCobrado);
          vEsp.estado = vEsp.saldoPendiente <= 0.01 ? 'cobrado' : 'parcial';
          if (!vEsp.pagosAplicados) vEsp.pagosAplicados = [];
          vEsp.pagosAplicados.push({
            pagoId: cobId,
            numeroRecibo: cobNum,
            fecha: fechaPago,
            monto: impEsp,
            metodo: metodo
          });
          nuevoPago.imputaciones.push({
            ventaId: vEsp.id,
            numeroVenta: vEsp.numero,
            fechaVenta: vEsp.fechaEmision,
            corte: vEsp.corte,
            montoImputado: impEsp
          });
          remMonto -= impEsp;
        }
      }

      // Aplicar el restante (o el total si no fue específica) en modo FIFO a las más viejas
      for (const v of ventasDelCliente) {
        if (remMonto <= 0) break;
        if ((v.saldoPendiente || 0) > 0.01) {
          const imp = Math.min(remMonto, v.saldoPendiente);
          v.montoCobrado = (v.montoCobrado || 0) + imp;
          v.saldoPendiente = Math.max(0, v.total - v.montoCobrado);
          v.estado = v.saldoPendiente <= 0.01 ? 'cobrado' : 'parcial';
          if (!v.pagosAplicados) v.pagosAplicados = [];
          v.pagosAplicados.push({
            pagoId: cobId,
            numeroRecibo: cobNum,
            fecha: fechaPago,
            monto: imp,
            metodo: metodo
          });
          nuevoPago.imputaciones.push({
            ventaId: v.id,
            numeroVenta: v.numero,
            fechaVenta: v.fechaEmision,
            corte: v.corte,
            montoImputado: imp
          });
          remMonto -= imp;
        }
      }

      // Si quedó excedente, queda como saldo a favor en la cuenta
      if (remMonto > 0.01) {
        nuevoPago.saldoAFavor = Math.round(remMonto * 100) / 100;
      }

      this.data.cobranzas.push(nuevoPago);
      this.save();

      return {
        cobranza: nuevoPago,
        imputaciones: nuevoPago.imputaciones,
        saldoAFavor: nuevoPago.saldoAFavor
      };
    },

    reconciliarSaldoAFavorCliente(clienteId) {
      // Si hay cobranzas con saldo a favor no aplicado y hay ventas nuevas con saldo pendiente
      const cobsConSaldo = (this.data.cobranzas || []).filter(c => c.clienteId === clienteId && (c.saldoAFavor || 0) > 0.01);
      if (cobsConSaldo.length === 0) return;

      const ventasPend = (this.data.ventas || [])
        .filter(v => v.clienteId === clienteId && (v.saldoPendiente || 0) > 0.01)
        .sort((a, b) => new Date(a.fechaEmision) - new Date(b.fechaEmision));

      for (const cob of cobsConSaldo) {
        let rem = cob.saldoAFavor;
        for (const v of ventasPend) {
          if (rem <= 0) break;
          if ((v.saldoPendiente || 0) > 0.01) {
            const imp = Math.min(rem, v.saldoPendiente);
            v.montoCobrado = (v.montoCobrado || 0) + imp;
            v.saldoPendiente = Math.max(0, v.total - v.montoCobrado);
            v.estado = v.saldoPendiente <= 0.01 ? 'cobrado' : 'parcial';
            if (!v.pagosAplicados) v.pagosAplicados = [];
            v.pagosAplicados.push({
              pagoId: cob.id,
              numeroRecibo: cob.numero,
              fecha: cob.fecha,
              monto: imp,
              metodo: cob.metodo
            });
            cob.imputaciones.push({
              ventaId: v.id,
              numeroVenta: v.numero,
              fechaVenta: v.fechaEmision,
              corte: v.corte,
              montoImputado: imp
            });
            rem -= imp;
          }
        }
        cob.saldoAFavor = Math.max(0, rem);
      }
    },

    // =============================================================
    // 5. EXTRACTO DE CUENTA CORRIENTE (ESPEJO PLANILLA EXCEL)
    // =============================================================
    getExtractoCtaCte(clienteId) {
      const cli = this.getCliente(clienteId);
      if (!cli) return null;

      const movimientos = [];

      // Ventas
      const ventasCli = (this.data.ventas || []).filter(v => v.clienteId === clienteId);
      ventasCli.forEach(v => {
        movimientos.push({
          id: v.id,
          tipo: 'VENTA',
          concepto: 'VENTA',
          numero: v.numero,
          fecha: v.fechaEmision,
          corte: v.corte || '1/2 RES',
          pesos: v.pesos || [],
          cantidadCortes: v.cantidadCortes || (v.pesos ? v.pesos.length : 1),
          totalKg: v.totalKg || 0,
          precioKg: v.precioKg || 0,
          debe: v.total || 0,
          haber: 0,
          pagoEfectivo: 0,
          pagoTransf: 0,
          documentoRef: v
        });
      });

      // Cobranzas
      const cobranzasCli = (this.data.cobranzas || []).filter(c => c.clienteId === clienteId);
      cobranzasCli.forEach(c => {
        movimientos.push({
          id: c.id,
          tipo: 'PAGO',
          concepto: 'PAGO',
          numero: c.numero,
          fecha: c.fecha,
          corte: '-',
          pesos: [],
          cantidadCortes: 0,
          totalKg: 0,
          precioKg: 0,
          debe: 0,
          haber: c.totalCobrado || 0,
          pagoEfectivo: c.efectivo || 0,
          pagoTransf: c.transferencia || 0,
          documentoRef: c
        });
      });

      // Ordenar cronológicamente por fecha
      movimientos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

      // Calcular saldo anterior y saldo acumulado progresivo exactamente como en Excel:
      // Saldo Acumulado = Saldo Anterior + Debe - Haber
      let runningSaldo = 0;
      let totalKgSum = 0;
      let totalCortesSum = 0;
      let totalDebeSum = 0;
      let totalHaberSum = 0;

      const asientos = movimientos.map(m => {
        const saldoDeudorPrevio = runningSaldo;
        runningSaldo = runningSaldo + m.debe - m.haber;

        totalKgSum += m.totalKg;
        totalCortesSum += m.cantidadCortes;
        totalDebeSum += m.debe;
        totalHaberSum += m.haber;

        return {
          ...m,
          saldoDeudorPrevio,
          saldoAcumulado: runningSaldo
        };
      });

      return {
        cliente: cli,
        movimientos: asientos,
        totales: {
          totalKg: Math.round(totalKgSum * 100) / 100,
          totalCortes: totalCortesSum,
          totalDebe: totalDebeSum,
          totalHaber: totalHaberSum,
          saldoActual: runningSaldo
        }
      };
    },

    getClienteResumen(clienteId) {
      const ventasCli = (this.data.ventas || []).filter(v => v.clienteId === clienteId);
      const cobsCli = (this.data.cobranzas || []).filter(c => c.clienteId === clienteId);

      const totalFacturado = ventasCli.reduce((acc, v) => acc + (v.total || 0), 0);
      const totalCobrado = cobsCli.reduce((acc, c) => acc + (c.totalCobrado || 0), 0);
      const saldoActual = totalFacturado - totalCobrado;

      let ventasPendientesCount = 0;
      let maxDiasMora = 0;
      const today = new Date();

      ventasCli.forEach(v => {
        if ((v.saldoPendiente || 0) > 0.01) {
          ventasPendientesCount++;
          const dVta = new Date(v.fechaEmision);
          const diffDays = Math.floor((today - dVta) / (1000 * 60 * 60 * 24));
          if (diffDays > maxDiasMora) maxDiasMora = diffDays;
        }
      });

      // Última fecha de actividad
      let ultimaActividad = '-';
      const allDates = [
        ...ventasCli.map(v => v.fechaEmision),
        ...cobsCli.map(c => c.fecha)
      ].sort().reverse();

      if (allDates.length > 0) ultimaActividad = allDates[0];

      return {
        totalFacturado,
        totalCobrado,
        saldoActual,
        ventasPendientesCount,
        diasMora: maxDiasMora,
        ultimaActividad
      };
    },

    // =============================================================
    // 6. RANKING DE DEUDORES Y RECLAMOS DE COBRANZA (WHATSAPP)
    // =============================================================
    getRankingDeudores(filters = {}) {
      const clientes = this.getClientes({ vendedorId: filters.vendedorId });

      // Filtrar sólo clientes con deuda pendiente
      let deudores = clientes.filter(c => (c.saldoActual || 0) > 0.01);

      if (filters.search) {
        const s = filters.search.toLowerCase().trim();
        deudores = deudores.filter(d => d.razonSocial.toLowerCase().includes(s));
      }

      // Ordenar de mayor deuda a menor deuda
      deudores.sort((a, b) => b.saldoActual - a.saldoActual);

      // Calcular detalles para reclamos
      return deudores.map((d, index) => {
        const ventasPend = (this.data.ventas || [])
          .filter(v => v.clienteId === d.id && (v.saldoPendiente || 0) > 0.01)
          .sort((a, b) => new Date(a.fechaEmision) - new Date(b.fechaEmision));

        const cobs = (this.data.cobranzas || [])
          .filter(c => c.clienteId === d.id)
          .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        const ventaMasVieja = ventasPend.length > 0 ? ventasPend[0] : null;
        const ultimoPago = cobs.length > 0 ? cobs[0] : null;

        return {
          rank: index + 1,
          clienteId: d.id,
          razonSocial: d.razonSocial,
          vendedorId: d.vendedorId,
          vendedorNombre: d.vendedorNombre,
          vendedorColor: d.vendedorColor,
          saldoActual: d.saldoActual,
          telefono: d.telefono || '+54 9 11 4455-8899',
          contactoNombre: d.contactoNombre || d.razonSocial,
          ventasPendientesCount: ventasPend.length,
          ventaMasVieja: ventaMasVieja ? {
            numero: ventaMasVieja.numero,
            fecha: ventaMasVieja.fechaEmision,
            corte: ventaMasVieja.corte,
            saldoPendiente: ventaMasVieja.saldoPendiente,
            diasAtraso: Math.floor((new Date() - new Date(ventaMasVieja.fechaEmision)) / (86400000))
          } : null,
          ultimoPago: ultimoPago ? {
            numero: ultimoPago.numero,
            fecha: ultimoPago.fecha,
            monto: ultimoPago.totalCobrado,
            metodo: ultimoPago.metodo
          } : null
        };
      });
    },

    /**
     * Generador dinámico de plantillas de reclamo de deuda para WhatsApp.
     */
    getMensajeReclamo(clienteId, tipoPlantilla = 'operativo') {
      const cli = this.getCliente(clienteId);
      if (!cli) return '';

      const resumen = this.getClienteResumen(clienteId);
      const ventasPend = (this.data.ventas || [])
        .filter(v => v.clienteId === clienteId && (v.saldoPendiente || 0) > 0.01)
        .sort((a, b) => new Date(a.fechaEmision) - new Date(b.fechaEmision));

      const cobs = (this.data.cobranzas || [])
        .filter(c => c.clienteId === clienteId)
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      const ultimoPago = cobs[0];
      const saldoFmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(resumen.saldoActual).replace('ARS', '$');

      if (tipoPlantilla === 'amable') {
        return `Hola ${cli.contactoNombre || cli.razonSocial}, ¿cómo estás? Te escribimos de Frigorífico para consultar por el saldo de cuenta corriente que asciende a ${saldoFmt}. Avisanos si necesitás el resumen detallado o si coordinamos la cobranza esta semana. ¡Muchas gracias!`;
      }

      if (tipoPlantilla === 'intimacion') {
        const dias = resumen.diasMora > 0 ? resumen.diasMora : 15;
        return `Estimado/a ${cli.razonSocial}: Nos comunicamos del área de Créditos y Cobranzas. Registramos un saldo pendiente de ${saldoFmt} con facturas vencidas hace más de ${dias} días. Le solicitamos regularizar el monto antes de las 18:00 hs para evitar la suspensión preventiva de despachos y carga de camiones con medias reses. CBU Frigorífico: 0070098730000012345678 - Alias: FRIGORIFICO.PAGOS`;
      }

      // Default: 'operativo' (con detalle de ventas y cortes)
      let detalleCortes = '';
      if (ventasPend.length > 0) {
        detalleCortes = '\n*Comprobantes impagos:*\n' + ventasPend.slice(0, 3).map(v => 
          `• Venta ${v.numero} (${v.corte} - ${v.totalKg} kg): ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(v.saldoPendiente).replace('ARS', '$')}`
        ).join('\n');
      }

      let infoPago = '';
      if (ultimoPago) {
        const uPagoFmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(ultimoPago.totalCobrado).replace('ARS', '$');
        infoPago = `\n_Último pago registrado:_ ${uPagoFmt} el ${ultimoPago.fecha} (${ultimoPago.metodo})`;
      }

      return `Hola ${cli.contactoNombre || cli.razonSocial}, te enviamos el estado de cuenta actualizado de Frigorífico:
*Saldo total adeudado:* ${saldoFmt}${infoPago}${detalleCortes}

Por favor confirmar comprobante de transferencia a:
*CBU:* 0070098730000012345678
*Alias:* FRIGORIFICO.PAGOS
*Titular:* Frigorífico Cárnico Central S.A.

¡Muchas gracias!`;
    },

    // =============================================================
    // 7. MÉTRICAS PARA DASHBOARD RESUMEN
    // =============================================================
    getDashboardMetrics(filters = {}) {
      const clientes = this.getClientes({ vendedorId: filters.vendedorId });
      const ventas = this.getVentas({ vendedorId: filters.vendedorId });
      const cobranzas = this.getCobranzas({ vendedorId: filters.vendedorId });

      let totalDeudaGlobal = 0;
      let clientesConDeudaCount = 0;

      clientes.forEach(c => {
        if ((c.saldoActual || 0) > 0.01) {
          totalDeudaGlobal += c.saldoActual;
          clientesConDeudaCount++;
        }
      });

      const totalFacturadoHistorico = ventas.reduce((acc, v) => acc + (v.total || 0), 0);
      const totalCobradoHistorico = cobranzas.reduce((acc, c) => acc + (c.totalCobrado || 0), 0);
      const totalKgHistorico = ventas.reduce((acc, v) => acc + (v.totalKg || 0), 0);

      // Top 5 deudores
      const topDeudores = this.getRankingDeudores({ vendedorId: filters.vendedorId }).slice(0, 5);

      return {
        totalDeudaGlobal,
        clientesConDeudaCount,
        totalClientes: clientes.length,
        totalFacturadoHistorico,
        totalCobradoHistorico,
        totalKgHistorico,
        topDeudores
      };
    },

    // Herramientas adicionales conservadas
    getPlanesPago() {
      return this.data.planesPago || [];
    },
    savePlanPago(plan) {
      if (!this.data.planesPago) this.data.planesPago = [];
      plan.id = plan.id || `PLAN-${Date.now().toString().slice(-4)}`;
      this.data.planesPago.push(plan);
      this.save();
      return plan;
    },

    // =============================================================
    // 7. CONTROL DE ACCESO & WHITELIST DE USUARIOS
    // =============================================================
    initUsuariosWhitelist() {
      if (!this.data.usuarios || this.data.usuarios.length === 0) {
        this.data.usuarios = [
          {
            id: 'USR-ADMIN',
            email: 'nicolasescudero5@gmail.com',
            password: 'admin',
            nombre: 'Nicolás Escudero (Super Admin)',
            rol: 'admin',
            socioAsignado: 'todos',
            estado: 'activo',
            creadoEl: '2026-09-28',
            ultimoAcceso: new Date().toISOString().replace('T', ' ').slice(0, 16)
          },
          {
            id: 'USR-FRANCO',
            email: 'franco@finanzaflow.com',
            password: 'franco2026',
            nombre: 'Franco (Socio)',
            rol: 'socio',
            socioAsignado: 'VEND-FRANCO',
            estado: 'activo',
            creadoEl: '2026-09-28',
            ultimoAcceso: null
          },
          {
            id: 'USR-LUCAS',
            email: 'lucas@finanzaflow.com',
            password: 'lucas2026',
            nombre: 'Lucas (Socio)',
            rol: 'socio',
            socioAsignado: 'VEND-LUCAS',
            estado: 'activo',
            creadoEl: '2026-09-28',
            ultimoAcceso: null
          }
        ];
        this.save();
      }
    },

    getUsuarios(search = '') {
      this.initUsuariosWhitelist();
      let list = this.data.usuarios || [];
      if (search) {
        const s = search.toLowerCase().trim();
        list = list.filter(u => 
          u.email.toLowerCase().includes(s) ||
          u.nombre.toLowerCase().includes(s) ||
          u.rol.toLowerCase().includes(s)
        );
      }
      return list;
    },

    getUsuario(id) {
      this.initUsuariosWhitelist();
      return (this.data.usuarios || []).find(u => u.id === id) || null;
    },

    getUsuarioByEmail(email) {
      this.initUsuariosWhitelist();
      if (!email) return null;
      return (this.data.usuarios || []).find(u => u.email.toLowerCase() === email.toLowerCase().trim()) || null;
    },

    saveUsuario(userData) {
      this.initUsuariosWhitelist();
      if (!userData.email) throw new Error('El correo electrónico es obligatorio.');
      const emailNorm = userData.email.toLowerCase().trim();

      // Si es edición
      if (userData.id) {
        const idx = this.data.usuarios.findIndex(u => u.id === userData.id);
        if (idx !== -1) {
          const dup = this.data.usuarios.find(u => u.email.toLowerCase() === emailNorm && u.id !== userData.id);
          if (dup) throw new Error('Ya existe otro usuario con este correo electrónico.');

          this.data.usuarios[idx] = {
            ...this.data.usuarios[idx],
            email: emailNorm,
            nombre: userData.nombre || this.data.usuarios[idx].nombre,
            password: userData.password || this.data.usuarios[idx].password,
            rol: userData.rol || this.data.usuarios[idx].rol,
            socioAsignado: userData.socioAsignado || this.data.usuarios[idx].socioAsignado,
            estado: userData.estado || this.data.usuarios[idx].estado
          };
          this.save();
          return this.data.usuarios[idx];
        }
      }

      // Si es creación nueva
      const dup = this.data.usuarios.find(u => u.email.toLowerCase() === emailNorm);
      if (dup) throw new Error('Ya existe un usuario en la whitelist con este correo electrónico.');

      const nuevoUsuario = {
        id: `USR-${Date.now().toString().slice(-5)}`,
        email: emailNorm,
        nombre: userData.nombre || emailNorm.split('@')[0],
        password: userData.password || '123456',
        rol: userData.rol || 'operador',
        socioAsignado: userData.socioAsignado || 'todos',
        estado: userData.estado || 'activo',
        creadoEl: new Date().toISOString().split('T')[0],
        ultimoAcceso: null
      };

      this.data.usuarios.push(nuevoUsuario);
      this.save();
      return nuevoUsuario;
    },

    toggleBajaUsuario(id) {
      this.initUsuariosWhitelist();
      const u = this.data.usuarios.find(item => item.id === id);
      if (!u) throw new Error('Usuario no encontrado.');
      if (u.email.toLowerCase() === 'nicolasescudero5@gmail.com') {
        throw new Error('No es posible dar de baja al Super Administrador principal.');
      }
      u.estado = u.estado === 'activo' ? 'inactivo' : 'activo';
      this.save();
      return u;
    },

    deleteUsuario(id) {
      this.initUsuariosWhitelist();
      const u = this.data.usuarios.find(item => item.id === id);
      if (!u) throw new Error('Usuario no encontrado.');
      if (u.email.toLowerCase() === 'nicolasescudero5@gmail.com') {
        throw new Error('No es posible eliminar al Super Administrador principal.');
      }
      this.data.usuarios = this.data.usuarios.filter(item => item.id !== id);
      this.save();
      return true;
    },

    autenticarUsuario(email, password) {
      this.initUsuariosWhitelist();
      const u = this.getUsuarioByEmail(email);
      if (!u) {
        return { ok: false, error: 'El correo no se encuentra autorizado en la whitelist.' };
      }
      if (u.estado === 'inactivo') {
        return { ok: false, error: 'Este usuario ha sido dado de baja por el Administrador.' };
      }
      if (u.password && u.password !== password) {
        return { ok: false, error: 'Contraseña incorrecta.' };
      }
      u.ultimoAcceso = new Date().toISOString().replace('T', ' ').slice(0, 16);
      this.save();
      this.setUsuarioActual(u);
      return { ok: true, usuario: u };
    },

    getUsuarioActual() {
      try {
        if (typeof localStorage !== 'undefined') {
          const cur = localStorage.getItem('finanzaflow_current_user');
          if (cur) return JSON.parse(cur);
        }
      } catch (e) {}
      // Por defecto Nicolás Escudero
      return this.getUsuarioByEmail('nicolasescudero5@gmail.com');
    },

    setUsuarioActual(user) {
      try {
        if (typeof localStorage !== 'undefined') {
          if (user) {
            localStorage.setItem('finanzaflow_current_user', JSON.stringify({
              id: user.id,
              email: user.email,
              nombre: user.nombre,
              rol: user.rol,
              socioAsignado: user.socioAsignado
            }));
          } else {
            localStorage.removeItem('finanzaflow_current_user');
          }
        }
      } catch (e) {}
    }
  };


  // Exponer en window / global
  if (typeof window !== 'undefined') {
    window.DataStore = DataStore;
    DataStore.init();
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataStore;
  }

})(typeof window !== 'undefined' ? window : global);
