// ============================================================
//  app.js — Oracle v2
//  Binance API · Gemini IA (CoT) · Multi-timeframe · Funding Rate
//  Market Regime · Confluence Score · Prediction History
// ============================================================

const state = {
  candles:     [],
  candles1h:   [],
  candles4h:   [],
  indicators:  null,
  ind1h:       null,
  ind4h:       null,
  fundingRate: null,
  openInterest: null,
  prediction:  null,
  symbol:      'BTCUSDT',
  geminiKey:   '',
  regime:      'NEUTRE',
  confluence:  null,
  chart:       null,
  rsiChart:    null,
  candleSeries:  null,
  ema20Series:   null,
  ema50Series:   null,
  rsiSeries:     null,
  obLine:        null,
  osLine:        null,
  refreshTimer:  null,
  countdown:     30 * 60
};

// ─────────────────────────────────────────
//  BINANCE API — candles
// ─────────────────────────────────────────
async function fetchCandles(symbol, interval, limit = 300) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance ${res.status}: ${symbol} introuvable`);
  return (await res.json()).map(c => ({
    time:   Math.floor(c[0] / 1000),
    open:   parseFloat(c[1]),
    high:   parseFloat(c[2]),
    low:    parseFloat(c[3]),
    close:  parseFloat(c[4]),
    volume: parseFloat(c[5])
  }));
}

// ─────────────────────────────────────────
//  BINANCE FUTURES — Funding Rate & OI
// ─────────────────────────────────────────
async function fetchFundingRate(symbol) {
  try {
    const res = await fetch(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=3`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    const rate = parseFloat(data[data.length - 1].fundingRate) * 100;
    return {
      rate,
      label: rate > 0.05 ? 'ÉLEVÉ POSITIF' : rate < -0.05 ? 'NÉGATIF' : 'NEUTRE',
      sentiment: rate > 0.05 ? 'Marché suracheté (longs surexposés)' : rate < -0.05 ? 'Marché survendu (shorts surexposés)' : 'Équilibré'
    };
  } catch { return null; }
}

async function fetchOpenInterest(symbol) {
  try {
    const res = await fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`);
    if (!res.ok) return null;
    const data = await res.json();
    return parseFloat(data.openInterest);
  } catch { return null; }
}

// ─────────────────────────────────────────
//  MARKET REGIME DETECTION
// ─────────────────────────────────────────
function detectMarketRegime(ind) {
  if (ind.adx.value > 30 && Math.abs(ind.trendScore) >= 3) return 'TENDANCE_FORTE';
  if (ind.adx.value < 20 && ind.bb.bandwidth < 2)          return 'RANGE';
  if (ind.volume.ratio > 3 && ind.atr.pct > 2)             return 'VOLATILITE_EXPLOSIVE';
  if (ind.obv.divergence !== 'AUCUNE')                      return 'DIVERGENCE';
  return 'NEUTRE';
}

function regimeLabel(regime) {
  const map = {
    'TENDANCE_FORTE':      { label: 'Tendance forte',      cls: 'regime-trend'    },
    'RANGE':               { label: 'Range / consolidation', cls: 'regime-range'  },
    'VOLATILITE_EXPLOSIVE':{ label: 'Volatilité explosive', cls: 'regime-volatile' },
    'DIVERGENCE':          { label: 'Divergence OBV',       cls: 'regime-diverge'  },
    'NEUTRE':              { label: 'Régime neutre',         cls: 'regime-neutral'  }
  };
  return map[regime] || map['NEUTRE'];
}

// ─────────────────────────────────────────
//  CONFLUENCE SCORE
// ─────────────────────────────────────────
function computeConfluenceScore(ind) {
  let bull = 0, bear = 0;

  if (ind.trendScore >= 3)  bull += 2;
  if (ind.trendScore <= -3) bear += 2;
  if (ind.trendScore === 2) bull++;
  if (ind.trendScore === -2) bear++;

  if (ind.rsi.value > 55 && !ind.rsi.overbought)  bull++;
  if (ind.rsi.value < 45 && !ind.rsi.oversold)    bear++;

  if (ind.macd.bullish)  bull++;
  else                    bear++;

  if (ind.adx.strong) {
    if (ind.adx.diPlus > ind.adx.diMinus) bull++;
    else                                    bear++;
  }

  if (ind.obv.trend === 'HAUSSIER') bull++;
  if (ind.obv.trend === 'BAISSIER') bear++;

  if (ind.volume.ratio > 1.5 && bull > bear) bull++;
  if (ind.volume.ratio > 1.5 && bear > bull) bear++;

  if (ind.stochRSI.value != null) {
    if (ind.stochRSI.value > 60 && !ind.stochRSI.overbought) bull++;
    if (ind.stochRSI.value < 40 && !ind.stochRSI.oversold)   bear++;
  }

  const net = bull - bear;
  const total = bull + bear || 1;
  const score = Math.round(((net + total) / (2 * total)) * 100);

  return {
    bull, bear, net,
    score,        // 0-100 (50 = neutre)
    strong: Math.abs(net) >= 3,
    direction: net >= 3 ? 'BULLISH' : net <= -3 ? 'BEARISH' : 'NEUTRAL'
  };
}

// ─────────────────────────────────────────
//  GEMINI — Chain-of-Thought prompt
// ─────────────────────────────────────────
async function callGemini(ind, ind1h, ind4h, symbol, regime, confluence, funding, oi) {
  if (!state.geminiKey) return null;

  const fmt2 = n => n != null && !isNaN(n) ? n.toFixed(2) : 'N/A';
  const fmt4 = n => n != null && !isNaN(n) ? n.toFixed(4) : 'N/A';
  const pct  = n => n != null ? (n > 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%`) : 'N/A';

  const multiTF = ind1h && ind4h ? `
=== MULTI-TIMEFRAMES ===
4H — Tendance: ${ind4h.trend} (score ${ind4h.trendScore}/4) · RSI: ${fmt2(ind4h.rsi.value)} · MACD: ${ind4h.macd.bullish ? 'haussier' : 'baissier'} · ADX: ${fmt2(ind4h.adx.value)} ${ind4h.adx.label}
1H — Tendance: ${ind1h.trend} (score ${ind1h.trendScore}/4) · RSI: ${fmt2(ind1h.rsi.value)} · MACD: ${ind1h.macd.bullish ? 'haussier' : 'baissier'} · ADX: ${fmt2(ind1h.adx.value)} ${ind1h.adx.label}
30M — Tendance: ${ind.trend} (score ${ind.trendScore}/4) · RSI: ${fmt2(ind.rsi.value)} · MACD: ${ind.macd.bullish ? 'haussier' : 'baissier'} · ADX: ${fmt2(ind.adx.value)} ${ind.adx.label}
Alignement timeframes: ${[ind4h.trend, ind1h.trend, ind.trend].every(t => t === 'HAUSSIER') ? '✅ CONFLUENCE HAUSSIÈRE TOTALE' : [ind4h.trend, ind1h.trend, ind.trend].every(t => t === 'BAISSIER') ? '✅ CONFLUENCE BAISSIÈRE TOTALE' : '⚠ Divergence entre timeframes'}` : '';

  const futuresData = `
=== DONNÉES FUTURES (ON-CHAIN) ===
Funding Rate: ${funding ? `${funding.rate.toFixed(4)}% — ${funding.label} — ${funding.sentiment}` : 'Indisponible'}
Open Interest: ${oi ? oi.toFixed(0) + ' contrats' : 'Indisponible'}`;

  const prompt = `Tu es un trader quantitatif senior avec 15 ans d'expérience. Analyse ${symbol} sur les bougies 30min.

Raisonne IMPÉRATIVEMENT en 4 étapes avant de conclure. Chaque étape doit être concise (1-2 phrases).

=== RÉGIME DE MARCHÉ ===
Régime détecté : ${regime}
Score de confluence interne : ${confluence.bull} signaux haussiers vs ${confluence.bear} baissiers (net: ${confluence.net > 0 ? '+' : ''}${confluence.net})
${multiTF}
${futuresData}

=== INDICATEURS PRINCIPAUX (30min) ===
Prix: $${fmt2(ind.currentPrice)} · ROC(10): ${pct(ind.roc.value)} · Pattern: ${ind.pattern}
EMA20: $${fmt2(ind.ema.ema20)} (${ind.currentPrice > ind.ema.ema20 ? '↑' : '↓'}) · EMA50: $${fmt2(ind.ema.ema50)} (${ind.currentPrice > ind.ema.ema50 ? '↑' : '↓'}) · EMA200: $${fmt2(ind.ema.ema200)} (${ind.currentPrice > ind.ema.ema200 ? '↑' : '↓'})
RSI: ${fmt2(ind.rsi.value)}${ind.rsi.overbought ? ' ⚠ SURACHETÉ' : ind.rsi.oversold ? ' ⚠ SURVENDU' : ''} · StochRSI: ${fmt2(ind.stochRSI.value)}
MACD ligne: ${fmt4(ind.macd.line)} | Signal: ${fmt4(ind.macd.signal)} | Histo: ${fmt4(ind.macd.histogram)}
ADX: ${fmt2(ind.adx.value)} ${ind.adx.label} · DI+: ${fmt2(ind.adx.diPlus)} / DI-: ${fmt2(ind.adx.diMinus)}
ATR(14): $${fmt2(ind.atr.value)} (${fmt2(ind.atr.pct)}%) · BB %B: ${fmt2(ind.bb.percentB)} · Bandwidth: ${fmt2(ind.bb.bandwidth)}%
OBV: ${ind.obv.trend} · Divergence: ${ind.obv.divergence}
Volume: ×${ind.volume.ratio.toFixed(2)} moyenne · ${ind.volume.trend}
Résistance: $${fmt2(ind.sr.resistance)} · Support: $${fmt2(ind.sr.support)}
Fib nearest: ${ind.nearestFib.label} ($${fmt2(ind.nearestFib.value)})
Fib levels: 23.6%=$${fmt2(ind.fib.f236)} / 38.2%=$${fmt2(ind.fib.f382)} / 50%=$${fmt2(ind.fib.f500)} / 61.8%=$${fmt2(ind.fib.f618)}

=== TON RAISONNEMENT (inclus dans "reasoning", max 3 phrases) ===
ÉTAPE 1 — BIAIS: Quel est le biais directionnel dominant selon la confluence multi-timeframes ?
ÉTAPE 2 — CONFIRMATION: Quels indicateurs confirment ce biais ? Lesquels le contredisent ?
ÉTAPE 3 — INVALIDATION: Quel niveau technique invaliderait ce signal ?
ÉTAPE 4 — CONCLUSION: Signal valide seulement si ≥ 3 indicateurs confirment ET régime adapté. Sinon NEUTRAL.

Règles strictes :
- NEUTRAL si confluence.net entre -2 et +2 (signaux trop divisés)
- NEUTRAL si régime VOLATILITE_EXPLOSIVE (risque trop élevé)
- stop_loss = prix ± 1.5×ATR ($${fmt2(ind.atr.value * 1.5)}) ajusté au support/résistance le plus proche
- target_price = niveau Fibonacci ou S/R cohérent avec le signal, R/R minimum 1.8
- reasoning = synthèse des 4 étapes en 2-3 phrases fluides en français

Format JSON OBLIGATOIRE (sans markdown) :
{"signal":"LONG","confidence":72,"target_price":95000.50,"stop_loss":91000.00,"time_horizon":"2-4 heures","reasoning":"Analyse concise.","risk_reward":1.8}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
          responseSchema: {
            type: 'object',
            properties: {
              signal:       { type: 'string', enum: ['LONG', 'SHORT', 'NEUTRAL'] },
              confidence:   { type: 'number' },
              target_price: { type: 'number' },
              stop_loss:    { type: 'number' },
              time_horizon: { type: 'string' },
              reasoning:    { type: 'string' },
              risk_reward:  { type: 'number' }
            },
            required: ['signal', 'confidence', 'target_price', 'stop_loss', 'time_horizon', 'reasoning', 'risk_reward']
          }
        }
      })
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Aucun JSON dans la réponse Gemini');
  return JSON.parse(match[0].replace(/,\s*([}\]])/g, '$1').trim());
}

// ─────────────────────────────────────────
//  PREDICTION HISTORY (localStorage)
// ─────────────────────────────────────────
function savePrediction(pred, ind, regime) {
  const history = JSON.parse(localStorage.getItem('oracle_pred_history') || '[]');
  history.push({
    timestamp:   Date.now(),
    symbol:      state.symbol,
    priceAtCall: ind.currentPrice,
    signal:      pred.signal,
    target:      pred.target_price,
    stopLoss:    pred.stop_loss,
    confidence:  pred.confidence,
    regime,
    resolved:    false,
    outcome:     null
  });
  localStorage.setItem('oracle_pred_history', JSON.stringify(history.slice(-200)));
}

function resolvePredictions(currentPrice) {
  const history = JSON.parse(localStorage.getItem('oracle_pred_history') || '[]');
  history.forEach(p => {
    if (p.resolved || p.symbol !== state.symbol) return;
    if (p.signal === 'LONG') {
      if (currentPrice >= p.target)   { p.outcome = 'WIN';  p.resolved = true; }
      if (currentPrice <= p.stopLoss) { p.outcome = 'LOSS'; p.resolved = true; }
    } else if (p.signal === 'SHORT') {
      if (currentPrice <= p.target)   { p.outcome = 'WIN';  p.resolved = true; }
      if (currentPrice >= p.stopLoss) { p.outcome = 'LOSS'; p.resolved = true; }
    }
  });
  localStorage.setItem('oracle_pred_history', JSON.stringify(history));
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem('oracle_pred_history') || '[]');
  const tbody = document.getElementById('history-tbody');
  const badge = document.getElementById('winrate-badge');

  const resolved = history.filter(p => p.resolved);
  const wins = resolved.filter(p => p.outcome === 'WIN').length;
  const wr = resolved.length ? Math.round(wins / resolved.length * 100) : null;

  badge.textContent = wr !== null ? `Win rate ${wr}% (${wins}/${resolved.length})` : 'Win rate —';
  badge.style.background = wr != null ? (wr >= 60 ? 'var(--green-bg)' : wr >= 40 ? 'var(--orange-bg)' : 'var(--red-bg)') : '';
  badge.style.color = wr != null ? (wr >= 60 ? 'var(--green)' : wr >= 40 ? 'var(--orange)' : 'var(--red)') : '';

  const recent = [...history].reverse().slice(0, 10);
  if (!recent.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-history">Aucune prédiction enregistrée</td></tr>';
    return;
  }

  tbody.innerHTML = recent.map(p => {
    const time = new Date(p.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const date = new Date(p.timestamp).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
    const signalCls = p.signal === 'LONG' ? 'style="color:var(--green)"' : p.signal === 'SHORT' ? 'style="color:var(--red)"' : '';
    const outcomeCls = p.outcome === 'WIN' ? 'outcome-win' : p.outcome === 'LOSS' ? 'outcome-loss' : 'outcome-pending';
    const outcomeLabel = p.outcome || (p.resolved ? '—' : 'Ouvert');
    return `<tr>
      <td>${date} ${time}</td>
      <td>${p.symbol.replace('USDT','')}</td>
      <td ${signalCls}>${p.signal}</td>
      <td>$${fmt(p.priceAtCall)}</td>
      <td>$${fmt(p.target)}</td>
      <td>$${fmt(p.stopLoss)}</td>
      <td>${p.confidence}%</td>
      <td><span class="${outcomeCls}">${outcomeLabel}</span></td>
    </tr>`;
  }).join('');
}

// ─────────────────────────────────────────
//  CHARTS
// ─────────────────────────────────────────
function chartOptions(height, bg = 'transparent') {
  return {
    width: 0, height,
    layout: { background: { type: 'solid', color: bg }, textColor: '#a09890' },
    grid: { vertLines: { color: '#f0ece8' }, horzLines: { color: '#f0ece8' } },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor: '#e8e4df' },
    timeScale: { borderColor: '#e8e4df', timeVisible: true, secondsVisible: false },
    handleScroll: true, handleScale: true
  };
}

function initCharts() {
  const mainEl = document.getElementById('main-chart');
  state.chart = LightweightCharts.createChart(mainEl, chartOptions(380));

  state.candleSeries = state.chart.addCandlestickSeries({
    upColor: '#15803d', downColor: '#b91c1c',
    borderUpColor: '#15803d', borderDownColor: '#b91c1c',
    wickUpColor: '#86efac', wickDownColor: '#fca5a5'
  });

  state.ema20Series = state.chart.addLineSeries({
    color: '#d97706', lineWidth: 1.5, title: 'EMA20',
    lastValueVisible: false, priceLineVisible: false
  });

  state.ema50Series = state.chart.addLineSeries({
    color: '#1d4ed8', lineWidth: 1.5, title: 'EMA50',
    lastValueVisible: false, priceLineVisible: false
  });

  const rsiEl = document.getElementById('rsi-chart');
  state.rsiChart = LightweightCharts.createChart(rsiEl, {
    ...chartOptions(100, '#f9f7f4'),
    rightPriceScale: { borderColor: '#e8e4df', scaleMargins: { top: 0.1, bottom: 0.1 } }
  });

  state.rsiSeries = state.rsiChart.addLineSeries({
    color: '#7c3aed', lineWidth: 1.5, title: 'RSI',
    lastValueVisible: true, priceLineVisible: false
  });

  state.obLine = state.rsiChart.addLineSeries({
    color: 'rgba(185,28,28,0.4)', lineWidth: 1, lineStyle: 1,
    lastValueVisible: false, priceLineVisible: false, title: ''
  });
  state.osLine = state.rsiChart.addLineSeries({
    color: 'rgba(21,128,61,0.4)', lineWidth: 1, lineStyle: 1,
    lastValueVisible: false, priceLineVisible: false, title: ''
  });

  let syncing = false;
  state.chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
    if (syncing || !range) return; syncing = true;
    state.rsiChart.timeScale().setVisibleLogicalRange(range); syncing = false;
  });
  state.rsiChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
    if (syncing || !range) return; syncing = true;
    state.chart.timeScale().setVisibleLogicalRange(range); syncing = false;
  });

  const ro = new ResizeObserver(() => {
    state.chart.applyOptions({ width: mainEl.clientWidth });
    state.rsiChart.applyOptions({ width: rsiEl.clientWidth });
  });
  ro.observe(mainEl);
  ro.observe(rsiEl);
}

function updateCharts(candles, ind) {
  state.candleSeries.setData(candles);

  const ema20Data = candles.map((c, i) => ind.ema.ema20Array[i] != null ? { time: c.time, value: ind.ema.ema20Array[i] } : null).filter(Boolean);
  const ema50Data = candles.map((c, i) => ind.ema.ema50Array[i] != null ? { time: c.time, value: ind.ema.ema50Array[i] } : null).filter(Boolean);
  state.ema20Series.setData(ema20Data);
  state.ema50Series.setData(ema50Data);

  const rsiData = candles.map((c, i) => ind.rsi.array[i] != null ? { time: c.time, value: ind.rsi.array[i] } : null).filter(Boolean);
  state.rsiSeries.setData(rsiData);

  const t0 = candles[0].time, tN = candles[candles.length - 1].time;
  state.obLine.setData([{ time: t0, value: 70 }, { time: tN, value: 70 }]);
  state.osLine.setData([{ time: t0, value: 30 }, { time: tN, value: 30 }]);

  state.chart.timeScale().fitContent();
  state.rsiChart.timeScale().fitContent();
}

// ─────────────────────────────────────────
//  UI helpers
// ─────────────────────────────────────────
function fmt(n, dec = 2) {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function setInd(id, value, cls) {
  const el = document.getElementById(`ind-${id}`);
  if (!el) return;
  el.textContent = value ?? '—';
  el.className = `ind-value ${cls || ''}`;
}

function updateDashboard(ind, pred) {
  document.getElementById('price').textContent = `$${fmt(ind.currentPrice)}`;

  const tb = document.getElementById('trend-badge');
  tb.textContent = ind.trend;
  tb.className = 'pill ' + (ind.trend === 'HAUSSIER' ? 'pill-green' : ind.trend === 'BAISSIER' ? 'pill-red' : 'pill-neutral');

  document.getElementById('meta-support').textContent    = `$${fmt(ind.sr.support)}`;
  document.getElementById('meta-resistance').textContent = `$${fmt(ind.sr.resistance)}`;
  document.getElementById('meta-atr').textContent        = `$${fmt(ind.atr.value)} (${fmt(ind.atr.pct, 1)}%)`;
  document.getElementById('meta-fib').textContent        = `${ind.nearestFib.label} · $${fmt(ind.nearestFib.value)}`;

  // Regime
  const r = regimeLabel(state.regime);
  const rt = document.getElementById('regime-tag');
  rt.textContent = r.label;
  rt.className = `regime-tag ${r.cls} ml-auto`;
  const pr = document.getElementById('pred-regime');
  if (pr) pr.textContent = r.label;

  // Confluence bar
  const c = state.confluence;
  if (c) {
    const bar = document.getElementById('confluence-bar');
    bar.style.width = `${c.score}%`;
    bar.style.background = c.score > 65 ? 'var(--green)' : c.score < 35 ? 'var(--red)' : 'var(--orange)';
    document.getElementById('confluence-score').textContent = `${c.bull}↑ ${c.bear}↓`;
  }

  // Indicators
  setInd('rsi', fmt(ind.rsi.value, 1), ind.rsi.overbought ? 'ind-red' : ind.rsi.oversold ? 'ind-green' : 'ind-text');
  setInd('srsi', ind.stochRSI.value != null ? fmt(ind.stochRSI.value, 1) : '—',
    ind.stochRSI.overbought ? 'ind-red' : ind.stochRSI.oversold ? 'ind-green' : 'ind-text');
  setInd('macd', fmt(ind.macd.histogram, 4), ind.macd.bullish ? 'ind-green' : 'ind-red');
  setInd('adx', `${fmt(ind.adx.value, 1)} · ${ind.adx.label}`, ind.adx.strong ? 'ind-blue' : 'ind-text');
  setInd('ema20', `$${fmt(ind.ema.ema20)}`, ind.currentPrice > ind.ema.ema20 ? 'ind-green' : 'ind-red');
  setInd('ema50', `$${fmt(ind.ema.ema50)}`, ind.currentPrice > ind.ema.ema50 ? 'ind-green' : 'ind-red');
  setInd('ema200', `$${fmt(ind.ema.ema200)}`, ind.currentPrice > ind.ema.ema200 ? 'ind-green' : 'ind-red');
  setInd('bb-pct', `${fmt(ind.bb.percentB, 1)}%`,
    ind.bb.percentB > 80 ? 'ind-red' : ind.bb.percentB < 20 ? 'ind-green' : 'ind-text');
  setInd('bb-bw', `${fmt(ind.bb.bandwidth, 1)}%`, 'ind-orange');
  setInd('obv', ind.obv.trend, ind.obv.trend === 'HAUSSIER' ? 'ind-green' : ind.obv.trend === 'BAISSIER' ? 'ind-red' : 'ind-text');
  setInd('roc', ind.roc.label, ind.roc.value > 0 ? 'ind-green' : ind.roc.value < 0 ? 'ind-red' : 'ind-text');
  setInd('volume', ind.volume.trend,
    ind.volume.ratio > 1.5 ? 'ind-green' : ind.volume.ratio < 0.5 ? 'ind-red' : 'ind-text');

  // AI Panel
  if (pred) {
    const icons = { LONG: '↑', SHORT: '↓', NEUTRAL: '—' };
    document.getElementById('signal-mark').innerHTML = `<span style="font-size:1.2rem;">${icons[pred.signal] || '—'}</span>`;
    document.getElementById('signal-mark').className = `signal-mark ${pred.signal === 'LONG' ? 'sig-long-mark' : pred.signal === 'SHORT' ? 'sig-short-mark' : 'sig-neutral-mark'}`;

    const sigEl = document.getElementById('signal');
    sigEl.textContent = pred.signal;
    sigEl.className = `signal-word ${pred.signal === 'LONG' ? 'sig-long-txt' : pred.signal === 'SHORT' ? 'sig-short-txt' : 'sig-neutral-txt'}`;

    document.getElementById('signal-sub').textContent = `${pred.confidence}% de confiance · ${pred.time_horizon || '—'}`;

    document.getElementById('confidence').textContent = `${pred.confidence}%`;
    const fill = document.getElementById('conf-bar-fill');
    fill.style.width = `${pred.confidence}%`;
    fill.className = `conf-fill ${pred.confidence >= 70 ? 'conf-fill-high' : pred.confidence >= 50 ? 'conf-fill-mid' : 'conf-fill-low'}`;

    document.getElementById('target').textContent   = `$${fmt(pred.target_price)}`;
    document.getElementById('stoploss').textContent = `$${fmt(pred.stop_loss)}`;
    document.getElementById('horizon').textContent  = pred.time_horizon || '—';
    document.getElementById('rr').textContent       = pred.risk_reward != null ? fmt(pred.risk_reward, 2) : '—';
    document.getElementById('reasoning').textContent = pred.reasoning || '';

    document.getElementById('no-pred-msg').style.display  = 'none';
    document.getElementById('pred-content').style.display = 'block';
  }

  document.getElementById('last-update').textContent = new Date().toLocaleTimeString('fr-FR');
  renderHistory();
}

// ─────────────────────────────────────────
//  STATUS & LOADER
// ─────────────────────────────────────────
function setStatus(msg, type) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = `status status-${type}`;
}

function showLoader(show) {
  document.getElementById('loader').style.display = show ? 'flex' : 'none';
}

// ─────────────────────────────────────────
//  AUTO-REFRESH
// ─────────────────────────────────────────
function resetTimer() {
  if (state.refreshTimer) clearInterval(state.refreshTimer);
  state.countdown = 30 * 60;
  updateCountdown();
  state.refreshTimer = setInterval(() => {
    state.countdown--;
    updateCountdown();
    if (state.countdown <= 0) refresh();
  }, 1000);
}

function updateCountdown() {
  const m = Math.floor(state.countdown / 60);
  const s = state.countdown % 60;
  document.getElementById('countdown').textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

// ─────────────────────────────────────────
//  MAIN REFRESH
// ─────────────────────────────────────────
async function refresh() {
  setStatus('Chargement...', 'loading');
  showLoader(true);

  try {
    // 1 — Données marché multi-timeframe
    [state.candles, state.candles1h, state.candles4h] = await Promise.all([
      fetchCandles(state.symbol, '30m', 300),
      fetchCandles(state.symbol, '1h', 200),
      fetchCandles(state.symbol, '4h', 150)
    ]);

    // 2 — Données futures (non-bloquant)
    [state.fundingRate, state.openInterest] = await Promise.all([
      fetchFundingRate(state.symbol),
      fetchOpenInterest(state.symbol)
    ]);

    // 3 — Calcul indicateurs
    state.indicators = analyzeAllIndicators(state.candles);
    state.ind1h      = analyzeAllIndicators(state.candles1h);
    state.ind4h      = analyzeAllIndicators(state.candles4h);

    // 4 — Régime & confluence
    state.regime     = detectMarketRegime(state.indicators);
    state.confluence = computeConfluenceScore(state.indicators);

    // 5 — Résoudre prédictions ouvertes
    resolvePredictions(state.indicators.currentPrice);

    // 6 — Charts
    updateCharts(state.candles, state.indicators);

    // 7 — IA (si clé disponible ET confluence forte OU forçage manuel)
    if (state.geminiKey) {
      setStatus('Analyse IA...', 'ai');
      showLoader(false);
      try {
        state.prediction = await callGemini(
          state.indicators, state.ind1h, state.ind4h,
          state.symbol, state.regime, state.confluence,
          state.fundingRate, state.openInterest
        );
        if (state.prediction) savePrediction(state.prediction, state.indicators, state.regime);
      } catch (e) {
        console.error('Gemini error:', e);
        setStatus(`IA: ${e.message}`, 'error');
      }
    }

    updateDashboard(state.indicators, state.prediction);
    setStatus('Synchronisé', 'ok');
    resetTimer();
  } catch (e) {
    setStatus(`Erreur: ${e.message}`, 'error');
    console.error(e);
  } finally {
    showLoader(false);
  }
}

// ─────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initCharts();

  const saved = localStorage.getItem('oracle_gemini_key') || '';
  if (saved) { state.geminiKey = saved; document.getElementById('api-key').value = saved; }

  document.getElementById('api-key').addEventListener('input', e => {
    state.geminiKey = e.target.value.trim();
    localStorage.setItem('oracle_gemini_key', state.geminiKey);
  });

  document.getElementById('symbol-select').addEventListener('change', e => {
    state.symbol     = e.target.value;
    state.prediction = null;
    document.getElementById('no-pred-msg').style.display  = 'block';
    document.getElementById('pred-content').style.display = 'none';
    document.getElementById('signal').textContent  = 'Attente';
    document.getElementById('signal').className    = 'signal-word sig-neutral-txt';
    document.getElementById('signal-sub').textContent = 'Aucun signal';
    refresh();
  });

  document.getElementById('refresh-btn').addEventListener('click', refresh);

  refresh();
});
