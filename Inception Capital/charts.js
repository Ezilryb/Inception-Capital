// ============================================================
//  charts.js — Gestion des graphiques
//  TradingView Lightweight Charts v4
//  Bougies · EMA 20/50 · RSI (14) · Synchronisation zoom
// ============================================================

// ─── Couleurs selon le thème actif ───────────────────────────
function getChartColors() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    bg:         dark ? '#211e1b' : '#ffffff',
    bgRsi:      dark ? '#191614' : '#f9f7f4',
    text:       dark ? '#9a8b82' : '#a09890',
    grid:       dark ? '#2a2522' : '#f0ece8',
    border:     dark ? '#3d3835' : '#e8e4df',
    upColor:    '#34d073',
    downColor:  '#f87171',
    ema20:      '#d97706',
    ema50:      '#1d4ed8',
    rsi:        '#7c3aed',
    ob:         dark ? 'rgba(248,113,113,0.35)' : 'rgba(185,28,28,0.4)',
    os:         dark ? 'rgba(52,208,115,0.35)'  : 'rgba(21,128,61,0.4)',
  };
}

// ─── Options de base d'un graphique ──────────────────────────
function buildChartOptions(height, bg) {
  const c = getChartColors();
  return {
    width: 0, height,
    layout:     { background: { type: 'solid', color: bg || c.bg }, textColor: c.text },
    grid:       { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
    crosshair:  { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor: c.border },
    timeScale:  { borderColor: c.border, timeVisible: true, secondsVisible: false },
    handleScroll: true,
    handleScale:  true
  };
}

// ─── Initialisation ──────────────────────────────────────────
function initCharts(state) {
  const mainEl = document.getElementById('main-chart');
  const rsiEl  = document.getElementById('rsi-chart');
  const c      = getChartColors();

  state.chart = LightweightCharts.createChart(mainEl, buildChartOptions(380));

  state.candleSeries = state.chart.addCandlestickSeries({
    upColor:        c.upColor,
    downColor:      c.downColor,
    borderUpColor:  c.upColor,
    borderDownColor:c.downColor,
    wickUpColor:    '#86efac',
    wickDownColor:  '#fca5a5'
  });

  state.ema20Series = state.chart.addLineSeries({
    color: c.ema20, lineWidth: 1.5, title: 'EMA20',
    lastValueVisible: false, priceLineVisible: false
  });

  state.ema50Series = state.chart.addLineSeries({
    color: c.ema50, lineWidth: 1.5, title: 'EMA50',
    lastValueVisible: false, priceLineVisible: false
  });

  state.rsiChart = LightweightCharts.createChart(rsiEl, {
    ...buildChartOptions(100, c.bgRsi),
    rightPriceScale: { borderColor: c.border, scaleMargins: { top: 0.1, bottom: 0.1 } }
  });

  state.rsiSeries = state.rsiChart.addLineSeries({
    color: c.rsi, lineWidth: 1.5, title: 'RSI',
    lastValueVisible: true, priceLineVisible: false
  });

  state.obLine = state.rsiChart.addLineSeries({
    color: c.ob, lineWidth: 1, lineStyle: 1,
    lastValueVisible: false, priceLineVisible: false
  });
  state.osLine = state.rsiChart.addLineSeries({
    color: c.os, lineWidth: 1, lineStyle: 1,
    lastValueVisible: false, priceLineVisible: false
  });

  // ── Synchronisation zoom ──
  let syncing = false;
  state.chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
    if (syncing || !range) return; syncing = true;
    state.rsiChart.timeScale().setVisibleLogicalRange(range); syncing = false;
  });
  state.rsiChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
    if (syncing || !range) return; syncing = true;
    state.chart.timeScale().setVisibleLogicalRange(range); syncing = false;
  });

  // ── Responsive resize ──
  const ro = new ResizeObserver(() => {
    state.chart.applyOptions({ width: mainEl.clientWidth });
    state.rsiChart.applyOptions({ width: rsiEl.clientWidth });
  });
  ro.observe(mainEl);
  ro.observe(rsiEl);
}

// ─── Mise à jour des données ──────────────────────────────────
function updateCharts(state, candles, ind) {
  state.candleSeries.setData(candles);

  const ema20Data = candles
    .map((c, i) => ind.ema.ema20Array[i] != null ? { time: c.time, value: ind.ema.ema20Array[i] } : null)
    .filter(Boolean);
  const ema50Data = candles
    .map((c, i) => ind.ema.ema50Array[i] != null ? { time: c.time, value: ind.ema.ema50Array[i] } : null)
    .filter(Boolean);
  state.ema20Series.setData(ema20Data);
  state.ema50Series.setData(ema50Data);

  const rsiData = candles
    .map((c, i) => ind.rsi.array[i] != null ? { time: c.time, value: ind.rsi.array[i] } : null)
    .filter(Boolean);
  state.rsiSeries.setData(rsiData);

  const t0 = candles[0].time;
  const tN = candles[candles.length - 1].time;
  state.obLine.setData([{ time: t0, value: 70 }, { time: tN, value: 70 }]);
  state.osLine.setData([{ time: t0, value: 30 }, { time: tN, value: 30 }]);

  state.chart.timeScale().fitContent();
  state.rsiChart.timeScale().fitContent();
}

// ─── Rechargement des couleurs après changement de thème ─────
function refreshChartTheme(state) {
  const c    = getChartColors();
  const base = {
    layout:          { background: { type: 'solid', color: c.bg }, textColor: c.text },
    grid:            { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
    rightPriceScale: { borderColor: c.border },
    timeScale:       { borderColor: c.border }
  };
  state.chart.applyOptions(base);
  state.rsiChart.applyOptions({
    ...base,
    layout: { background: { type: 'solid', color: c.bgRsi }, textColor: c.text }
  });

  // Mise à jour couleurs des séries existantes
  state.obLine.applyOptions({ color: c.ob });
  state.osLine.applyOptions({ color: c.os });
}
