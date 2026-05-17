// ============================================================
//  app.js — Orchestrateur principal
//  État global · Cycle de rafraîchissement · Événements
// ============================================================

// ─── État global ─────────────────────────────────────────────
const state = {
  // Données marché
  candles:      [],
  candles1h:    [],
  candles4h:    [],
  indicators:   null,
  ind1h:        null,
  ind4h:        null,
  fundingRate:  null,
  openInterest: null,
  prediction:   null,

  // Contexte
  symbol:    'BTCUSDT',
  geminiKey: '',
  regime:    'NEUTRE',
  confluence: null,

  // Graphiques (références LightweightCharts)
  chart:        null,
  rsiChart:     null,
  candleSeries: null,
  ema20Series:  null,
  ema50Series:  null,
  rsiSeries:    null,
  obLine:       null,
  osLine:       null,

  // Timer
  refreshTimer: null,
  countdown:    30 * 60
};

// ─── Cycle de rafraîchissement ───────────────────────────────
function resetTimer() {
  if (state.refreshTimer) clearInterval(state.refreshTimer);
  state.countdown = 30 * 60;
  updateCountdown(state.countdown);
  state.refreshTimer = setInterval(() => {
    state.countdown--;
    updateCountdown(state.countdown);
    if (state.countdown <= 0) refresh();
  }, 1000);
}

// ─── Rafraîchissement principal ──────────────────────────────
async function refresh() {
  setStatus('Chargement...', 'loading');
  showLoader(true);

  try {
    // 1 — Données marché multi-timeframe
    [state.candles, state.candles1h, state.candles4h] = await Promise.all([
      fetchCandles(state.symbol, '30m', 300),
      fetchCandles(state.symbol, '1h',  200),
      fetchCandles(state.symbol, '4h',  150)
    ]);

    // 2 — Données futures (non-bloquant)
    [state.fundingRate, state.openInterest] = await Promise.all([
      fetchFundingRate(state.symbol),
      fetchOpenInterest(state.symbol)
    ]);

    // 3 — Calcul des indicateurs (tous timeframes)
    state.indicators = analyzeAllIndicators(state.candles);
    state.ind1h      = analyzeAllIndicators(state.candles1h);
    state.ind4h      = analyzeAllIndicators(state.candles4h);

    // 4 — Régime de marché + score de confluence
    state.regime     = detectMarketRegime(state.indicators);
    state.confluence = computeConfluenceScore(state.indicators);

    // 5 — Résolution des prédictions ouvertes
    resolvePredictions(state.indicators.currentPrice, state.symbol);

    // 6 — Mise à jour des graphiques
    updateCharts(state, state.candles, state.indicators);

    // 7 — Appel IA Gemini (si clé configurée)
    if (state.geminiKey) {
      setStatus('Analyse IA...', 'ai');
      showLoader(false);
      try {
        state.prediction = await callGemini(
          state.geminiKey,
          state.indicators, state.ind1h, state.ind4h,
          state.symbol, state.regime, state.confluence,
          state.fundingRate, state.openInterest
        );
        if (state.prediction) {
          savePrediction(state.prediction, state.indicators, state.symbol, state.regime);
        }
      } catch (e) {
        console.error('Gemini error:', e);
        setStatus(`IA: ${e.message}`, 'error');
      }
    }

    // 8 — Rendu du dashboard
    updateDashboard(state.indicators, state.prediction, state.regime, state.confluence);
    setStatus('Synchronisé', 'ok');
    resetTimer();
  } catch (e) {
    setStatus(`Erreur: ${e.message}`, 'error');
    console.error(e);
  } finally {
    showLoader(false);
  }
}

// ─── Initialisation ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Thème (avant tout rendu pour éviter le flash)
  initTheme();

  // Graphiques
  initCharts(state);

  // Clé API sauvegardée
  const savedKey = localStorage.getItem('oracle_gemini_key') || '';
  if (savedKey) {
    state.geminiKey = savedKey;
    document.getElementById('api-key').value = savedKey;
  }

  // ── Listeners ──

  document.getElementById('api-key').addEventListener('input', e => {
    state.geminiKey = e.target.value.trim();
    localStorage.setItem('oracle_gemini_key', state.geminiKey);
  });

  document.getElementById('symbol-select').addEventListener('change', e => {
    state.symbol     = e.target.value;
    state.prediction = null;
    resetAIPanel();
    refresh();
  });

  document.getElementById('refresh-btn').addEventListener('click', refresh);

  document.getElementById('theme-toggle').addEventListener('click', () => {
    toggleTheme(state);
  });

  // ── Premier chargement ──
  refresh();
});
