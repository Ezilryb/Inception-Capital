// ============================================================
//  app.js — Logique principale CryptoOracle
//  Binance API · Gemini IA · Lightweight Charts · Auto-refresh
// ============================================================

const state = {
  candles:     [],
  indicators:  null,
  prediction:  null,
  symbol:      'BTCUSDT',
  geminiKey:   '',
  // Charts
  chart:       null,
  rsiChart:    null,
  candleSeries:  null,
  ema20Series:   null,
  ema50Series:   null,
  rsiSeries:     null,
  obLine:        null,
  osLine:        null,
  // Timer
  refreshTimer:  null,
  countdown:     30 * 60
};

// ─────────────────────────────────────────
//  BINANCE API
// ─────────────────────────────────────────
async function fetchBinanceData() {
  const url = `https://api.binance.com/api/v3/klines?symbol=${state.symbol}&interval=30m&limit=300`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance ${res.status}: ${state.symbol} introuvable`);
  const raw = await res.json();
  return raw.map(c => ({
    time:   Math.floor(c[0] / 1000),
    open:   parseFloat(c[1]),
    high:   parseFloat(c[2]),
    low:    parseFloat(c[3]),
    close:  parseFloat(c[4]),
    volume: parseFloat(c[5])
  }));
}

// ─────────────────────────────────────────
//  GEMINI API
// ─────────────────────────────────────────
async function callGemini(ind, symbol) {
  if (!state.geminiKey) return null;

  const fmt2 = n => n != null ? n.toFixed(2) : 'N/A';
  const fmt4 = n => n != null ? n.toFixed(4) : 'N/A';

  const prompt = `Tu es un analyste crypto expert. Analyse ces données techniques de ${symbol} (bougies 30min, ${ind.n} bougies) et retourne UNIQUEMENT un JSON valide.

=== PRIX & TENDANCE ===
Prix actuel : $${fmt2(ind.currentPrice)}
Tendance EMA : ${ind.trend} (score ${ind.trendScore}/4)
ROC(10) momentum : ${ind.roc.label}
Pattern bougie : ${ind.pattern}

=== MOYENNES MOBILES ===
EMA20  : $${fmt2(ind.ema.ema20)}  → prix ${ind.currentPrice > ind.ema.ema20 ? 'AU-DESSUS ✓' : 'EN-DESSOUS ✗'}
EMA50  : $${fmt2(ind.ema.ema50)}  → prix ${ind.currentPrice > ind.ema.ema50 ? 'AU-DESSUS ✓' : 'EN-DESSOUS ✗'}
EMA200 : $${fmt2(ind.ema.ema200)} → prix ${ind.currentPrice > ind.ema.ema200 ? 'AU-DESSUS ✓' : 'EN-DESSOUS ✗'}
Croisement : EMA20 ${ind.ema.ema20 > ind.ema.ema50 ? '> EMA50 (golden cross)' : '< EMA50 (death cross)'}

=== OSCILLATEURS ===
RSI(14)      : ${fmt2(ind.rsi.value)}${ind.rsi.overbought ? ' ⚠ SURACHETÉ' : ind.rsi.oversold ? ' ⚠ SURVENDU' : ' (zone neutre)'}
StochRSI(14) : ${fmt2(ind.stochRSI.value)}${ind.stochRSI.overbought ? ' ⚠ SURACHETÉ' : ind.stochRSI.oversold ? ' ⚠ SURVENDU' : ''}
MACD ligne   : ${fmt4(ind.macd.line)} | Signal : ${fmt4(ind.macd.signal)} | Histo : ${fmt4(ind.macd.histogram)} (${ind.macd.bullish ? '▲ haussier' : '▼ baissier'})

=== FORCE DE TENDANCE (ADX) ===
ADX(14) : ${fmt2(ind.adx.value)} — ${ind.adx.label}
DI+     : ${fmt2(ind.adx.diPlus)} | DI- : ${fmt2(ind.adx.diMinus)} → ${ind.adx.diPlus > ind.adx.diMinus ? 'pression ACHETEUSE' : 'pression VENDEUSE'}

=== VOLATILITÉ ===
ATR(14)         : $${fmt2(ind.atr.value)} (${fmt2(ind.atr.pct)}% du prix) — utilisé pour calibrer stop loss
Bollinger Upper : $${fmt2(ind.bb.upper)} | Middle : $${fmt2(ind.bb.middle)} | Lower : $${fmt2(ind.bb.lower)}
%B              : ${fmt2(ind.bb.percentB)} | Bandwidth : ${fmt2(ind.bb.bandwidth)}%

=== VOLUME ===
Volume actuel : x${ind.volume.ratio.toFixed(2)} la moyenne — ${ind.volume.trend}
OBV tendance  : ${ind.obv.trend}
OBV divergence: ${ind.obv.divergence}

=== NIVEAUX DE PRIX ===
Résistance  : $${fmt2(ind.sr.resistance)}
Support     : $${fmt2(ind.sr.support)}
Fib 23.6%   : $${fmt2(ind.fib.f236)}
Fib 38.2%   : $${fmt2(ind.fib.f382)}
Fib 50.0%   : $${fmt2(ind.fib.f500)}
Fib 61.8%   : $${fmt2(ind.fib.f618)}
Fib 78.6%   : $${fmt2(ind.fib.f786)}
Niveau Fib le plus proche : ${ind.nearestFib.label} ($${fmt2(ind.nearestFib.value)})

=== CONSIGNES ===
- stop_loss : utilise l'ATR ($${fmt2(ind.atr.value)}) pour calibrer (ex: prix ± 1.5×ATR)
- target_price : vise un niveau de résistance/support ou Fibonacci cohérent
- reasoning : synthèse en français des convergences/divergences entre indicateurs
- confidence : entre 30 et 95, pénalise si les indicateurs se contredisent, bonus si ADX fort

Format JSON OBLIGATOIRE (pur, sans markdown) :
{"signal":"LONG","confidence":72,"target_price":95000.50,"stop_loss":91000.00,"time_horizon":"2-4 heures","reasoning":"Analyse concise.","risk_reward":1.8}

signal = LONG | SHORT | NEUTRAL. Tous les champs sont obligatoires.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,          // 2.5-flash thinking consomme des tokens — budget large
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 }, // désactive le thinking (inutile pour JSON structuré)
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
  console.log('[Gemini raw]', JSON.stringify(data.candidates?.[0]?.content));
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Extraction robuste — regex greedy pour attraper l'objet complet (pas non-greedy *?)
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    console.error('[Gemini] Réponse brute:', raw);
    throw new Error('Aucun JSON trouvé dans la réponse Gemini');
  }

  const clean = match[0]
    .replace(/,\s*([}\]])/g, '$1')
    .trim();

  return JSON.parse(clean);
}

// ─────────────────────────────────────────
//  CHARTS — lightweight-charts v4
// ─────────────────────────────────────────
function chartOptions(height) {
  return {
    width:  0,
    height,
    layout: {
      background: { type: 'solid', color: 'transparent' },
      textColor: '#5a7090'
    },
    grid: {
      vertLines: { color: '#0a1220' },
      horzLines: { color: '#0a1220' }
    },
    crosshair:        { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale:  { borderColor: '#142030' },
    timeScale:        { borderColor: '#142030', timeVisible: true, secondsVisible: false },
    handleScroll:     true,
    handleScale:      true
  };
}

function initCharts() {
  // ── Main candlestick chart ──
  const mainEl = document.getElementById('main-chart');
  state.chart = LightweightCharts.createChart(mainEl, chartOptions(420));

  state.candleSeries = state.chart.addCandlestickSeries({
    upColor:         '#00ff88',
    downColor:       '#ff3355',
    borderUpColor:   '#00ff88',
    borderDownColor: '#ff3355',
    wickUpColor:     '#00ff88',
    wickDownColor:   '#ff3355'
  });

  state.ema20Series = state.chart.addLineSeries({
    color: '#ffd700', lineWidth: 1,
    title: 'EMA20', lastValueVisible: false, priceLineVisible: false
  });

  state.ema50Series = state.chart.addLineSeries({
    color: '#00d4ff', lineWidth: 1,
    title: 'EMA50', lastValueVisible: false, priceLineVisible: false
  });

  // ── RSI chart ──
  const rsiEl = document.getElementById('rsi-chart');
  state.rsiChart = LightweightCharts.createChart(rsiEl, {
    ...chartOptions(120),
    rightPriceScale: { borderColor: '#142030', scaleMargins: { top: 0.1, bottom: 0.1 } }
  });

  state.rsiSeries = state.rsiChart.addLineSeries({
    color: '#9d6eff', lineWidth: 2,
    title: 'RSI', lastValueVisible: true, priceLineVisible: false
  });

  // Lignes OB/OS — remplies après chargement des données
  state.obLine = state.rsiChart.addLineSeries({
    color: 'rgba(255,51,85,0.5)', lineWidth: 1, lineStyle: 1,
    lastValueVisible: false, priceLineVisible: false, title: ''
  });
  state.osLine = state.rsiChart.addLineSeries({
    color: 'rgba(0,255,136,0.5)', lineWidth: 1, lineStyle: 1,
    lastValueVisible: false, priceLineVisible: false, title: ''
  });

  // ── Sync scroll entre les deux charts ──
  let syncing = false;
  state.chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
    if (syncing || !range) return;
    syncing = true;
    state.rsiChart.timeScale().setVisibleLogicalRange(range);
    syncing = false;
  });
  state.rsiChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
    if (syncing || !range) return;
    syncing = true;
    state.chart.timeScale().setVisibleLogicalRange(range);
    syncing = false;
  });

  // ── Responsive resize ──
  const ro = new ResizeObserver(() => {
    state.chart.applyOptions({ width: mainEl.clientWidth });
    state.rsiChart.applyOptions({ width: rsiEl.clientWidth });
  });
  ro.observe(mainEl);
  ro.observe(rsiEl);
}

function updateCharts(candles, ind) {
  // Candlesticks
  state.candleSeries.setData(candles);

  // EMA lines (on filtre les null)
  const ema20Data = candles
    .map((c, i) => ind.ema.ema20Array[i] != null ? { time: c.time, value: ind.ema.ema20Array[i] } : null)
    .filter(Boolean);
  const ema50Data = candles
    .map((c, i) => ind.ema.ema50Array[i] != null ? { time: c.time, value: ind.ema.ema50Array[i] } : null)
    .filter(Boolean);
  state.ema20Series.setData(ema20Data);
  state.ema50Series.setData(ema50Data);

  // RSI
  const rsiData = candles
    .map((c, i) => ind.rsi.array[i] != null ? { time: c.time, value: ind.rsi.array[i] } : null)
    .filter(Boolean);
  state.rsiSeries.setData(rsiData);

  // Lignes OB/OS avec la plage temporelle exacte
  const t0 = candles[0].time;
  const tN = candles[candles.length - 1].time;
  state.obLine.setData([{ time: t0, value: 70 }, { time: tN, value: 70 }]);
  state.osLine.setData([{ time: t0, value: 30 }, { time: tN, value: 30 }]);

  state.chart.timeScale().fitContent();
  state.rsiChart.timeScale().fitContent();
}

// ─────────────────────────────────────────
//  UI — mise à jour du dashboard
// ─────────────────────────────────────────
function fmt(n, dec = 2) {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function setInd(id, value, cls) {
  const el = document.getElementById(`ind-${id}`);
  if (!el) return;
  el.textContent = value ?? '—';
  el.className = `ind-value text-${cls}`;
}

function updateDashboard(ind, pred) {
  // Prix principal
  document.getElementById('price').textContent = `$${fmt(ind.currentPrice)}`;

  // Badge tendance
  const tb = document.getElementById('trend-badge');
  tb.textContent = ind.trend;
  tb.className = 'badge ' + (
    ind.trend === 'HAUSSIER' ? 'badge-green' :
    ind.trend === 'BAISSIER' ? 'badge-red' : 'badge-neutral'
  );

  // Indicateurs
  setInd('rsi', fmt(ind.rsi.value, 1),
    ind.rsi.overbought ? 'red' : ind.rsi.oversold ? 'green' : 'cyan');
  setInd('macd', fmt(ind.macd.histogram, 4),
    ind.macd.bullish ? 'green' : 'red');
  setInd('ema20', `$${fmt(ind.ema.ema20)}`,
    ind.currentPrice > ind.ema.ema20 ? 'green' : 'red');
  setInd('ema50', `$${fmt(ind.ema.ema50)}`,
    ind.currentPrice > ind.ema.ema50 ? 'green' : 'red');
  setInd('ema200', `$${fmt(ind.ema.ema200)}`,
    ind.currentPrice > ind.ema.ema200 ? 'green' : 'red');
  setInd('bb-upper', `$${fmt(ind.bb.upper)}`, 'text');
  setInd('bb-lower', `$${fmt(ind.bb.lower)}`, 'text');
  setInd('bb-bw', `${fmt(ind.bb.bandwidth, 1)}%`, 'gold');
  setInd('volume', ind.volume.trend,
    ind.volume.ratio > 1.5 ? 'green' : ind.volume.ratio < 0.5 ? 'red' : 'cyan');
  setInd('support',    `$${fmt(ind.sr.support)}`,    'green');
  setInd('resistance', `$${fmt(ind.sr.resistance)}`, 'red');

  // Panneau prédiction IA
  if (pred) {
    const sigEl = document.getElementById('signal');
    sigEl.textContent = pred.signal;
    sigEl.className = 'signal-badge ' + (
      pred.signal === 'LONG'  ? 'sig-long' :
      pred.signal === 'SHORT' ? 'sig-short' : 'sig-neutral'
    );

    document.getElementById('confidence').textContent = `${pred.confidence}%`;
    const bar = document.getElementById('conf-bar-fill');
    bar.style.width = `${pred.confidence}%`;
    bar.className = `bar-fill ${
      pred.confidence >= 70 ? 'bar-green' :
      pred.confidence >= 50 ? 'bar-gold'  : 'bar-red'
    }`;

    document.getElementById('target').textContent    = `$${fmt(pred.target_price)}`;
    document.getElementById('stoploss').textContent  = `$${fmt(pred.stop_loss)}`;
    document.getElementById('horizon').textContent   = pred.time_horizon   || '—';
    document.getElementById('rr').textContent        = pred.risk_reward != null ? fmt(pred.risk_reward, 2) : '—';
    document.getElementById('reasoning').textContent = pred.reasoning || '';

    document.getElementById('no-pred-msg').style.display = 'none';
    document.getElementById('pred-content').style.display = 'block';
  }

  // Heure de mise à jour
  document.getElementById('last-update').textContent = new Date().toLocaleTimeString('fr-FR');
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
//  AUTO-REFRESH (countdown 30 min)
// ─────────────────────────────────────────
function resetTimer() {
  if (state.refreshTimer) clearInterval(state.refreshTimer);
  state.countdown = 30 * 60;
  updateCountdownUI();
  state.refreshTimer = setInterval(() => {
    state.countdown--;
    updateCountdownUI();
    if (state.countdown <= 0) refresh();
  }, 1000);
}

function updateCountdownUI() {
  const m = Math.floor(state.countdown / 60);
  const s = state.countdown % 60;
  document.getElementById('countdown').textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

// ─────────────────────────────────────────
//  MAIN REFRESH
// ─────────────────────────────────────────
async function refresh() {
  setStatus('Chargement Binance...', 'loading');
  showLoader(true);

  try {
    // 1 — Données marché
    state.candles    = await fetchBinanceData();
    state.indicators = analyzeAllIndicators(state.candles);
    updateCharts(state.candles, state.indicators);

    // 2 — Analyse IA (si clé disponible)
    if (state.geminiKey) {
      setStatus('Analyse Gemini IA...', 'ai');
      showLoader(false); // cache le loader pour que l'user voit le graphique pendant l'IA
      try {
        state.prediction = await callGemini(state.indicators, state.symbol);
      } catch (e) {
        console.error('Gemini error:', e);
        setStatus(`Gemini: ${e.message}`, 'error');
      }
    }

    updateDashboard(state.indicators, state.prediction);
    setStatus('Synchronisé ✓', 'ok');
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

  // Clé API sauvegardée
  const saved = localStorage.getItem('cryptooracle_gemini_key') || '';
  if (saved) {
    state.geminiKey = saved;
    document.getElementById('api-key').value = saved;
  }

  // Events
  document.getElementById('api-key').addEventListener('input', e => {
    state.geminiKey = e.target.value.trim();
    localStorage.setItem('cryptooracle_gemini_key', state.geminiKey);
  });

  document.getElementById('symbol-select').addEventListener('change', e => {
    state.symbol     = e.target.value;
    state.prediction = null;
    document.getElementById('no-pred-msg').style.display  = 'block';
    document.getElementById('pred-content').style.display = 'none';
    document.getElementById('signal').textContent         = '—';
    document.getElementById('signal').className           = 'signal-badge sig-neutral';
    refresh();
  });

  document.getElementById('refresh-btn').addEventListener('click', refresh);

  // Lancement initial
  refresh();
});
