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
    range: 'MAX',            // '1D' | '1S' | '1M' | '1A' | 'YTD' | 'MAX'
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
    // Amount in a given currency (an operation can be in ARS or USD)
    moneyIn: function (n, moneda) { return new Intl.NumberFormat('es-AR', { style: 'currency', currency: moneda === 'ARS' || moneda === 'USD' ? moneda : state.moneda }).format(n); },
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

    ['portfolio', 'cartera', 'operaciones', 'noticias'].forEach(function (id) {
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
    if (sectionId === 'noticias' && !noticias.datos && !noticias.cargando) {
      cargarNoticias();
    }
  }

  /* ==========================================================================
     NOTICIAS (Yahoo Finance + newsrooms, from the backend)
     ========================================================================== */
  var noticias = { datos: null, cargando: false, filtro: 'TODOS' };

  function cargarNoticias() {
    noticias.cargando = true;
    mostrarCargando('newsList', 'Buscando noticias...');
    return window.PandorApi.getNoticias()
      .then(function (data) {
        noticias.datos = data || { tickers: [], noticias: [] };
        if (noticias.datos.tickers.indexOf(noticias.filtro) === -1) noticias.filtro = 'TODOS';
        renderNoticias();
      })
      .catch(function (err) {
        mostrarError('newsList', 'Error: ' + err.message);
      })
      .then(function () { noticias.cargando = false; });
  }

  // "hace 5 min", "hace 3 h", "hace 2 días" or the date
  function haceCuanto(iso) {
    if (!iso) return '';
    var ms = Date.now() - new Date(iso).getTime();
    if (isNaN(ms)) return '';
    var min = Math.round(ms / 60000);
    if (min < 1) return 'recién';
    if (min < 60) return 'hace ' + min + ' min';
    var h = Math.round(min / 60);
    if (h < 24) return 'hace ' + h + ' h';
    var d = Math.round(h / 24);
    if (d < 7) return 'hace ' + d + (d === 1 ? ' día' : ' días');
    return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  }

  function renderNoticias() {
    var filtros = document.getElementById('newsFilters');
    var lista = document.getElementById('newsList');
    if (!filtros || !lista || !noticias.datos) return;
    while (filtros.firstChild) filtros.removeChild(filtros.firstChild);
    while (lista.firstChild) lista.removeChild(lista.firstChild);

    ['TODOS'].concat(noticias.datos.tickers).forEach(function (tk) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'news-filter' + (noticias.filtro === tk ? ' active' : '');
      b.textContent = tk === 'TODOS' ? 'Todas' : tk;
      b.addEventListener('click', function () {
        noticias.filtro = tk;
        renderNoticias();
      });
      filtros.appendChild(b);
    });

    var items = noticias.datos.noticias.filter(function (n) {
      return noticias.filtro === 'TODOS' || n.tickers.indexOf(noticias.filtro) !== -1;
    });

    if (!items.length) {
      var vacio = document.createElement('p');
      vacio.className = 'loading-text';
      vacio.textContent = noticias.datos.tickers.length
        ? 'No hay noticias por ahora.'
        : 'No seguís ningún activo. Agregalos con "Editar" en el Mercado en vivo.';
      lista.appendChild(vacio);
      return;
    }

    items.forEach(function (n) {
      if (!/^https?:\/\//i.test(n.link)) return; // never render javascript: or other links
      var a = document.createElement('a');
      a.className = 'news-item';
      a.href = n.link;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';

      var meta = document.createElement('div');
      meta.className = 'news-meta';
      n.tickers.forEach(function (tk) {
        var chip = document.createElement('span');
        chip.className = 'news-ticker';
        chip.textContent = tk;
        meta.appendChild(chip);
      });
      var fuente = document.createElement('span');
      fuente.textContent = [n.fuente, haceCuanto(n.fecha)].filter(Boolean).join(' · ');
      meta.appendChild(fuente);

      var titulo = document.createElement('div');
      titulo.className = 'news-title';
      titulo.textContent = n.titulo;

      a.appendChild(meta);
      a.appendChild(titulo);
      if (n.resumen) {
        var resumen = document.createElement('div');
        resumen.className = 'news-summary';
        resumen.textContent = n.resumen;
        a.appendChild(resumen);
      }
      lista.appendChild(a);
    });
  }

  function initNoticias() {
    var btn = document.getElementById('btnRefreshNews');
    if (btn) btn.addEventListener('click', function () {
      if (!noticias.cargando) cargarNoticias();
    });
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
      valEl.className = 'hero-number mono';
      subValEl.textContent = '(••••••)';
      subValEl.className = 'mono';
      return;
    }

    if (state.mode === 'rendimiento') {
      // Gain/loss of the selected range (1D, 1S, 1M...), same numbers as the chart's last point
      var periodo = rendimientoDelRango(state.range);
      var pct = periodo.pct !== null ? periodo.pct : t.gananciaPct;
      var gan = periodo.ganancia !== null ? periodo.ganancia : t.gananciaNoRealizada;
      valEl.textContent = fmt.pct(pct);
      valEl.className = 'hero-number mono ' + (pct >= 0 ? 'pos' : 'neg');
      subIconEl.textContent = gan >= 0 ? '↗' : '↘';
      subValEl.textContent = '(' + (gan >= 0 ? '+' : '') + fmt.money(gan) + ') · ' + (ETIQUETA_RANGO[state.range] || '');
      subValEl.className = 'mono';
    } else {
      // Total value in neutral color; only the range's change below is green/red
      var per = rendimientoDelRango(state.range);
      var ganV = per.ganancia !== null ? per.ganancia : t.gananciaNoRealizada;
      var pctV = per.pct !== null ? per.pct : t.gananciaPct;
      var claseV = ganV >= 0 ? 'pos' : 'neg';
      valEl.textContent = fmt.money(t.valor);
      valEl.className = 'hero-number mono';
      subIconEl.textContent = ganV >= 0 ? '↗' : '↘';
      subValEl.textContent = (ganV >= 0 ? '+' : '') + fmt.money(ganV) + ' (' + fmt.pct(pctV) + ') · ' +
        (ETIQUETA_RANGO[state.range] || '');
      subValEl.className = 'mono ' + claseV;
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
        invertido: inv,
        ganancia: val - inv,
        rendimiento: rendimiento
      };
    }).sort(function (a, b) { return a.time.localeCompare(b.time); });
  }

  var ETIQUETA_RANGO = {
    '1D': 'hoy', '1S': 'última semana', '1M': 'último mes',
    '1A': 'último año', 'YTD': 'en el año', 'MAX': 'total'
  };

  // Local 'yyyy-mm-dd' of the range's starting day
  function fechaCorte(rango) {
    var d = new Date();
    if (rango === '1D') d.setDate(d.getDate() - 1);
    else if (rango === '1S') d.setDate(d.getDate() - 7);
    else if (rango === '1M') d.setMonth(d.getMonth() - 1);
    else if (rango === '1A') d.setFullYear(d.getFullYear() - 1);
    else if (rango === 'YTD') d = new Date(d.getFullYear() - 1, 11, 31); // last close of previous year
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Today's change vs. previous close, from each position's daily variation (Yahoo).
  // Returns null when no position has that data.
  function rendimientoDelDia() {
    var posiciones = (state.dashboard && state.dashboard.posiciones) || [];
    var ganancia = 0, base = 0, hayDatos = false;
    posiciones.forEach(function (p) {
      var valor = Number(p.valorActual) || 0;
      if (typeof p.variacionDia === 'number' && p.variacionDia > -100) {
        var g = valor * p.variacionDia / (100 + p.variacionDia);
        ganancia += g;
        base += valor - g;
        hayDatos = true;
      } else {
        base += valor;
      }
    });
    if (!hayDatos || base <= 0) return null;
    return { ganancia: ganancia, pct: ganancia / base * 100 };
  }

  /**
   * Points for the selected range, rebased so the range starts at 0 %.
   * The gain of a range is how much the unrealized gain (value - invested) changed,
   * so money you added with new purchases doesn't count as profit.
   * The % divides that gain by the starting value plus half of the money added
   * during the range (simple "Modified Dietz" approximation).
   * MAX keeps the total return (value vs. invested), like before.
   */
  function rendimientoDelRango(rango) {
    var serie = buildSerieFromHistorial();
    if (serie.length === 0) return { puntos: [], ganancia: null, pct: null };
    var ultimo = serie[serie.length - 1];
    if (rango === 'MAX') return { puntos: serie, ganancia: ultimo.ganancia, pct: ultimo.rendimiento };

    // Starting point: last day on or before the cut date (or the first one if history is shorter)
    var corte = fechaCorte(rango);
    var idx = 0;
    serie.forEach(function (p, i) { if (p.time <= corte) idx = i; });
    var inicio = serie[idx];

    var puntos = serie.slice(idx).map(function (p) {
      var capital = inicio.valor + 0.5 * (p.invertido - inicio.invertido);
      if (capital <= 0) capital = p.invertido;
      var g = p.ganancia - inicio.ganancia;
      return { time: p.time, valor: p.valor, rendimiento: capital > 0 ? g / capital * 100 : 0, gananciaRango: g };
    });

    var fin = puntos[puntos.length - 1];
    var res = { puntos: puntos, ganancia: fin.gananciaRango, pct: fin.rendimiento };

    // 1D: positions' daily variation is more precise than yesterday's snapshot
    if (rango === '1D') {
      var dia = rendimientoDelDia();
      if (dia) {
        fin.rendimiento = dia.pct;
        res.ganancia = dia.ganancia;
        res.pct = dia.pct;
      }
    }
    return res;
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

    var rangoActual = rendimientoDelRango(state.range);
    var serieFiltrada = rangoActual.puntos;
    // In "Valor" the chart is green or red depending on the range's gain/loss
    var subeRango = rangoActual.ganancia === null || rangoActual.ganancia >= 0;

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
        var verde = state.mode === 'rendimiento' ? val >= 0 : subeRango;
        return {
          time: item.time,
          value: val,
          color: verde ? '#10b981' : '#ef4444'
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
          topColor: subeRango ? 'rgba(16, 185, 129, 0.28)' : 'rgba(239, 68, 68, 0.28)',
          bottomColor: subeRango ? 'rgba(16, 185, 129, 0.02)' : 'rgba(239, 68, 68, 0.02)',
          lineColor: subeRango ? '#10b981' : '#ef4444',
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
        renderHero();
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
      tdMsg.setAttribute('colspan', '10');
      tdMsg.textContent = 'Cargando operaciones...';
      trMsg.appendChild(tdMsg);
      tbody.appendChild(trMsg);
      return;
    }

    if (state.operaciones.length === 0) {
      var trEmpty = document.createElement('tr');
      var tdEmpty = document.createElement('td');
      tdEmpty.setAttribute('colspan', '10');
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
      // Price and commission in the currency the operation was entered in
      var monedaOp = o.moneda || state.moneda;
      tdPrecio.textContent = fmt.moneyIn(o.precio || 0, monedaOp);
      tr.appendChild(tdPrecio);

      // TC
      var tdTC = document.createElement('td');
      tdTC.className = 'mono';
      tdTC.textContent = o.tc ? '$ ' + fmt.num(o.tc) : '—';
      tr.appendChild(tdTC);

      // Comisión
      var tdCom = document.createElement('td');
      tdCom.className = 'mono';
      tdCom.textContent = o.comision ? fmt.moneyIn(o.comision, monedaOp) : '$0';
      tr.appendChild(tdCom);

      // Nota
      var tdNota = document.createElement('td');
      tdNota.className = 'text-muted';
      tdNota.textContent = o.nota || '—';
      tr.appendChild(tdNota);

      // Edit button (only when the operation has an id to identify it)
      var tdEdit = document.createElement('td');
      if (o.id) {
        var btnEdit = document.createElement('button');
        btnEdit.type = 'button';
        btnEdit.className = 'op-edit-btn';
        btnEdit.textContent = '✏️';
        btnEdit.title = 'Editar operación';
        btnEdit.setAttribute('aria-label', 'Editar operación ' + (o.ticker || ''));
        btnEdit.addEventListener('click', function () { abrirEditorOperacion(o); });
        tdEdit.appendChild(btnEdit);
      }
      tr.appendChild(tdEdit);

      tbody.appendChild(tr);
    });
  }

  /* ==========================================================================
     10b. NÚMEROS CON COMA O PUNTO DECIMAL
     ========================================================================== */
  // Reads a number typed with either decimal separator:
  // "1234,56", "1234.56", "1.234,56" and "1,234.56" all give 1234.56.
  // With both separators, the last one is the decimal one; a separator repeated
  // several times ("1.234.567") is a thousands separator. Empty or invalid -> NaN.
  function parseNumero(texto) {
    var s = String(texto == null ? '' : texto).replace(/\s/g, '');
    if (!s) return NaN;
    var ultComa = s.lastIndexOf(',');
    var ultPunto = s.lastIndexOf('.');
    if (ultComa !== -1 && ultPunto !== -1) {
      var decimal = ultComa > ultPunto ? ',' : '.';
      var miles = decimal === ',' ? '.' : ',';
      s = s.split(miles).join('').replace(decimal, '.');
    } else if (ultComa !== -1) {
      s = s.split(',').length > 2 ? s.split(',').join('') : s.replace(',', '.');
    } else if (s.split('.').length > 2) {
      s = s.split('.').join('');
    }
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    return Number(s);
  }

  // Shows a stored number in an input without exponent notation (5e-8 -> "0.00000005").
  function numeroATexto(n) {
    var v = Number(n);
    if (!isFinite(v)) return '';
    return v.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 12 });
  }

  // Reads the numeric fields of an operation form. Returns {error} or {valores}.
  // "inputs" maps cantidad/precio/tc/comision to their input elements.
  function leerNumerosOperacion(inputs) {
    var cantidad = parseNumero(inputs.cantidad.value);
    var precio = parseNumero(inputs.precio.value);
    var tcTexto = inputs.tc.value.trim();
    var comTexto = inputs.comision.value.trim();
    var tc = tcTexto ? parseNumero(tcTexto) : 0;
    var comision = comTexto ? parseNumero(comTexto) : 0;
    if (!(cantidad > 0)) return { error: 'La cantidad no es un número válido mayor a 0.' };
    if (!(precio > 0)) return { error: 'El precio no es un número válido mayor a 0.' };
    if (isNaN(tc)) return { error: 'El tipo de cambio no es un número válido.' };
    if (isNaN(comision)) return { error: 'La comisión no es un número válido.' };
    return { valores: { cantidad: cantidad, precio: precio, tc: tc, comision: comision } };
  }

  // Adapts an operation form to the currency the price is entered in.
  // The exchange rate is shown for USD users, and whenever the operation's
  // currency differs from the user's (empty = MEP of that date).
  function ajustarCamposMoneda(monedaOp, campos) {
    var enPesos = monedaOp === 'ARS';
    var distinta = monedaOp !== state.moneda;
    if (campos.labelPrecio) campos.labelPrecio.textContent = enPesos ? 'Precio (ARS)' : 'Precio (USD)';
    if (campos.labelComision) campos.labelComision.textContent = enPesos ? 'Comisión (ARS)' : 'Comisión (USD)';
    if (campos.inputPrecio) campos.inputPrecio.placeholder = enPesos ? '$ 0,00' : 'US$ 0.00';
    if (campos.labelTC) campos.labelTC.textContent = distinta ? 'Tipo de cambio (vacío = MEP del día)' : 'Tipo de cambio (ARS/USD)';
    if (campos.inputTC) campos.inputTC.placeholder = distinta ? 'Vacío = MEP del día' : 'Opcional (ej: 1250)';
    if (campos.campoTC) campos.campoTC.style.display = (state.moneda === 'USD' || distinta) ? '' : 'none';
  }

  /* ==========================================================================
     10c. EDITAR UNA OPERACIÓN (ventana emergente)
     ========================================================================== */
  function abrirEditorOperacion(o) {
    var overlay = document.createElement('div');
    overlay.className = 'avatar-picker-overlay';
    var modal = document.createElement('div');
    modal.className = 'avatar-picker op-edit-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    overlay.appendChild(modal);

    var header = document.createElement('div');
    header.className = 'avatar-picker-header';
    var titulo = document.createElement('div');
    titulo.className = 'avatar-picker-title';
    titulo.textContent = 'Editar operación';
    var cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'avatar-picker-close';
    cerrar.textContent = '✕';
    cerrar.setAttribute('aria-label', 'Cerrar');
    header.appendChild(titulo);
    header.appendChild(cerrar);
    modal.appendChild(header);

    var form = document.createElement('form');
    form.className = 'avatar-picker-body';
    form.noValidate = true;
    modal.appendChild(form);

    var grid = document.createElement('div');
    grid.className = 'form-grid';
    form.appendChild(grid);

    function campo(etiqueta, control) {
      var div = document.createElement('div');
      div.className = 'form-field';
      var label = document.createElement('label');
      label.textContent = etiqueta;
      control.id = 'edit-op-' + Math.random().toString(36).slice(2, 8);
      label.setAttribute('for', control.id);
      div.appendChild(label);
      div.appendChild(control);
      grid.appendChild(div);
      return div;
    }
    function input(tipo, valor, decimal) {
      var el = document.createElement('input');
      el.type = tipo;
      el.className = 'form-input';
      if (decimal) el.setAttribute('inputmode', 'decimal');
      el.value = valor == null ? '' : String(valor);
      return el;
    }
    function select(opciones, valor) {
      var el = document.createElement('select');
      el.className = 'form-select';
      opciones.forEach(function (op) {
        var opt = document.createElement('option');
        opt.value = op;
        opt.textContent = op;
        el.appendChild(opt);
      });
      if (opciones.indexOf(valor) !== -1) el.value = valor;
      return el;
    }

    // Category is not stored per operation: take it from the current position, if any.
    var categoria = o.categoria;
    if (!categoria && state.dashboard && state.dashboard.posiciones) {
      state.dashboard.posiciones.forEach(function (p) {
        if (p.ticker === o.ticker) categoria = p.categoria;
      });
    }

    var inFecha = input('date', o.fecha);
    var inTipo = select(['Compra', 'Venta'], o.tipo);
    var inTicker = input('text', o.ticker);
    inTicker.classList.add('form-input-uppercase');
    var inCategoria = select(['CEDEAR', 'Acción EEUU', 'Cripto', 'Otro'], categoria);
    var inMoneda = select(['USD', 'ARS'], o.moneda || state.moneda);
    var inCantidad = input('text', numeroATexto(o.cantidad), true);
    var inPrecio = input('text', numeroATexto(o.precio), true);
    var inTC = input('text', o.tc ? numeroATexto(o.tc) : '', true);
    var inComision = input('text', numeroATexto(o.comision || 0), true);
    var inNota = input('text', o.nota);

    campo('Fecha', inFecha);
    campo('Tipo', inTipo);
    campo('Ticker', inTicker);
    campo('Categoría', inCategoria);
    // The category belongs to the asset (shared sheet), not to the operation:
    // it only applies when the ticker changes to a new one.
    inCategoria.disabled = true;
    inCategoria.title = 'La categoría es del activo; solo se elige si cambiás el ticker.';
    inTicker.addEventListener('input', function () {
      inCategoria.disabled = inTicker.value.toUpperCase().trim() === (o.ticker || '');
    });
    campo('Moneda', inMoneda);
    campo('Cantidad', inCantidad);
    var campoPrecio = campo('Precio', inPrecio);
    var campoTC = campo('Tipo de cambio', inTC);
    var campoComision = campo('Comisión', inComision);
    campo('Nota', inNota);

    var camposMoneda = {
      labelPrecio: campoPrecio.querySelector('label'),
      labelComision: campoComision.querySelector('label'),
      inputPrecio: inPrecio,
      labelTC: campoTC.querySelector('label'),
      inputTC: inTC,
      campoTC: campoTC
    };
    ajustarCamposMoneda(inMoneda.value, camposMoneda);
    inMoneda.addEventListener('change', function () { ajustarCamposMoneda(inMoneda.value, camposMoneda); });

    var msg = document.createElement('p');
    msg.className = 'form-error';
    msg.style.display = 'none';
    form.appendChild(msg);

    var acciones = document.createElement('div');
    acciones.className = 'form-actions';
    var btnCancelar = document.createElement('button');
    btnCancelar.type = 'button';
    btnCancelar.className = 'btn-secondary';
    btnCancelar.textContent = 'Cancelar';
    var btnGuardar = document.createElement('button');
    btnGuardar.type = 'submit';
    btnGuardar.className = 'btn-primary';
    btnGuardar.textContent = 'Guardar cambios';
    acciones.appendChild(btnCancelar);
    acciones.appendChild(btnGuardar);
    form.appendChild(acciones);

    function mostrarError(texto) {
      msg.textContent = texto;
      msg.style.display = 'block';
    }
    function cerrarEditor() {
      document.removeEventListener('keydown', alPresionarTecla);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    function alPresionarTecla(e) {
      if (e.key === 'Escape') cerrarEditor();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      msg.style.display = 'none';

      if (!/^\d{4}-\d{2}-\d{2}$/.test(inFecha.value)) return mostrarError('Elegí una fecha válida.');
      var ticker = inTicker.value.toUpperCase().trim();
      if (!ticker) return mostrarError('Completá el ticker.');
      var numeros = leerNumerosOperacion({ cantidad: inCantidad, precio: inPrecio, tc: inTC, comision: inComision });
      if (numeros.error) return mostrarError(numeros.error);

      var payload = {
        id: o.id,
        fecha: inFecha.value,
        tipo: inTipo.value,
        ticker: ticker,
        categoria: inCategoria.value,
        moneda: inMoneda.value,
        cantidad: numeros.valores.cantidad,
        precio: numeros.valores.precio,
        tc: numeros.valores.tc,
        comision: numeros.valores.comision,
        nota: inNota.value.trim()
      };

      btnGuardar.disabled = true;
      btnGuardar.textContent = 'Guardando...';
      window.PandorApi.updateOperacion(payload)
        .then(function () {
          cerrarEditor();
          return Promise.all([cargarOperaciones(), cargarDashboard(), cargarHistorial()]);
        })
        .catch(function (err) {
          mostrarError(err.message || 'Error al guardar los cambios.');
          btnGuardar.disabled = false;
          btnGuardar.textContent = 'Guardar cambios';
        });
    });

    cerrar.addEventListener('click', cerrarEditor);
    btnCancelar.addEventListener('click', cerrarEditor);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) cerrarEditor(); });
    document.addEventListener('keydown', alPresionarTecla);

    document.body.appendChild(overlay);
    inCantidad.focus();
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
      var errorEl = document.getElementById('form-error');

      var numeros = leerNumerosOperacion({
        cantidad: document.getElementById('opCantidad'),
        precio: document.getElementById('opPrecio'),
        tc: document.getElementById('opTC'),
        comision: document.getElementById('opComision')
      });
      if (numeros.error) {
        if (errorEl) {
          errorEl.textContent = numeros.error;
          errorEl.style.display = 'block';
          setTimeout(function () { errorEl.style.display = 'none'; }, 5000);
        }
        return;
      }

      var payload = {
        fecha: document.getElementById('opFecha').value,
        tipo: document.getElementById('opTipo').value,
        ticker: document.getElementById('opTicker').value.toUpperCase().trim(),
        categoria: document.getElementById('opCategoria').value,
        moneda: document.getElementById('opMoneda').value,
        cantidad: numeros.valores.cantidad,
        precio: numeros.valores.precio,
        tc: numeros.valores.tc,
        comision: numeros.valores.comision,
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
          var selMoneda = document.getElementById('opMoneda');
          if (selMoneda) delete selMoneda.dataset.elegida;
          aplicarMonedaFormulario();
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
  // Fixed dollar cards first, then the tickers the user follows (dashboard.seguimiento).
  // 'nvda'/'nvdaBa' keep working with a backend that still sends them.
  var MERCADO_ORDEN = ['mep', 'cripto', 'oficial', 'nvda', 'nvdaBa'];

  function renderMercado() {
    var grid = document.getElementById('marketGrid');
    var mercado = state.dashboard && state.dashboard.mercado;
    if (!grid || !mercado) return;
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    sesionesMercado = [];

    var tarjetas = [];
    MERCADO_ORDEN.forEach(function (clave) {
      if (mercado[clave]) tarjetas.push(mercado[clave]);
    });
    (state.dashboard.seguimiento || []).forEach(function (i) { tarjetas.push(i); });

    var horas = [];
    tarjetas.forEach(function (i) {
      if (i.hora) horas.push(i.hora);

      var card = document.createElement('div');
      card.className = 'card market-card';

      var nombre = document.createElement('div');
      nombre.className = 'market-name';
      nombre.textContent = i.nombre || i.ticker || '';

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

      // Exchange session line: stocks/CEDEARs get open/close times, crypto trades 24 h
      if (i.tipo === 'Cripto' || i.horario) {
        var sesion = document.createElement('div');
        sesion.className = 'market-session';
        var horario = document.createElement('div');
        horario.className = 'market-session-hours';
        card.appendChild(sesion);
        card.appendChild(horario);
        sesionesMercado.push({ el: sesion, horasEl: horario, horario: i.horario, cripto: i.tipo === 'Cripto' });
      }

      grid.appendChild(card);
    });

    var hora = document.getElementById('marketTime');
    if (hora) hora.textContent = horas.length ? 'Actualizado ' + horas.sort()[horas.length - 1] : '';

    actualizarSesionesMercado();
    if (!sesionesTimer) sesionesTimer = setInterval(actualizarSesionesMercado, 20 * 1000);
  }

  /* --- Exchange open/close status, ticking live in the browser --- */
  var sesionesMercado = [];
  var sesionesTimer = null;

  function horaLocal(segundos) {
    return new Date(segundos * 1000).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }

  function duracion(ms) {
    var min = Math.max(1, Math.ceil(ms / 60000));
    var h = Math.floor(min / 60);
    return (h ? h + 'h ' : '') + (min % 60) + 'm';
  }

  function textoSesion(s, ahora) {
    if (s.cripto) return { abierto: true, texto: 'Abierto · opera 24 h', horas: '' };
    var abre = s.horario.apertura * 1000;
    var cierra = s.horario.cierre * 1000;
    var horas = 'Horario ' + horaLocal(s.horario.apertura) + ' – ' + horaLocal(s.horario.cierre) + ' (hora local)';
    if (ahora >= abre && ahora < cierra) {
      return { abierto: true, texto: 'Abierto · cierra en ' + duracion(cierra - ahora), horas: horas };
    }
    if (ahora < abre) {
      var hoy = new Date(ahora).toDateString() === new Date(abre).toDateString();
      var cuando = hoy ? 'abre en ' + duracion(abre - ahora)
        : 'abre el ' + new Date(abre).toLocaleDateString('es-AR', { weekday: 'long' }) + ' ' + horaLocal(s.horario.apertura);
      return { abierto: false, texto: 'Cerrado · ' + cuando, horas: horas };
    }
    // After today's close Yahoo still reports today's session until the next one starts
    return { abierto: false, texto: 'Cerrado · cerró a las ' + horaLocal(s.horario.cierre), horas: horas };
  }

  function actualizarSesionesMercado() {
    var ahora = Date.now();
    sesionesMercado.forEach(function (s) {
      var t = textoSesion(s, ahora);
      s.el.className = 'market-session' + (t.abierto ? ' open' : '');
      while (s.el.firstChild) s.el.removeChild(s.el.firstChild);
      var dot = document.createElement('span');
      dot.className = 'session-dot';
      s.el.appendChild(dot);
      s.el.appendChild(document.createTextNode(t.texto));
      s.horasEl.textContent = t.horas;
    });
  }

  /* --- Watchlist editor: pick which CEDEARs / stocks / cryptos to follow --- */
  var TIPOS_SEGUIMIENTO = ['CEDEAR', 'Acción EEUU', 'Cripto'];
  var MAX_SEGUIMIENTO = 8;

  function abrirEditorMercado() {
    if (!state.dashboard) return;
    var lista = (state.dashboard.seguimientoLista || []).map(function (x) {
      return { tipo: x.tipo, ticker: x.ticker };
    });

    var overlay = document.createElement('div');
    overlay.className = 'avatar-picker-overlay';
    var modal = document.createElement('div');
    modal.className = 'avatar-picker';
    overlay.appendChild(modal);

    var header = document.createElement('div');
    header.className = 'avatar-picker-header';
    var titulo = document.createElement('div');
    titulo.className = 'avatar-picker-title';
    titulo.textContent = 'Elegí qué seguir';
    var cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'avatar-picker-close';
    cerrar.textContent = '✕';
    header.appendChild(titulo);
    header.appendChild(cerrar);
    modal.appendChild(header);

    var body = document.createElement('div');
    body.className = 'avatar-picker-body';
    modal.appendChild(body);

    var secLista = document.createElement('div');
    secLista.className = 'avatar-picker-section';
    secLista.textContent = 'En tu mercado en vivo (máx. ' + MAX_SEGUIMIENTO + ')';
    var chips = document.createElement('div');
    chips.className = 'watchlist-items';
    body.appendChild(secLista);
    body.appendChild(chips);

    var secAgregar = document.createElement('div');
    secAgregar.className = 'avatar-picker-section';
    secAgregar.textContent = 'Agregar';
    var form = document.createElement('form');
    form.className = 'watchlist-add';
    var selTipo = document.createElement('select');
    selTipo.className = 'form-select';
    TIPOS_SEGUIMIENTO.forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      selTipo.appendChild(opt);
    });
    var inpTicker = document.createElement('input');
    inpTicker.type = 'text';
    inpTicker.className = 'form-input form-input-uppercase';
    inpTicker.placeholder = 'Buscá: bitcoin, MELI, apple...';
    inpTicker.maxLength = 40;
    inpTicker.autocomplete = 'off';
    var buscador = document.createElement('div');
    buscador.className = 'watchlist-search';
    var sugerencias = document.createElement('div');
    sugerencias.className = 'watchlist-suggestions';
    sugerencias.hidden = true;
    buscador.appendChild(inpTicker);
    buscador.appendChild(sugerencias);
    var btnAgregar = document.createElement('button');
    btnAgregar.type = 'submit';
    btnAgregar.className = 'market-edit-btn';
    btnAgregar.textContent = 'Agregar';
    form.appendChild(selTipo);
    form.appendChild(buscador);
    form.appendChild(btnAgregar);
    body.appendChild(secAgregar);
    body.appendChild(form);

    var footer = document.createElement('div');
    footer.className = 'watchlist-footer';
    var msg = document.createElement('span');
    msg.className = 'watchlist-msg';
    var btnGuardar = document.createElement('button');
    btnGuardar.type = 'button';
    btnGuardar.className = 'btn-primary';
    btnGuardar.textContent = 'Guardar';
    footer.appendChild(msg);
    footer.appendChild(btnGuardar);
    body.appendChild(footer);

    function pintarChips() {
      while (chips.firstChild) chips.removeChild(chips.firstChild);
      if (!lista.length) {
        var vacio = document.createElement('span');
        vacio.className = 'market-detail';
        vacio.textContent = 'No seguís ningún ticker.';
        chips.appendChild(vacio);
      }
      lista.forEach(function (item, idx) {
        var chip = document.createElement('span');
        chip.className = 'watchlist-chip';
        chip.appendChild(document.createTextNode(item.ticker + ' · ' + item.tipo));
        var quitar = document.createElement('button');
        quitar.type = 'button';
        quitar.textContent = '✕';
        quitar.setAttribute('aria-label', 'Quitar ' + item.ticker);
        quitar.addEventListener('click', function () {
          lista.splice(idx, 1);
          pintarChips();
        });
        chip.appendChild(quitar);
        chips.appendChild(chip);
      });
    }

    function cerrarEditor() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    /* Suggestions from Yahoo search (via the backend), with a short pause after typing */
    var busquedaTimer = null;
    var busquedaId = 0; // ignores answers that arrive after a newer search
    var resultados = [];
    var marcado = -1;

    function cerrarSugerencias() {
      sugerencias.hidden = true;
      resultados = [];
      marcado = -1;
    }

    function mensajeSugerencias(texto) {
      while (sugerencias.firstChild) sugerencias.removeChild(sugerencias.firstChild);
      var el = document.createElement('div');
      el.className = 'watchlist-suggestion-empty';
      el.textContent = texto;
      sugerencias.appendChild(el);
      sugerencias.hidden = false;
    }

    function elegirSugerencia(r) {
      // A US stock found while "CEDEAR" is selected stays as CEDEAR (same ticker on BYMA)
      if (!(r.tipo === 'Acción EEUU' && selTipo.value === 'CEDEAR')) selTipo.value = r.tipo;
      inpTicker.value = r.ticker;
      cerrarSugerencias();
      inpTicker.focus();
    }

    function pintarSugerencias() {
      while (sugerencias.firstChild) sugerencias.removeChild(sugerencias.firstChild);
      if (!resultados.length) { mensajeSugerencias('Sin resultados'); return; }
      resultados.forEach(function (r, idx) {
        var fila = document.createElement('button');
        fila.type = 'button';
        fila.className = 'watchlist-suggestion' + (idx === marcado ? ' active' : '');
        var tk = document.createElement('span');
        tk.className = 'watchlist-suggestion-ticker';
        tk.textContent = r.ticker;
        var nom = document.createElement('span');
        nom.className = 'watchlist-suggestion-name';
        nom.textContent = r.nombre || '';
        var tp = document.createElement('span');
        tp.className = 'watchlist-suggestion-type';
        tp.textContent = r.tipo;
        fila.appendChild(tk);
        fila.appendChild(nom);
        fila.appendChild(tp);
        // mousedown runs before the input loses focus
        fila.addEventListener('mousedown', function (e) {
          e.preventDefault();
          elegirSugerencia(r);
        });
        sugerencias.appendChild(fila);
      });
      sugerencias.hidden = false;
    }

    inpTicker.addEventListener('input', function () {
      clearTimeout(busquedaTimer);
      var q = inpTicker.value.trim();
      if (q.length < 2) { cerrarSugerencias(); return; }
      busquedaTimer = setTimeout(function () {
        var id = ++busquedaId;
        mensajeSugerencias('Buscando...');
        window.PandorApi.buscarActivo(q)
          .then(function (data) {
            if (id !== busquedaId) return;
            resultados = Array.isArray(data) ? data : [];
            marcado = -1;
            pintarSugerencias();
          })
          .catch(function () {
            if (id === busquedaId) mensajeSugerencias('No se pudo buscar');
          });
      }, 400);
    });

    inpTicker.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !sugerencias.hidden) {
        e.stopPropagation();
        cerrarSugerencias();
        return;
      }
      if (!resultados.length || sugerencias.hidden) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        var paso = e.key === 'ArrowDown' ? 1 : -1;
        marcado = (marcado + paso + resultados.length) % resultados.length;
        pintarSugerencias();
      } else if (e.key === 'Enter' && marcado >= 0) {
        e.preventDefault();
        elegirSugerencia(resultados[marcado]);
      }
    });

    inpTicker.addEventListener('blur', function () {
      busquedaId++; // a late answer should not reopen the list
      cerrarSugerencias();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      msg.textContent = '';
      clearTimeout(busquedaTimer);
      busquedaId++;
      cerrarSugerencias();
      var ticker = inpTicker.value.trim().toUpperCase();
      if (!/^[A-Z0-9.\-]{1,15}$/.test(ticker)) { msg.textContent = 'Ticker inválido.'; return; }
      if (lista.length >= MAX_SEGUIMIENTO) { msg.textContent = 'Máximo ' + MAX_SEGUIMIENTO + ' tickers.'; return; }
      var existe = lista.some(function (x) { return x.ticker === ticker && x.tipo === selTipo.value; });
      if (!existe) lista.push({ tipo: selTipo.value, ticker: ticker });
      inpTicker.value = '';
      pintarChips();
    });

    btnGuardar.addEventListener('click', function () {
      msg.textContent = '';
      btnGuardar.disabled = true;
      btnGuardar.textContent = 'Guardando...';
      window.PandorApi.setSeguimiento(lista)
        .then(function (data) {
          state.dashboard.seguimientoLista = data.seguimientoLista;
          state.dashboard.seguimiento = data.seguimiento;
          noticias.datos = null; // news follow the watchlist: reload next time
          renderMercado();
          cerrarEditor();
        })
        .catch(function (err) {
          msg.textContent = 'Error: ' + err.message;
          btnGuardar.disabled = false;
          btnGuardar.textContent = 'Guardar';
        });
    });

    cerrar.addEventListener('click', cerrarEditor);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) cerrarEditor(); });

    pintarChips();
    document.body.appendChild(overlay);
    inpTicker.focus();
  }

  function initEditorMercado() {
    var btn = document.getElementById('btnEditMarket');
    if (btn) btn.addEventListener('click', abrirEditorMercado);
  }

  // Adapts the operation form labels to the user's currency.
  // ARS users enter price and commission in pesos, so the exchange rate field is hidden.
  function aplicarMonedaFormulario() {
    var enPesos = state.moneda === 'ARS';
    var badge = document.getElementById('currencyBadge');
    if (badge) badge.textContent = enPesos ? '🇦🇷 ARS' : '🇺🇸 US$';
    // The currency selector starts on the user's currency unless the user already picked one.
    var selMoneda = document.getElementById('opMoneda');
    if (!selMoneda) return;
    if (!selMoneda.dataset.elegida) selMoneda.value = state.moneda;
    if (!selMoneda.dataset.conectado) {
      selMoneda.dataset.conectado = '1';
      selMoneda.addEventListener('change', function () {
        selMoneda.dataset.elegida = '1';
        aplicarMonedaFormulario();
      });
    }
    var tc = document.getElementById('opTC');
    ajustarCamposMoneda(selMoneda.value, {
      labelPrecio: document.querySelector('label[for="opPrecio"]'),
      labelComision: document.querySelector('label[for="opComision"]'),
      inputPrecio: document.getElementById('opPrecio'),
      labelTC: document.querySelector('label[for="opTC"]'),
      inputTC: tc,
      campoTC: tc ? tc.closest('.form-field') : null
    });
  }

  function cargarHistorial() {
    return window.PandorApi.getHistorial()
      .then(function (data) {
        state.historial = data || [];
        renderHero(); // the range % needs the history
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
    initEditorMercado();
    initNoticias();

    // Auth handles showing login or app + triggering cargarDatosApp
    if (window.PandorAuth) {
      window.PandorAuth.init();
    }
  });

})();
