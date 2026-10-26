/**
 * MOCK DATA - Mis Inversiones
 * Serie diaria simulada de ~1 año (365 días) y datos de posiciones y operaciones.
 */

(function () {
  'use strict';

  // Generador de fechas y serie histórica diaria de 365 días hasta hoy
  const hoy = new Date();
  const serieDiaria = [];
  
  let valorBase = 9800; // Inversión inicial simulada
  let invertidoBase = 9800;
  let valorActual = valorBase;

  for (let i = 365; i >= 0; i--) {
    const d = new Date(hoy);
    d.setDate(d.getDate() - i);
    const fechaISO = d.toISOString().split('T')[0];

    // Simulación de fluctuación de mercado realista con tendencia positiva y una caída puntual
    let factor = 1 + (Math.sin(i / 15) * 0.006) + ((Math.random() - 0.47) * 0.012);
    
    // Caída fuerte a mitad de año (similar al patrón visual de la referencia)
    if (i > 150 && i < 155) {
      factor = 0.95;
    }

    valorActual = valorActual * factor;
    
    // Aportes de capital graduales a lo largo del año
    if (i === 280) { invertidoBase += 1000; valorActual += 1000; }
    if (i === 180) { invertidoBase += 1500; valorActual += 1500; }
    if (i === 60)  { invertidoBase += 1200; valorActual += 1200; }

    const gananciaUSD = valorActual - invertidoBase;
    const rendimientoPct = (gananciaUSD / invertidoBase) * 100;

    serieDiaria.push({
      time: fechaISO,
      valor: Math.round(valorActual * 100) / 100,
      invertido: Math.round(invertidoBase * 100) / 100,
      rendimiento: Math.round(rendimientoPct * 100) / 100,
      gananciaUSD: Math.round(gananciaUSD * 100) / 100
    });
  }

  // Ajustar el último valor para coincidir exactamente con los KPIs de muestra
  const ultimo = serieDiaria[serieDiaria.length - 1];
  ultimo.rendimiento = 17.55;
  ultimo.gananciaUSD = 2375.40;
  ultimo.valor = 15915.40;
  ultimo.invertido = 13540.00;

  window.MOCK_DATA = {
    resumen: {
      valorTotal: ultimo.valor,
      invertidoTotal: ultimo.invertido,
      rendimientoPct: ultimo.rendimiento,
      rendimientoUSD: ultimo.gananciaUSD,
      moneda: 'USD'
    },
    serieDiaria: serieDiaria,
    posiciones: [
      {
        ticker: 'SPY',
        nombre: 'S&P 500 ETF Trust',
        categoria: 'CEDEAR',
        cantidad: 45,
        precioPromedio: 50.00,
        precioActual: 57.89,
        invertido: 2250.00,
        valor: 2605.05,
        resultado: 355.05,
        resultadoPct: 15.78
      },
      {
        ticker: 'NVDA',
        nombre: 'Nvidia Corporation',
        categoria: 'CEDEAR',
        cantidad: 35,
        precioPromedio: 110.00,
        precioActual: 119.47,
        invertido: 3850.00,
        valor: 4181.45,
        resultado: 331.45,
        resultadoPct: 8.61
      },
      {
        ticker: 'MELI',
        nombre: 'MercadoLibre Inc',
        categoria: 'CEDEAR',
        cantidad: 2.5,
        precioPromedio: 1520.00,
        precioActual: 1840.50,
        invertido: 3800.00,
        valor: 4601.25,
        resultado: 801.25,
        resultadoPct: 21.08
      },
      {
        ticker: 'BTC',
        nombre: 'Bitcoin (Cripto)',
        categoria: 'Cripto',
        cantidad: 0.042,
        precioPromedio: 61000.00,
        precioActual: 68450.00,
        invertido: 2562.00,
        valor: 2874.90,
        resultado: 312.90,
        resultadoPct: 12.21
      },
      {
        ticker: 'AAPL',
        nombre: 'Apple Inc',
        categoria: 'Acción EEUU',
        cantidad: 6,
        precioPromedio: 179.67,
        precioActual: 175.50,
        invertido: 1078.00,
        valor: 1053.00,
        resultado: -25.00,
        resultadoPct: -2.32
      }
    ],
    operaciones: [
      { id: 'OP-001', fecha: '2026-10-18', ticker: 'NVDA', tipo: 'Compra', cantidad: 10, precio: 115.00, tc: 1240, comision: 2.00, nota: 'Aporte periódico' },
      { id: 'OP-002', fecha: '2026-09-25', ticker: 'MELI', tipo: 'Compra', cantidad: 1.0, precio: 1780.00, tc: 1220, comision: 3.50, nota: 'Rebalanceo' },
      { id: 'OP-003', fecha: '2026-08-14', ticker: 'BTC', tipo: 'Compra', cantidad: 0.015, precio: 59500.00, tc: 1205, comision: 1.20, nota: 'DCA cripto' },
      { id: 'OP-004', fecha: '2026-07-02', ticker: 'SPY', tipo: 'Compra', cantidad: 20, precio: 52.40, tc: 1190, comision: 2.00, nota: 'Aporte mensual' },
      { id: 'OP-005', fecha: '2026-05-20', ticker: 'AAPL', tipo: 'Compra', cantidad: 6, precio: 179.67, tc: 1150, comision: 1.50, nota: 'Posición defensiva' }
    ]
  };
})();
