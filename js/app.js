/**
 * APP.JS - Lógica de la aplicación "Mis Inversiones"
 * Control de vistas, tema claro/oscuro, Lightweight Charts y ApexCharts.
 * Conectado a la API real (sin datos de ejemplo).
 */

(function () {
  'use strict';

  // Estado global de la aplicación en memoria
  var state = {
    mode: 'rendimiento',     // 'valor' | 'rendimiento'
    chartType: 'line',       // 'line' | 'bar'
    range: 'MAX',            // '1S' | '1M' | '1A' | 'YTD' | 'MAX'
    hiddenValues: false,     // ocultar saldos con '•••••'
    moneda: 'USD',           // 'USD' | 'ARS', viene del getDashboard (fija por usuario)
    theme: localStorage.getItem('mi_inversiones_theme') || 'light',
    dashboard: null,         // datos del getDashboard
    historial: null,         // datos del getHistorial
    operaciones: null        // datos del getOperaciones
  };

  // Referencias a los gráficos
  var lwChart = null;
  var lwSeries = null;
  var apexDonut = null;

  /* ==========================================================================
     1. FORMATEADORES NUMÉRICOS
     ========================================================================== */
  var fmt = {
    // Amounts in the user's currency (ARS or USD, set per user in the Usuarios sheet)
    money: function (n) { return new Intl.NumberFormat('es-AR', { style: 'currency', currency: state.moneda }).format(n); },
    pct: function (n) { return (n >= 0 ? '+' : '') + n.toFixed(2).replace('.', ',') + '%'; },
    num: function (n) { return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 }).format(n); }
  };

  /* ==========================================================================
     2. GESTIÓN DEL TEMA (CLARO / OSCURO)
     ========================================================================== */
  function aplicarTema(t) {
    state.theme = t;
    if (t === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('mi_inversiones_theme', t);

    var btn = document.getElementById('btnThemeToggle');
    if (btn) btn.textContent = t === 'dark' ? '☀️' : '🌙';

    actualizarOpcionesGraficos();
  }

  function initTema() {
    aplicarTema(state.theme);
    var btn = document.getElementById('btnThemeToggle');
    if (btn) {
      btn.addEventListener('click', function () {
        aplicarTema(state.theme === 'dark' ? 'light' : 'dark');
      });
    }
  }

  /* ==========================================================================
     3. NAVEGACIÓN ENTRE SECCIONES (PORTFOLIO, CARTERA, OPERACIONES)
     ========================================================================== */
  function cambiarSeccion(sectionId) {
    document.querySelectorAll('.desktop-nav .nav-tab-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.section === sectionId);
    });

    document.querySelectorAll('.mobile-bottom-bar .mobile-nav-item').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.section === sectionId);
    });

    ['portfolio', 'cartera', 'operaciones'].forEach(function (id) {
      var el = document.getElementById('section-' + id);
      if (el) el.classList.toggle('hidden', id !== sectionId);
    });

    if (sectionId === 'portfolio') {
      setTimeout(function () {
        var container = document.getElementById('mainChartContainer');
        if (lwChart && container) lwChart.applyOptions({ width: container.clientWidth });
      }, 50);
    }

    // Lazy-load data when switching sections
    if (sectionId === 'operaciones' && !state.operaciones) {
      cargarOperaciones();
    }
  }

  function initNavegacion() {
    document.querySelectorAll('[data-section]').forEach(function (btn) {
      btn.addEventListener('click', function () { cambiarSeccion(btn.dataset.section); });
    });
  }

  /* ==========================================================================
     4. ESTADOS DE CARGA Y ERROR
     ========================================================================== */
  function mostrarCargando(containerId, texto) {
    var el = document.getElementById(containerId);
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
    var p = document.createElement('p');
    p.className = 'loading-text';
    p.textContent = texto || 'Cargando...';
    el.appendChild(p);
  }

  function mostrarError(containerId, texto) {
    var el = document.getElementById(containerId);
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
    var p = document.createElement('p');
    p.className = 'error-text';
    p.textContent = texto || 'Error al cargar datos.';
    el.appendChild(p);
  }

  /* ==========================================================================
     5. MÉTRICA HERO Y SELECTOR VALOR / RENDIMIENTO
     ========================================================================== */
  function renderHero() {
    var valEl = document.getElementById('heroMainValue');
    var subValEl = document.getElementById('heroSubValue');
    var subIconEl = document.getElementById('heroSubIcon');

    if (!state.dashboard || !state.dashboard.totales) {
      if (valEl) valEl.textContent = '—';
      if (subValEl) subValEl.textContent = '';
      return;
    }

    var t = state.dashboard.totales;

    if (state.hiddenValues) {
      valEl.textContent = '••••••••';
      subValEl.textContent = '(••••••)';
      return;
    }

    if (state.mode === 'rendimiento') {
      valEl.textContent = fmt.pct(t.gananciaPct);
      valEl.className = 'hero-number mono ' + (t.gananciaPct >= 0 ? 'pos' : 'neg');
      subIconEl.textContent = t.gananciaNoRealizada >= 0 ? '↗' : '↘';
      subValEl.textContent = '(' + (t.gananciaNoRealizada >= 0 ? '+' : '') + fmt.money(t.gananciaNoRealizada) + ')';
    } else {
      valEl.textContent = fmt.money(t.valor);
      valEl.className = 'hero-number mono';
      subIconEl.textContent = '💼';
      subValEl.textContent = '(Invertido: ' + fmt.money(t.invertido) + ')';
    }
  }

  function initControlesHero() {
    var btnValor = document.getElementById('btnModeValor');
    var btnRendimiento = document.getElementById('btnModeRendimiento');
    var btnEye = document.getElementById('btnToggleVisibility');

    btnValor.addEventListener('click', function () {
      state.mode = 'valor';
      btnValor.classList.add('active');
      btnRendimiento.classList.remove('active');
      renderHero();
      renderMainChartData();
    });

    btnRendimiento.addEventListener('click', function () {
      state.mode = 'rendimiento';
      btnRendimiento.classList.add('active');
      btnValor.classList.remove('active');
      renderHero();
      renderMainChartData();
    });

    btnEye.addEventListener('click', function () {
      state.hiddenValues = !state.hiddenValues;
      btnEye.textContent = state.hiddenValues ? '🔒' : '👁️';
      renderHero();
      renderInversionesAbiertas();
      renderCartera();
    });
  }

  /* ==========================================================================
     6. GRÁFICO PRINCIPAL (LIGHTWEIGHT CHARTS)
     ========================================================================== */
  // Local date as 'yyyy-mm-dd' (toISOString would use UTC and switch day at 21:00 in Argentina)
  function fechaLocalHoy() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function buildSerieFromHistorial() {
    if (!state.historial || state.historial.length === 0) return [];
    var filas = state.historial.slice();

    // Today's point uses the same live totals as the hero, so the chart and the % always match
    var t = state.dashboard && state.dashboard.totales;
    if (t && t.invertido > 0) {
      var hoy = fechaLocalHoy();
      filas = filas.filter(function (h) { return h.fecha !== hoy; });
      filas.push({ fecha: hoy, invertido: t.invertido, valor: t.valor });
    }

    return filas.map(function (h) {
      var inv = Number(h.invertido) || 0;
      var val = Number(h.valor) || 0;
      var rendimiento = inv > 0 ? ((val - inv) / inv) * 100 : 0;
      return {
        time: h.fecha,
        valor: val,
        rendimiento: rendimiento
      };
    }).sort(function (a, b) { return a.time.localeCompare(b.time); });
  }

  function filtrarSeriePorRango(serie, rango) {
    if (!serie || serie.length === 0) return [];
    if (rango === 'MAX') return serie;

    var now = new Date();
    var cutoff;
    if (rango === '1S') {
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (rango === '1M') {
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (rango === '1A') {
      cutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    } else if (rango === 'YTD') {
      cutoff = new Date(now.getFullYear(), 0, 1);
    } else {
      return serie;
    }
    var cutoffStr = cutoff.toISOString().slice(0, 10);
    return serie.filter(function (p) { return p.time >= cutoffStr; });
  }

  function initLightweightChart() {
    var container = document.getElementById('mainChartContainer');
    if (!container) return;

    container.innerHTML = '';
    var esOscuro = state.theme === 'dark';

    lwChart = LightweightCharts.createChart(container, {
      width: container.clientWidth,
      height: 280,
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: esOscuro ? '#9ca3af' : '#6b7280',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: 11
      },
      grid: {
        vertLines: { color: esOscuro ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)' },
        horzLines: { color: esOscuro ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)' }
      },
      timeScale: {
        borderVisible: false,
        timeVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.15, bottom: 0.15 }
      },
      crosshair: {
        vertLine: { color: esOscuro ? '#3b82f6' : '#2563eb', width: 1, style: 2 },
        horzLine: { color: esOscuro ? '#3b82f6' : '#2563eb', width: 1, style: 2 }
      }
    });

    window.addEventListener('resize', function () {
      if (lwChart && container) lwChart.applyOptions({ width: container.clientWidth });
    });

    renderMainChartData();
  }

  function renderMainChartData() {
    if (!lwChart) return;

    if (lwSeries) {
      lwChart.removeSeries(lwSeries);
      lwSeries = null;
    }

    var serie = buildSerieFromHistorial();
    var serieFiltrada = filtrarSeriePorRango(serie, state.range);

    if (serieFiltrada.length === 0) {
      // Show empty state inside chart
      return;
    }

    if (state.chartType === 'bar') {
      lwSeries = lwChart.addHistogramSeries({
        color: state.mode === 'rendimiento' ? '#10b981' : '#2563eb'
      });

      var datos = serieFiltrada.map(function (item) {
        var val = state.mode === 'rendimiento' ? item.rendimiento : item.valor;
        return {
          time: item.time,
          value: val,
          color: val >= 0 ? '#10b981' : '#ef4444'
        };
      });
      lwSeries.setData(datos);

    } else {
      if (state.mode === 'rendimiento') {
        lwSeries = lwChart.addBaselineSeries({
          baseValue: { type: 'price', price: 0 },
          topLineColor: '#10b981',
          topFillColor1: 'rgba(16, 185, 129, 0.28)',
          topFillColor2: 'rgba(16, 185, 129, 0.02)',
          bottomLineColor: '#ef4444',
          bottomFillColor1: 'rgba(239, 68, 68, 0.02)',
          bottomFillColor2: 'rgba(239, 68, 68, 0.28)',
          lineWidth: 2
        });

        var datosR = serieFiltrada.map(function (item) {
          return { time: item.time, value: item.rendimiento };
        });
        lwSeries.setData(datosR);

      } else {
        lwSeries = lwChart.addAreaSeries({
          topColor: 'rgba(37, 99, 235, 0.35)',
          bottomColor: 'rgba(37, 99, 235, 0.01)',
          lineColor: '#2563eb',
          lineWidth: 2
        });

        var datosV = serieFiltrada.map(function (item) {
          return { time: item.time, value: item.valor };
        });
        lwSeries.setData(datosV);
      }
    }

    lwChart.timeScale().fitContent();
  }

  function initControlesGrafico() {
    document.querySelectorAll('.range-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.range-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        state.range = btn.dataset.range;
        renderMainChartData();
      });
    });

    var btnLine = document.getElementById('btnChartLine');
    var btnBar = document.getElementById('btnChartBar');

    btnLine.addEventListener('click', function () {
      state.chartType = 'line';
      btnLine.classList.add('active');
      btnBar.classList.remove('active');
      renderMainChartData();
    });

    btnBar.addEventListener('click', function () {
      state.chartType = 'bar';
      btnBar.classList.add('active');
      btnLine.classList.remove('active');
      renderMainChartData();
    });
  }

  /* ==========================================================================
     7. LISTA DE INVERSIONES ABIERTAS (TARJETAS - con textContent seguro)
     ========================================================================== */
  function renderInversionesAbiertas() {
    var contenedor = document.getElementById('openPositionsList');
    var titulo = document.getElementById('openPositionsTitle');

    if (!contenedor) return;
    if (!state.dashboard || !state.dashboard.posiciones) {
      mostrarCargando('openPositionsList', 'Cargando posiciones...');
      return;
    }

    var posiciones = state.dashboard.posiciones;
    if (titulo) titulo.textContent = 'Inversiones abiertas (' + posiciones.length + ')';

    // Clear container safely
    while (contenedor.firstChild) contenedor.removeChild(contenedor.firstChild);

    posiciones.forEach(function (p) {
      var esPositivo = (p.ganancia || 0) >= 0;
      var pctVal = p.gananciaPct !== null && p.gananciaPct !== undefined ? p.gananciaPct : 0;

      var item = document.createElement('div');
      item.className = 'position-item';

      var left = document.createElement('div');
      left.className = 'pos-left';

      var avatar = document.createElement('div');
      avatar.className = 'ticker-avatar';
      avatar.textContent = (p.ticker || '').slice(0, 3);

      var info = document.createElement('div');
      var tickerName = document.createElement('div');
      tickerName.className = 'ticker-name';
      tickerName.textContent = p.ticker || '';
      var tickerDesc = document.createElement('div');
      tickerDesc.className = 'ticker-desc';
      tickerDesc.textContent = p.categoria || '';
      info.appendChild(tickerName);
      info.appendChild(tickerDesc);

      // Variación del día contra el cierre anterior (Yahoo Finance)
      if (typeof p.variacionDia === 'number') {
        var dayEl = document.createElement('div');
        dayEl.className = 'pos-day mono ' + (p.variacionDia >= 0 ? 'pos' : 'neg');
        dayEl.textContent = 'Hoy ' + fmt.pct(p.variacionDia);
        info.appendChild(dayEl);
      }

      left.appendChild(avatar);
      left.appendChild(info);

      var right = document.createElement('div');
      right.className = 'pos-right';

      var pctEl = document.createElement('div');
      pctEl.className = 'pos-pct mono ' + (esPositivo ? 'pos' : 'neg');
      pctEl.textContent = state.hiddenValues ? '•••' : fmt.pct(pctVal);

      var usdEl = document.createElement('div');
      usdEl.className = 'pos-usd mono ' + (esPositivo ? 'pos' : 'neg');
      usdEl.textContent = state.hiddenValues ? '•••••' : ((esPositivo ? '+' : '') + fmt.money(p.ganancia || 0));

      right.appendChild(pctEl);
      right.appendChild(usdEl);

      item.appendChild(left);
      item.appendChild(right);
      contenedor.appendChild(item);
    });
  }

  /* ==========================================================================
     8. DONA DE DISTRIBUCIÓN POR ACTIVO (APEXCHARTS)
     ========================================================================== */
  function initApexDonut() {
    var el = document.getElementById('distributionDonut');
    if (!el) return;

    if (!state.dashboard || !state.dashboard.posiciones || state.dashboard.posiciones.length === 0) {
      return;
    }

    var posiciones = state.dashboard.posiciones;
    var series = posiciones.map(function (p) { return p.valorActual || 0; });
    var labels = posiciones.map(function (p) { return p.ticker || ''; });
    var totalVal = state.dashboard.totales ? state.dashboard.totales.valor : 0;

    var esOscuro = state.theme === 'dark';

    var options = {
      chart: {
        type: 'donut',
        height: 290,
        background: 'transparent',
        fontFamily: 'Plus Jakarta Sans, sans-serif'
      },
      series: series,
      labels: labels,
      colors: ['#059669', '#2563eb', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316'],
      stroke: {
        colors: [esOscuro ? '#121824' : '#ffffff'],
        width: 2
      },
      dataLabels: { enabled: false },
      legend: {
        position: 'bottom',
        labels: { colors: esOscuro ? '#9ca3af' : '#6b7280' },
        itemMargin: { horizontal: 8, vertical: 4 }
      },
      tooltip: {
        theme: esOscuro ? 'dark' : 'light',
        y: {
          formatter: function (val) { return state.hiddenValues ? '•••••' : fmt.money(val); }
        }
      },
      plotOptions: {
        pie: {
          donut: {
            size: '72%',
            labels: {
              show: true,
              total: {
                show: true,
                label: 'Total Cartera',
                color: esOscuro ? '#9ca3af' : '#6b7280',
                formatter: function () { return state.hiddenValues ? '•••••' : fmt.money(totalVal); }
              }
            }
          }
        }
      }
    };

    if (apexDonut) apexDonut.destroy();
    apexDonut = new ApexCharts(el, options);
    apexDonut.render();
  }

  /* ==========================================================================
     9. SECCIÓN CARTERA: TABLA COMPLETA DE POSICIONES (con textContent seguro)
     ========================================================================== */
  function renderCartera() {
    var tbody = document.getElementById('tableCarteraBody');
    if (!tbody) return;

    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

    if (!state.dashboard || !state.dashboard.posiciones) {
      var trMsg = document.createElement('tr');
      var tdMsg = document.createElement('td');
      tdMsg.setAttribute('colspan', '7');
      tdMsg.textContent = 'Cargando cartera...';
      trMsg.appendChild(tdMsg);
      tbody.appendChild(trMsg);
      return;
    }

    state.dashboard.posiciones.forEach(function (p) {
      var tr = document.createElement('tr');

      // Activo
      var tdActivo = document.createElement('td');
      var strong = document.createElement('strong');
      strong.textContent = p.ticker || '';
      tdActivo.appendChild(strong);
      var catDiv = document.createElement('div');
      var catBadge = document.createElement('span');
      catBadge.className = 'badge-pill';
      catBadge.textContent = p.categoria || '';
      catDiv.appendChild(catBadge);
      tdActivo.appendChild(catDiv);
      tr.appendChild(tdActivo);

      // Cantidad
      var tdCant = document.createElement('td');
      tdCant.className = 'mono';
      tdCant.textContent = state.hiddenValues ? '••' : fmt.num(p.cantidad || 0);
      tr.appendChild(tdCant);

      // Precio Promedio
      var tdPP = document.createElement('td');
      tdPP.className = 'mono';
      tdPP.textContent = state.hiddenValues ? '•••' : fmt.money(p.precioPromedio || 0);
      tr.appendChild(tdPP);

      // Precio Actual
      var tdPA = document.createElement('td');
      tdPA.className = 'mono';
      tdPA.textContent = p.precioActual !== null && p.precioActual !== undefined ? fmt.money(p.precioActual) : '—';
      tr.appendChild(tdPA);

      // Invertido
      var tdInv = document.createElement('td');
      tdInv.className = 'mono';
      tdInv.textContent = state.hiddenValues ? '••••' : fmt.money(p.costoUSD || 0);
      tr.appendChild(tdInv);

      // Valor Actual
      var tdVal = document.createElement('td');
      tdVal.className = 'mono';
      tdVal.style.fontWeight = '700';
      tdVal.textContent = state.hiddenValues ? '••••' : fmt.money(p.valorActual || 0);
      tr.appendChild(tdVal);

      // Resultado
      var tdRes = document.createElement('td');
      var esPos = (p.ganancia || 0) >= 0;
      var divRes = document.createElement('div');
      divRes.className = 'mono ' + (esPos ? 'pos' : 'neg');
      divRes.style.fontWeight = '700';
      divRes.textContent = state.hiddenValues ? '•••' : fmt.money(p.ganancia || 0);
      tdRes.appendChild(divRes);

      var smallRes = document.createElement('small');
      smallRes.className = 'mono ' + (esPos ? 'pos' : 'neg');
      var pctVal = p.gananciaPct !== null && p.gananciaPct !== undefined ? p.gananciaPct : 0;
      smallRes.textContent = state.hiddenValues ? '••' : fmt.pct(pctVal);
      tdRes.appendChild(smallRes);
      tr.appendChild(tdRes);

      tbody.appendChild(tr);
    });
  }

  /* ==========================================================================
     10. SECCIÓN OPERACIONES: HISTORIAL (con textContent seguro)
     ========================================================================== */
  function renderOperaciones() {
    var tbody = document.getElementById('tableOperationsBody');
    if (!tbody) return;

    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

    if (!state.operaciones) {
      var trMsg = document.createElement('tr');
      var tdMsg = document.createElement('td');
      tdMsg.setAttribute('colspan', '9');
      tdMsg.textContent = 'Cargando operaciones...';
      trMsg.appendChild(tdMsg);
      tbody.appendChild(trMsg);
      return;
    }

    if (state.operaciones.length === 0) {
      var trEmpty = document.createElement('tr');
      var tdEmpty = document.createElement('td');
      tdEmpty.setAttribute('colspan', '9');
      tdEmpty.textContent = 'No hay operaciones registradas.';
      trEmpty.appendChild(tdEmpty);
      tbody.appendChild(trEmpty);
      return;
    }

    // Show newest first
    var sorted = state.operaciones.slice().sort(function (a, b) {
      return (b.fecha || '').localeCompare(a.fecha || '');
    });

    sorted.forEach(function (o) {
      var tr = document.createElement('tr');

      // Fecha
      var tdFecha = document.createElement('td');
      tdFecha.className = 'mono';
      tdFecha.textContent = o.fecha || '';
      tr.appendChild(tdFecha);

      // Tipo
      var tdTipo = document.createElement('td');
      var spanTipo = document.createElement('span');
      spanTipo.className = 'badge-pill ' + (o.tipo === 'Compra' ? 'badge-compra' : 'badge-venta');
      spanTipo.textContent = o.tipo || '';
      tdTipo.appendChild(spanTipo);
      tr.appendChild(tdTipo);

      // Ticker
      var tdTicker = document.createElement('td');
      var strongT = document.createElement('strong');
      strongT.textContent = o.ticker || '';
      tdTicker.appendChild(strongT);
      tr.appendChild(tdTicker);

      // Categoría
      var tdCat = document.createElement('td');
      var spanCat = document.createElement('span');
      spanCat.className = 'badge-pill';
      spanCat.textContent = o.categoria || '—';
      tdCat.appendChild(spanCat);
      tr.appendChild(tdCat);

      // Cantidad
      var tdCant = document.createElement('td');
      tdCant.className = 'mono';
      tdCant.textContent = fmt.num(o.cantidad || 0);
      tr.appendChild(tdCant);

      // Precio
      var tdPrecio = document.createElement('td');
      tdPrecio.className = 'mono';
      tdPrecio.textContent = fmt.money(o.precio || 0);
      tr.appendChild(tdPrecio);

      // TC
      var tdTC = document.createElement('td');
      tdTC.className = 'mono';
      tdTC.textContent = o.tc ? '$ ' + fmt.num(o.tc) : '—';
      tr.appendChild(tdTC);

      // Comisión
      var tdCom = document.createElement('td');
      tdCom.className = 'mono';
      tdCom.textContent = o.comision ? fmt.money(o.comision) : '$0';
      tr.appendChild(tdCom);

      // Nota
      var tdNota = document.createElement('td');
      tdNota.className = 'text-muted';
      tdNota.textContent = o.nota || '—';
      tr.appendChild(tdNota);

      tbody.appendChild(tr);
    });
  }

  /* ==========================================================================
     11. FORMULARIO DE NUEVA OPERACIÓN
     ========================================================================== */
  function initFormularioOperaciones() {
    var form = document.getElementById('formNewOperation');
    var inputFecha = document.getElementById('opFecha');
    var btnSubmit = document.getElementById('btnSubmitOp');
    if (!form) return;

    if (inputFecha) inputFecha.value = new Date().toISOString().split('T')[0];

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var payload = {
        fecha: document.getElementById('opFecha').value,
        tipo: document.getElementById('opTipo').value,
        ticker: document.getElementById('opTicker').value.toUpperCase().trim(),
        categoria: document.getElementById('opCategoria').value,
        cantidad: parseFloat(document.getElementById('opCantidad').value) || 0,
        precio: parseFloat(document.getElementById('opPrecio').value) || 0,
        tc: parseFloat(document.getElementById('opTC').value) || 0,
        comision: parseFloat(document.getElementById('opComision').value) || 0,
        nota: document.getElementById('opNota').value.trim()
      };

      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Guardando...';
      }

      window.PandorApi.addOperacion(payload)
        .then(function () {
          form.reset();
          if (inputFecha) inputFecha.value = new Date().toISOString().split('T')[0];
          // Reload both operaciones and dashboard
          return Promise.all([cargarOperaciones(), cargarDashboard()]);
        })
        .catch(function (err) {
          var errorEl = document.getElementById('form-error');
          if (errorEl) {
            errorEl.textContent = err.message || 'Error al guardar la operación.';
            errorEl.style.display = 'block';
            setTimeout(function () { errorEl.style.display = 'none'; }, 5000);
          }
        })
        .finally(function () {
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Guardar Operación';
          }
        });
    });
  }

  /* ==========================================================================
     12. ACTUALIZAR COLORES DE GRÁFICOS AL CAMBIAR TEMA
     ========================================================================== */
  function actualizarOpcionesGraficos() {
    var esOscuro = state.theme === 'dark';

    if (lwChart) {
      lwChart.applyOptions({
        layout: { textColor: esOscuro ? '#9ca3af' : '#6b7280' },
        grid: {
          vertLines: { color: esOscuro ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)' },
          horzLines: { color: esOscuro ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)' }
        }
      });
      renderMainChartData();
    }

    if (apexDonut) {
      apexDonut.updateOptions({
        stroke: { colors: [esOscuro ? '#121824' : '#ffffff'] },
        legend: { labels: { colors: esOscuro ? '#9ca3af' : '#6b7280' } },
        tooltip: { theme: esOscuro ? 'dark' : 'light' },
        plotOptions: {
          pie: {
            donut: {
              labels: {
                total: { color: esOscuro ? '#9ca3af' : '#6b7280' }
              }
            }
          }
        }
      });
    }
  }

  /* ==========================================================================
     13. CARGA DE DATOS DESDE LA API
     ========================================================================== */
  function cargarDashboard() {
    return window.PandorApi.getDashboard()
      .then(function (data) {
        state.dashboard = data;
        state.moneda = data.moneda === 'ARS' ? 'ARS' : 'USD';
        aplicarMonedaFormulario();
        if (state.operaciones) renderOperaciones();
        renderMercado();
        renderHero();
        renderMainChartData(); // refresh today's point with the new live totals
        renderInversionesAbiertas();
        initApexDonut();
        renderCartera();
      })
      .catch(function (err) {
        mostrarError('openPositionsList', 'Error: ' + err.message);
      });
  }

  // Live market cards (built with createElement: data comes from the API).
  // The backend already sends the right NVIDIA quote for the user's currency.
  var MERCADO_ORDEN = ['mep', 'cripto', 'oficial', 'nvda', 'nvdaBa'];

  function renderMercado() {
    var grid = document.getElementById('marketGrid');
    var mercado = state.dashboard && state.dashboard.mercado;
    if (!grid || !mercado) return;
    while (grid.firstChild) grid.removeChild(grid.firstChild);

    var horas = [];
    MERCADO_ORDEN.forEach(function (clave) {
      var i = mercado[clave];
      if (!i) return;
      if (i.hora) horas.push(i.hora);

      var card = document.createElement('div');
      card.className = 'card market-card';

      var nombre = document.createElement('div');
      nombre.className = 'market-name';
      nombre.textContent = i.nombre || clave;

      var precio = document.createElement('div');
      precio.className = 'market-price mono';
      if (typeof i.valor !== 'number') {
        precio.textContent = 'No disponible';
      } else {
        var n = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(i.valor);
        precio.textContent = (i.moneda === 'USD' ? 'US$ ' : '$ ') + n;
      }

      var variacion = document.createElement('div');
      variacion.className = 'market-change mono';
      if (typeof i.variacion === 'number') {
        variacion.className += i.variacion >= 0 ? ' pos' : ' neg';
        variacion.textContent = fmt.pct(i.variacion) + ' hoy';
      }

      var detalle = document.createElement('div');
      detalle.className = 'market-detail';
      detalle.textContent = i.detalle || '';

      card.appendChild(nombre);
      card.appendChild(precio);
      card.appendChild(variacion);
      card.appendChild(detalle);
      grid.appendChild(card);
    });

    var hora = document.getElementById('marketTime');
    if (hora) hora.textContent = horas.length ? 'Actualizado ' + horas.sort()[horas.length - 1] : '';
  }

  // Adapts the operation form labels to the user's currency.
  // ARS users enter price and commission in pesos, so the exchange rate field is hidden.
  function aplicarMonedaFormulario() {
    var enPesos = state.moneda === 'ARS';
    var badge = document.getElementById('currencyBadge');
    if (badge) badge.textContent = enPesos ? '🇦🇷 ARS' : '🇺🇸 US$';
    var setText = function (selector, text) {
      var el = document.querySelector(selector);
      if (el) el.textContent = text;
    };
    setText('label[for="opPrecio"]', enPesos ? 'Precio (ARS)' : 'Precio (USD)');
    setText('label[for="opComision"]', enPesos ? 'Comisión (ARS)' : 'Comisión (USD)');
    var precio = document.getElementById('opPrecio');
    if (precio) precio.placeholder = enPesos ? '$ 0,00' : 'US$ 0.00';
    var tc = document.getElementById('opTC');
    if (tc && tc.closest('.form-field')) tc.closest('.form-field').style.display = enPesos ? 'none' : '';
  }

  function cargarHistorial() {
    return window.PandorApi.getHistorial()
      .then(function (data) {
        state.historial = data || [];
        renderMainChartData();
      })
      .catch(function () {
        state.historial = [];
        renderMainChartData();
      });
  }

  function cargarOperaciones() {
    return window.PandorApi.getOperaciones()
      .then(function (data) {
        state.operaciones = data || [];
        renderOperaciones();
      })
      .catch(function (err) {
        mostrarError('tableOperationsBody', 'Error: ' + err.message);
      });
  }

  /**
   * Entry point called by auth module after login.
   */
  window.cargarDatosApp = function () {
    // Show loading states
    var heroVal = document.getElementById('heroMainValue');
    if (heroVal) heroVal.textContent = 'Cargando...';

    mostrarCargando('openPositionsList', 'Conectando con la API...');

    var loading = Promise.all([cargarDashboard(), cargarHistorial()])
      .then(function () {
        // Chart needs data before rendering
        if (!lwChart) {
          initLightweightChart();
        } else {
          renderMainChartData();
        }
      });

    iniciarRefrescoAutomatico();
    return loading; // lets the welcome screen hide when data is ready
  };

  /* ==========================================================================
     13b. REFRESCO AUTOMÁTICO (precios y gráfico)
     ========================================================================== */
  // Cada 2 minutos: más seguido gasta la cuota diaria de UrlFetch de Apps Script.
  var REFRESCO_MS = 2 * 60 * 1000;
  var refrescoTimer = null;

  function iniciarRefrescoAutomatico() {
    if (refrescoTimer) return; // evita intervalos duplicados si se vuelve a loguear
    refrescoTimer = setInterval(function () {
      // Solo refresca si hay sesión y la pestaña está visible
      if (document.hidden || !window.PandorAuth || !window.PandorAuth.getToken()) return;
      Promise.all([cargarDashboard(), cargarHistorial()]);
    }, REFRESCO_MS);
  }

  /* ==========================================================================
     14. LOGOUT
     ========================================================================== */
  function initLogout() {
    var btn = document.getElementById('btnLogout');
    if (btn) {
      btn.addEventListener('click', function () {
        if (window.PandorAuth) window.PandorAuth.logout();
      });
    }
  }

  /* ==========================================================================
     INICIALIZACIÓN AL CARGAR EL DOM
     ========================================================================== */
  window.addEventListener('DOMContentLoaded', function () {
    initTema();
    initNavegacion();
    initControlesHero();
    initControlesGrafico();
    initFormularioOperaciones();
    initLogout();

    // Auth handles showing login or app + triggering cargarDatosApp
    if (window.PandorAuth) {
      window.PandorAuth.init();
    }
  });

})();
