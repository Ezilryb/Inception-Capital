// ============================================================
//  analysis.js — Analyse de marché
//  Détection du régime · Score de confluence interne
// ============================================================

// ─── Détection du régime de marché ───────────────────────────
function detectMarketRegime(ind) {
  if (ind.adx.value > 30 && Math.abs(ind.trendScore) >= 3) return 'TENDANCE_FORTE';
  if (ind.adx.value < 20 && ind.bb.bandwidth < 2)          return 'RANGE';
  if (ind.volume.ratio > 3 && ind.atr.pct > 2)             return 'VOLATILITE_EXPLOSIVE';
  if (ind.obv.divergence !== 'AUCUNE')                      return 'DIVERGENCE';
  return 'NEUTRE';
}

// ─── Libellé + classe CSS du régime ──────────────────────────
function regimeLabel(regime) {
  const map = {
    'TENDANCE_FORTE':       { label: 'Tendance forte',        cls: 'regime-trend'    },
    'RANGE':                { label: 'Range / consolidation', cls: 'regime-range'    },
    'VOLATILITE_EXPLOSIVE': { label: 'Volatilité explosive',  cls: 'regime-volatile' },
    'DIVERGENCE':           { label: 'Divergence OBV',        cls: 'regime-diverge'  },
    'NEUTRE':               { label: 'Régime neutre',         cls: 'regime-neutral'  }
  };
  return map[regime] || map['NEUTRE'];
}

// ─── Score de confluence (0 – 100, 50 = neutre) ──────────────
function computeConfluenceScore(ind) {
  let bull = 0, bear = 0;

  // Tendance EMA (poids double si forte)
  if (ind.trendScore >= 3)   bull += 2;
  if (ind.trendScore <= -3)  bear += 2;
  if (ind.trendScore === 2)  bull++;
  if (ind.trendScore === -2) bear++;

  // RSI (zones neutres uniquement)
  if (ind.rsi.value > 55 && !ind.rsi.overbought)  bull++;
  if (ind.rsi.value < 45 && !ind.rsi.oversold)    bear++;

  // MACD histogram
  if (ind.macd.bullish) bull++; else bear++;

  // ADX directionnel
  if (ind.adx.strong) {
    if (ind.adx.diPlus > ind.adx.diMinus) bull++; else bear++;
  }

  // OBV
  if (ind.obv.trend === 'HAUSSIER') bull++;
  if (ind.obv.trend === 'BAISSIER') bear++;

  // Volume en confirmation
  if (ind.volume.ratio > 1.5 && bull > bear) bull++;
  if (ind.volume.ratio > 1.5 && bear > bull) bear++;

  // Stochastic RSI
  if (ind.stochRSI.value != null) {
    if (ind.stochRSI.value > 60 && !ind.stochRSI.overbought) bull++;
    if (ind.stochRSI.value < 40 && !ind.stochRSI.oversold)   bear++;
  }

  const net   = bull - bear;
  const total = bull + bear || 1;
  const score = Math.round(((net + total) / (2 * total)) * 100);

  return {
    bull, bear, net,
    score,        // 0-100 (50 = neutre)
    strong:    Math.abs(net) >= 3,
    direction: net >= 3 ? 'BULLISH' : net <= -3 ? 'BEARISH' : 'NEUTRAL'
  };
}
