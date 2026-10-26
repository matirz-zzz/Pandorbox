/**
 * PANDORBOX - Interactive Chart.js Visualizations
 * High-performance, theme-aware responsive charts.
 */
window.PandorCharts = {
  instances: {},

  // Get CSS variable value from DOM
  getColor: function (name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
  },

  // Safely destroy existing chart before creating a new one
  replaceChart: function (canvasId, config) {
    if (this.instances[canvasId]) {
      this.instances[canvasId].destroy();
    }
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    this.instances[canvasId] = new Chart(canvas, config);
  },

  // Render all dashboard charts
  renderAll: function (datos) {
    if (!datos) return;
    this.renderHistorial(datos.historial || []);
    this.renderDistribucion(datos.posiciones || []);
    this.renderGanancias(datos.posiciones || []);
  },

  // 1. Portfolio Evolution: Invested vs Market Value
  renderHistorial: function (historial) {
    if (!historial || historial.length === 0) return;

    const textColor = this.getColor('--text-muted') || '#94a3b8';
    const gridColor = this.getColor('--border-subtle') || 'rgba(255, 255, 255, 0.08)';
    const accentColor = this.getColor('--accent-primary') || '#3b82f6';
    const subtleColor = this.getColor('--text-subtle') || '#64748b';

    const canvas = document.getElementById('gHistorial');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Create subtle vertical gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 280);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.35)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    this.replaceChart('gHistorial', {
      type: 'line',
      data: {
        labels: historial.map(h => h.fecha),
        datasets: [
          {
            label: 'Total Invertido',
            data: historial.map(h => h.invertido),
            borderColor: subtleColor,
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: subtleColor,
            tension: 0.3,
            fill: false
          },
          {
            label: 'Valor de Cartera',
            data: historial.map(h => h.valor),
            borderColor: accentColor,
            borderWidth: 2.5,
            backgroundColor: gradient,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: accentColor,
            tension: 0.35,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: { color: textColor, boxWidth: 12, usePointStyle: true, font: { family: 'Plus Jakarta Sans', size: 12 } }
          },
          tooltip: {
            backgroundColor: 'rgba(17, 23, 38, 0.95)',
            titleFont: { family: 'Plus Jakarta Sans', weight: 'bold' },
            bodyFont: { family: 'JetBrains Mono' },
            padding: 12,
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            callbacks: {
              label: function (c) {
                return ` ${c.dataset.label}: US$ ${c.parsed.y.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } },
            grid: { color: gridColor, drawBorder: false }
          },
          y: {
            ticks: {
              color: textColor,
              font: { family: 'JetBrains Mono', size: 11 },
              callback: v => 'US$ ' + v.toLocaleString('es-AR')
            },
            grid: { color: gridColor, drawBorder: false }
          }
        }
      }
    });
  },

  // 2. Asset Allocation: Doughnut chart
  renderDistribucion: function (posiciones) {
    if (!posiciones || posiciones.length === 0) return;

    const textColor = this.getColor('--text-muted') || '#94a3b8';
    const bgCard = this.getColor('--bg-surface') || '#111726';

    const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

    this.replaceChart('gDistribucion', {
      type: 'doughnut',
      data: {
        labels: posiciones.map(p => p.ticker),
        datasets: [{
          data: posiciones.map(p => p.valorActual !== null ? p.valorActual : p.costoUSD),
          backgroundColor: posiciones.map((_, i) => palette[i % palette.length]),
          borderColor: bgCard,
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'right',
            labels: { color: textColor, boxWidth: 10, usePointStyle: true, font: { family: 'Plus Jakarta Sans', size: 11 } }
          },
          tooltip: {
            backgroundColor: 'rgba(17, 23, 38, 0.95)',
            padding: 12,
            callbacks: {
              label: function (c) {
                const val = c.parsed;
                return ` ${c.label}: US$ ${val.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
              }
            }
          }
        }
      }
    });
  },

  // 3. Profit / Loss per asset: Bar chart
  renderGanancias: function (posiciones) {
    if (!posiciones || posiciones.length === 0) return;

    const textColor = this.getColor('--text-muted') || '#94a3b8';
    const gridColor = this.getColor('--border-subtle') || 'rgba(255, 255, 255, 0.08)';
    const verde = this.getColor('--success') || '#10b981';
    const rojo = this.getColor('--danger') || '#ef4444';

    this.replaceChart('gGanancias', {
      type: 'bar',
      data: {
        labels: posiciones.map(p => p.ticker),
        datasets: [{
          label: 'Resultado (USD)',
          data: posiciones.map(p => p.ganancia || 0),
          backgroundColor: posiciones.map(p => (p.ganancia || 0) >= 0 ? verde : rojo),
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(17, 23, 38, 0.95)',
            padding: 12,
            callbacks: {
              label: function (c) {
                const val = c.parsed.y;
                return ` ${val >= 0 ? '+' : ''}US$ ${val.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', weight: '600' } },
            grid: { display: false }
          },
          y: {
            ticks: {
              color: textColor,
              font: { family: 'JetBrains Mono', size: 11 },
              callback: v => 'US$ ' + v.toLocaleString('es-AR')
            },
            grid: { color: gridColor }
          }
        }
      }
    });
  }
};
