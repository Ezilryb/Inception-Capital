// ============================================================
//  indicators.js — Bibliothèque d'analyse technique
//  RSI · EMA · MACD · Bollinger Bands · Support/Résistance
// ============================================================

/**
 * EMA (Exponential Moving Average)
 * Seed = SMA des `period` premières valeurs, puis lissage exponentiel
 */
function calculateEMA(values, period) {
  if (values.length < period) return values.map(() => null);
  const k = 2 / (period + 1);
  const result = new Array(period - 1).fill(null);
  // Seed : moyenne simple
  const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(seed);
  let prev = seed;
  for (let i = period; i < values.length; i++) {
    const ema = values[i] * k + prev * (1 - k);
    result.push(ema);
    prev = ema;
  }
  return result;
}

/**
 * RSI (Relative Strength Index) — lissage de Wilder
 */
function calculateRSI(closes, period = 14) {
  if (closes.length <= period) return closes.map(() => null);
  const result = new Array(period).fill(null);

  // Premier calcul : SMA des gains/pertes sur `period` périodes
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;

  const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push(100 - 100 / (1 + rs0));

  // Lissage de Wilder
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }
  return result;
}

/**
 * MACD (Moving Average Convergence Divergence)
 * fast=12, slow=26, signal=9
 */
function calculateMACD(closes, fast = 12, slow = 26, signal = 9) {
  const emaFast = calculateEMA(closes, fast);
  const emaSlow = calculateEMA(closes, slow);

  const macdLine = closes.map((_, i) =>
    emaFast[i] !== null && emaSlow[i] !== null ? emaFast[i] - emaSlow[i] : null
  );

  // Signal = EMA(9) de la ligne MACD (valeurs non-null)
  const firstValidIdx = macdLine.findIndex(v => v !== null);
  const validMacd = macdLine.filter(v => v !== null);
  const sigEma = calculateEMA(validMacd, signal);

  const signalLine = new Array(firstValidIdx + signal - 1).fill(null);
  sigEma.forEach(v => signalLine.push(v));

  const histogram = macdLine.map((v, i) =>
    v !== null && signalLine[i] !== null ? v - signalLine[i] : null
  );

  return { macdLine, signalLine, histogram };
}

/**
 * Bollinger Bands (SMA ± k·σ)
 */
function calculateBollingerBands(closes, period = 20, mult = 2) {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    const upper = mean + mult * std;
    const lower = mean - mult * std;
    return {
      upper,
      middle: mean,
      lower,
      bandwidth: std === 0 ? 0 : (upper - lower) / mean * 100,
      percentB: std === 0 ? 50 : (closes[i] - lower) / (upper - lower) * 100
    };
  });
}

/**
 * Niveaux Support / Résistance (pivots sur lookback bougies)
 */
function calculateSupportResistance(candles, lookback = 50) {
  const n = Math.min(lookback, candles.length);
  const slice = candles.slice(-n);
  const highs = slice.map(c => c.high);
  const lows = slice.map(c => c.low);
  return {
    resistance: Math.max(...highs),
    support: Math.min(...lows),
    midpoint: (Math.max(...highs) + Math.min(...lows)) / 2
  };
}

/**
 * ATR (Average True Range) — lissage de Wilder
 * Mesure la volatilité réelle (corps + mèches + gaps)
 */
function calculateATR(candles, period = 14) {
  const result = [null]; // index 0 : pas de bougie précédente
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    trs.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low  - candles[i - 1].close)
    ));
  }
  for (let i = 0; i < period - 1; i++) result.push(null);
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(atr);
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    result.push(atr);
  }
  return result; // même longueur que candles
}

/**
 * ADX (Average Directional Index) — force de la tendance
 * ADX > 25 : tendance forte · DI+ > DI- : haussier · DI- > DI+ : baissier
 */
function calculateADX(candles, period = 14) {
  if (candles.length < period * 2) return { value: null, diPlus: null, diMinus: null, strong: false, label: 'N/A' };

  const plusDM = [], minusDM = [], trs = [];
  for (let i = 1; i < candles.length; i++) {
    const up   = candles[i].high - candles[i - 1].high;
    const down = candles[i - 1].low - candles[i].low;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
    trs.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low  - candles[i - 1].close)
    ));
  }

  // Lissage de Wilder (somme cumulée)
  const wilderSmooth = arr => {
    let s = arr.slice(0, period).reduce((a, b) => a + b, 0);
    const out = [s];
    for (let i = period; i < arr.length; i++) { s = s - s / period + arr[i]; out.push(s); }
    return out;
  };

  const sTR  = wilderSmooth(trs);
  const sPDM = wilderSmooth(plusDM);
  const sMDM = wilderSmooth(minusDM);

  const diP = sPDM.map((v, i) => sTR[i] ? v / sTR[i] * 100 : 0);
  const diM = sMDM.map((v, i) => sTR[i] ? v / sTR[i] * 100 : 0);
  const dx  = diP.map((v, i) => {
    const sum = v + diM[i];
    return sum ? Math.abs(v - diM[i]) / sum * 100 : 0;
  });

  // ADX = lissage Wilder du DX
  let adx = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dx.length; i++) adx = (adx * (period - 1) + dx[i]) / period;

  const lastDIP = diP[diP.length - 1];
  const lastDIM = diM[diM.length - 1];
  const strong  = adx > 25;
  return {
    value: adx, diPlus: lastDIP, diMinus: lastDIM, strong,
    label: adx > 40 ? 'TRÈS FORTE' : adx > 25 ? 'FORTE' : adx > 15 ? 'MODÉRÉE' : 'FAIBLE'
  };
}

/**
 * Stochastic RSI — RSI normalisé sur sa propre plage (14 dernières valeurs)
 * Retourne K (valeur) entre 0 et 100
 * <20 : survente · >80 : surachat · signal plus réactif que le RSI brut
 */
function calculateStochRSI(rsiArray, period = 14) {
  return rsiArray.map((_, i) => {
    if (i < period - 1 || rsiArray[i] == null) return null;
    const slice = rsiArray.slice(i - period + 1, i + 1).filter(v => v != null);
    if (slice.length < period) return null;
    const lo = Math.min(...slice), hi = Math.max(...slice);
    return hi === lo ? 50 : (rsiArray[i] - lo) / (hi - lo) * 100;
  });
}

/**
 * OBV (On Balance Volume) — flux cumulé du volume selon la direction du prix
 * Divergence OBV/prix = signal fort
 */
function calculateOBV(candles) {
  let obv = 0;
  const arr = [0];
  for (let i = 1; i < candles.length; i++) {
    if      (candles[i].close > candles[i - 1].close) obv += candles[i].volume;
    else if (candles[i].close < candles[i - 1].close) obv -= candles[i].volume;
    arr.push(obv);
  }
  const last = arr[arr.length - 1];
  const prev = arr[Math.max(0, arr.length - 21)]; // tendance sur 20 bougies
  const trend = last > prev * 1.01 ? 'HAUSSIER' : last < prev * 0.99 ? 'BAISSIER' : 'NEUTRE';
  const divergence = (() => {
    // Prix monte mais OBV baisse (ou inverse) sur les 20 dernières
    const priceTrend = candles[candles.length - 1].close > candles[Math.max(0, candles.length - 21)].close;
    const obvTrend   = last > prev;
    if (priceTrend && !obvTrend) return 'BAISSIÈRE (prix↑ OBV↓)';
    if (!priceTrend && obvTrend) return 'HAUSSIÈRE (prix↓ OBV↑)';
    return 'AUCUNE';
  })();
  return { value: last, trend, divergence };
}

/**
 * Niveaux de Fibonacci (retracement du swing high/low sur lookback bougies)
 */
function calculateFibonacci(candles, lookback = 100) {
  const slice = candles.slice(-lookback);
  const high  = Math.max(...slice.map(c => c.high));
  const low   = Math.min(...slice.map(c => c.low));
  const diff  = high - low;
  return {
    high, low,
    f236: high - diff * 0.236,
    f382: high - diff * 0.382,
    f500: high - diff * 0.500,
    f618: high - diff * 0.618,
    f786: high - diff * 0.786,
  };
}

/**
 * ROC (Rate of Change) — momentum brut en % sur `period` bougies
 */
function calculateROC(closes, period = 10) {
  const n = closes.length;
  if (n <= period) return null;
  const prev = closes[n - 1 - period];
  return prev ? (closes[n - 1] - prev) / prev * 100 : null;
}

/**
 * Détection de pattern de bougie (dernière + 2 précédentes)
 */
function detectCandlePattern(candles) {
  const n = candles.length;
  if (n < 3) return 'INCONNU';
  const c = candles[n - 1], p = candles[n - 2];

  const body      = Math.abs(c.close - c.open);
  const range     = c.high - c.low || 0.0001;
  const upperWick = c.high - Math.max(c.open, c.close);
  const lowerWick = Math.min(c.open, c.close) - c.low;
  const bull      = c.close >= c.open;

  if (body / range < 0.1)                                               return 'DOJI';
  if (lowerWick > body * 2 && upperWick < body * 0.3)                  return bull ? 'MARTEAU HAUSSIER' : 'MARTEAU';
  if (upperWick > body * 2 && lowerWick < body * 0.3)                  return bull ? 'ÉTOILE FILANTE' : 'ÉTOILE FILANTE BAISSIÈRE';
  if (bull && p.close < p.open && c.open < p.close && c.close > p.open) return 'AVALEMENT HAUSSIER';
  if (!bull && p.close > p.open && c.open > p.close && c.close < p.open) return 'AVALEMENT BAISSIER';
  if (body / range > 0.7 && bull)                                       return 'MARUBOZU HAUSSIER';
  if (body / range > 0.7 && !bull)                                      return 'MARUBOZU BAISSIER';

  return bull ? 'BOUGIE HAUSSIÈRE' : 'BOUGIE BAISSIÈRE';
}

/**
 * Analyse complète — retourne tous les indicateurs pour la dernière bougie
 */
function analyzeAllIndicators(candles) {
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const n = closes.length;

  const ema20Arr  = calculateEMA(closes, 20);
  const ema50Arr  = calculateEMA(closes, 50);
  const ema200Arr = calculateEMA(closes, 200);
  const rsiArr    = calculateRSI(closes, 14);
  const macdData  = calculateMACD(closes);
  const bbArr     = calculateBollingerBands(closes);
  const sr        = calculateSupportResistance(candles);

  // ── Nouveaux indicateurs ──
  const atrArr    = calculateATR(candles, 14);
  const adx       = calculateADX(candles, 14);
  const stochRSI  = calculateStochRSI(rsiArr, 14);
  const obv       = calculateOBV(candles);
  const fib       = calculateFibonacci(candles, 100);
  const roc10     = calculateROC(closes, 10);
  const pattern   = detectCandlePattern(candles);

  const last = n - 1;
  const currentPrice = closes[last];

  // Volume
  const avgVol  = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const lastVol = volumes[last];
  const volRatio = lastVol / avgVol;

  // Score de tendance EMA
  const e20 = ema20Arr[last];
  const e50 = ema50Arr[last];
  const e200 = ema200Arr[last];
  const trendScore = [
    currentPrice > e20  ? 1 : -1,
    currentPrice > e50  ? 1 : -1,
    currentPrice > e200 ? 1 : -1,
    e20 !== null && e50 !== null ? (e20 > e50 ? 1 : -1) : 0
  ].reduce((a, b) => a + b, 0);

  const lastRSI   = rsiArr[last];
  const lastBB    = bbArr[last];
  const lastHist  = macdData.histogram[last];
  const lastMACD  = macdData.macdLine[last];
  const lastSig   = macdData.signalLine[last];
  const lastATR   = atrArr[last];
  const lastStoch = stochRSI[last];

  // Niveau Fibonacci le plus proche du prix actuel
  const fibLevels = [
    { label: '23.6%', value: fib.f236 },
    { label: '38.2%', value: fib.f382 },
    { label: '50.0%', value: fib.f500 },
    { label: '61.8%', value: fib.f618 },
    { label: '78.6%', value: fib.f786 },
  ];
  const nearestFib = fibLevels.reduce((best, lvl) =>
    Math.abs(lvl.value - currentPrice) < Math.abs(best.value - currentPrice) ? lvl : best
  );

  return {
    currentPrice, n,
    ema: {
      ema20: e20, ema50: e50, ema200: e200,
      ema20Array: ema20Arr, ema50Array: ema50Arr
    },
    rsi: {
      value: lastRSI,
      overbought: lastRSI > 70,
      oversold:   lastRSI < 30,
      array: rsiArr
    },
    macd: {
      line: lastMACD, signal: lastSig, histogram: lastHist,
      bullish: lastHist !== null && lastHist > 0,
      array: macdData
    },
    bb: {
      upper: lastBB?.upper, middle: lastBB?.middle, lower: lastBB?.lower,
      bandwidth: lastBB?.bandwidth, percentB: lastBB?.percentB,
      array: bbArr
    },
    volume: {
      last: lastVol, average: avgVol, ratio: volRatio,
      trend: volRatio > 1.5 ? 'ÉLEVÉ' : volRatio < 0.5 ? 'FAIBLE' : 'NORMAL'
    },
    sr,
    // ── Nouveaux ──
    atr: { value: lastATR, pct: lastATR && currentPrice ? lastATR / currentPrice * 100 : null },
    adx,
    stochRSI: {
      value: lastStoch,
      overbought: lastStoch != null && lastStoch > 80,
      oversold:   lastStoch != null && lastStoch < 20
    },
    obv,
    fib, nearestFib,
    roc: { value: roc10, label: roc10 != null ? (roc10 > 0 ? `+${roc10.toFixed(2)}%` : `${roc10.toFixed(2)}%`) : 'N/A' },
    pattern,
    trendScore,
    trend: trendScore >= 2 ? 'HAUSSIER' : trendScore <= -2 ? 'BAISSIER' : 'NEUTRE'
  };
}
