// ============================================================
//  api.js — Couche données
//  Binance REST (klines, funding rate, open interest)
//  Google Gemini 2.5 Flash (Chain-of-Thought, JSON structuré)
// ============================================================

// ─── Binance — Bougies ───────────────────────────────────────
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
    volume: parseFloat(c[5]),
    closeTime: c[6]
  }));
}

// ─── Binance — Bougies 5min fermées uniquement ───────────────
async function fetchCandles5m(symbol, limit = 200) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=5m&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const raw = await res.json();
  const now = Date.now();
  // On exclut la dernière bougie si elle n'est pas encore fermée
  const closed = raw.filter(c => c[6] < now);
  return closed.map(c => ({
    time:   Math.floor(c[0] / 1000),
    open:   parseFloat(c[1]),
    high:   parseFloat(c[2]),
    low:    parseFloat(c[3]),
    close:  parseFloat(c[4]),
    volume: parseFloat(c[5]),
    closeTime: c[6]
  }));
}

// ─── Binance Futures — Funding Rate ──────────────────────────
async function fetchFundingRate(symbol) {
  try {
    const res = await fetch(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=3`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    const rate = parseFloat(data[data.length - 1].fundingRate) * 100;
    return {
      rate,
      label:     rate > 0.05  ? 'ÉLEVÉ POSITIF' : rate < -0.05 ? 'NÉGATIF' : 'NEUTRE',
      sentiment: rate > 0.05  ? 'Marché suracheté (longs surexposés)'
                               : rate < -0.05 ? 'Marché survendu (shorts surexposés)'
                               : 'Équilibré'
    };
  } catch { return null; }
}

// ─── Binance Futures — Open Interest ─────────────────────────
async function fetchOpenInterest(symbol) {
  try {
    const res = await fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`);
    if (!res.ok) return null;
    return parseFloat((await res.json()).openInterest);
  } catch { return null; }
}

// ─── Google Gemini 2.5 Flash — Prédiction CoT ────────────────
async function callGemini(geminiKey, ind, ind5m, ind1h, ind4h, symbol, regime, confluence, funding, oi) {
  if (!geminiKey) return null;

  const fmt2 = n => n != null && !isNaN(n) ? n.toFixed(2) : 'N/A';
  const fmt4 = n => n != null && !isNaN(n) ? n.toFixed(4) : 'N/A';
  const pct  = n => n != null ? (n > 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%`) : 'N/A';

  // ── Bloc 5min ──────────────────────────────────────────────
  const tf5m = ind5m ? `
=== 5 MIN — ENTRÉE PRÉCISE (bougies clôturées) ===
Tendance: ${ind5m.trend} (score ${ind5m.trendScore}/4) · RSI: ${fmt2(ind5m.rsi.value)}${ind5m.rsi.overbought?' ⚠SURACHETÉ':ind5m.rsi.oversold?' ⚠SURVENDU':''}
MACD histo: ${fmt4(ind5m.macd.histogram)} (${ind5m.macd.bullish ? 'haussier' : 'baissier'}) · ADX: ${fmt2(ind5m.adx.value)} ${ind5m.adx.label}
Stoch RSI: ${fmt2(ind5m.stochRSI.value)} · OBV: ${ind5m.obv.trend} · Divergence OBV: ${ind5m.obv.divergence}
Volume: ×${ind5m.volume.ratio.toFixed(2)} · Pattern bougie: ${ind5m.pattern}
EMA20: $${fmt2(ind5m.ema.ema20)} · EMA50: $${fmt2(ind5m.ema.ema50)} · EMA200: $${fmt2(ind5m.ema.ema200)}
ATR(14): $${fmt2(ind5m.atr.value)} (${fmt2(ind5m.atr.pct)}%) · BB %B: ${fmt2(ind5m.bb.percentB)} · Bandwidth: ${fmt2(ind5m.bb.bandwidth)}%
Support 5m: $${fmt2(ind5m.sr.support)} · Résistance 5m: $${fmt2(ind5m.sr.resistance)}
ROC(10): ${pct(ind5m.roc.value)}
→ Utiliser ce timeframe pour AFFINER l'entrée et détecter les divergences court terme` : '';

  // ── Bloc multi-TF ──────────────────────────────────────────
  const multiTF = ind1h && ind4h ? `
=== MULTI-TIMEFRAMES (contexte + biais directionnel) ===
4H — Tendance: ${ind4h.trend} (score ${ind4h.trendScore}/4) · RSI: ${fmt2(ind4h.rsi.value)} · MACD: ${ind4h.macd.bullish ? 'haussier' : 'baissier'} · ADX: ${fmt2(ind4h.adx.value)} ${ind4h.adx.label} · OBV: ${ind4h.obv.trend}
1H — Tendance: ${ind1h.trend} (score ${ind1h.trendScore}/4) · RSI: ${fmt2(ind1h.rsi.value)} · MACD: ${ind1h.macd.bullish ? 'haussier' : 'baissier'} · ADX: ${fmt2(ind1h.adx.value)} ${ind1h.adx.label} · OBV: ${ind1h.obv.trend} · Stoch RSI: ${fmt2(ind1h.stochRSI.value)}
30M — Tendance: ${ind.trend} (score ${ind.trendScore}/4) · RSI: ${fmt2(ind.rsi.value)} · MACD: ${ind.macd.bullish ? 'haussier' : 'baissier'} · ADX: ${fmt2(ind.adx.value)} ${ind.adx.label} · OBV: ${ind.obv.trend}

Alignement 4H/1H/30M: ${
  [ind4h.trend, ind1h.trend, ind.trend].every(t => t === 'HAUSSIER') ? '✅ CONFLUENCE HAUSSIÈRE TOTALE — LONG prioritaire' :
  [ind4h.trend, ind1h.trend, ind.trend].every(t => t === 'BAISSIER') ? '✅ CONFLUENCE BAISSIÈRE TOTALE — SHORT prioritaire' :
  [ind4h.trend, ind1h.trend, ind.trend].filter(t => t === 'HAUSSIER').length >= 2 ? '⚠ Majorité haussière — LONG possible avec prudence' :
  [ind4h.trend, ind1h.trend, ind.trend].filter(t => t === 'BAISSIER').length >= 2 ? '⚠ Majorité baissière — SHORT possible avec prudence' :
  '🚫 DIVERGENCE TOTALE — NEUTRAL OBLIGATOIRE'
}
Alignement 5M vs 30M: ${ind5m ? (ind5m.trend === ind.trend ? `✅ Cohérent (${ind5m.trend})` : `⚠ Divergence 5m/30m (${ind5m.trend} vs ${ind.trend})`) : 'N/A'}` : '';

  const futuresData = `
=== DONNÉES FUTURES (ON-CHAIN) ===
Funding Rate: ${funding ? `${funding.rate.toFixed(4)}% — ${funding.label} — ${funding.sentiment}` : 'Indisponible'}
Open Interest: ${oi ? oi.toFixed(0) + ' contrats' : 'Indisponible'}`;

  const prompt = `Tu es un trader quantitatif senior avec 15 ans d'expérience en scalping et swing intraday. 
Analyse ${symbol} pour un trade sur le timeframe 30 MINUTES avec objectif 1h–6h.
Les bougies 5min utilisées sont TOUTES CLÔTURÉES (pas de bougie en cours).

Raisonne IMPÉRATIVEMENT en 4 étapes avant de conclure.

=== RÉGIME DE MARCHÉ ===
Régime détecté : ${regime}
Score de confluence interne : ${confluence.bull} signaux haussiers vs ${confluence.bear} baissiers (net: ${confluence.net > 0 ? '+' : ''}${confluence.net})
${tf5m}
${multiTF}
${futuresData}

=== INDICATEURS PRINCIPAUX 30MIN (timeframe de trade) ===
Prix: $${fmt2(ind.currentPrice)} · ROC(10): ${pct(ind.roc.value)} · Pattern: ${ind.pattern}
EMA20: $${fmt2(ind.ema.ema20)} (${ind.currentPrice > ind.ema.ema20 ? '↑ prix au-dessus' : '↓ prix en-dessous'})
EMA50: $${fmt2(ind.ema.ema50)} (${ind.currentPrice > ind.ema.ema50 ? '↑ prix au-dessus' : '↓ prix en-dessous'})
EMA200: $${fmt2(ind.ema.ema200)} (${ind.currentPrice > ind.ema.ema200 ? '↑ prix au-dessus' : '↓ prix en-dessous'})
RSI(14): ${fmt2(ind.rsi.value)}${ind.rsi.overbought ? ' ⚠ SURACHETÉ' : ind.rsi.oversold ? ' ⚠ SURVENDU' : ''} · StochRSI: ${fmt2(ind.stochRSI.value)}
MACD ligne: ${fmt4(ind.macd.line)} | Signal: ${fmt4(ind.macd.signal)} | Histo: ${fmt4(ind.macd.histogram)} (${ind.macd.bullish?'↑ positif':'↓ négatif'})
ADX: ${fmt2(ind.adx.value)} ${ind.adx.label} · DI+: ${fmt2(ind.adx.diPlus)} / DI-: ${fmt2(ind.adx.diMinus)}
ATR(14): $${fmt2(ind.atr.value)} (${fmt2(ind.atr.pct)}%) · BB %B: ${fmt2(ind.bb.percentB)} · Bandwidth: ${fmt2(ind.bb.bandwidth)}%
OBV: ${ind.obv.trend} · Divergence OBV: ${ind.obv.divergence}
Volume: ×${ind.volume.ratio.toFixed(2)} moyenne · ${ind.volume.trend}
Résistance 30m: $${fmt2(ind.sr.resistance)} · Support 30m: $${fmt2(ind.sr.support)}
Fib le plus proche: ${ind.nearestFib.label} ($${fmt2(ind.nearestFib.value)})
Fib complets: 23.6%=$${fmt2(ind.fib.f236)} / 38.2%=$${fmt2(ind.fib.f382)} / 50%=$${fmt2(ind.fib.f500)} / 61.8%=$${fmt2(ind.fib.f618)}

=== GUIDE DE RAISONNEMENT (inclus dans "reasoning") ===
ÉTAPE 1 — BIAIS DIRECTIONNEL: Quel est le biais dominant sur 4H/1H ? Le 30M confirme-t-il ? Le 5M donne-t-il une entrée précise ?
ÉTAPE 2 — CONFIRMATION: Quels indicateurs (au moins 3) confirment ce biais ? Lesquels contredisent ?
ÉTAPE 3 — NIVEAUX CLÉS: Quel est le stop loss logique (support/résistance + ATR) ? Quel target Fibonacci ou S/R avec R/R ≥ 1.8 ?
ÉTAPE 4 — TIMING: En combien de temps le trade devrait-il atteindre sa cible selon le régime et la volatilité (ATR) ?

Règles STRICTES (NON NÉGOCIABLES) :
- NEUTRAL OBLIGATOIRE si confluence.net entre -2 et +2 inclus
- NEUTRAL OBLIGATOIRE si régime VOLATILITE_EXPLOSIVE
- NEUTRAL OBLIGATOIRE si 4H et 1H dans des directions opposées
- LONG INTERDIT si RSI(30min) > 65 ET RSI(1H) > 60
- SHORT INTERDIT si RSI(30min) < 35 ET RSI(1H) < 40
- confidence maximum 70% si seulement un timeframe confirme
- confidence maximum 65% si divergence 5m vs 30m
- stop_loss = niveau support/résistance ± 1×ATR30m ($${fmt2(ind.atr.value)}) — ne JAMAIS dépasser 2×ATR
- target_price = niveau Fibonacci ou S/R avec R/R minimum 1.8
- time_to_close = estimation en heures (1h minimum, 6h maximum) basée sur ATR et régime
- reasoning = synthèse fluide des 4 étapes en 2-3 phrases en français, mentionnant l'entrée 5m si pertinente

Format JSON OBLIGATOIRE (sans markdown, sans backticks) :
{"signal":"LONG","confidence":72,"entry_price":${fmt2(ind.currentPrice)},"target_price":95000.50,"stop_loss":91000.00,"time_horizon":"2-4 heures","time_to_close":3,"reasoning":"Analyse concise.","risk_reward":1.8,"entry_note":"Entrer sur la prochaine bougie 5m de confirmation haussière au-dessus de $X"}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
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
              entry_price:  { type: 'number' },
              target_price: { type: 'number' },
              stop_loss:    { type: 'number' },
              time_horizon: { type: 'string' },
              time_to_close:{ type: 'number' },
              reasoning:    { type: 'string' },
              risk_reward:  { type: 'number' },
              entry_note:   { type: 'string' }
            },
            required: ['signal', 'confidence', 'entry_price', 'target_price', 'stop_loss', 'time_horizon', 'time_to_close', 'reasoning', 'risk_reward', 'entry_note']
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
  const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Aucun JSON dans la réponse Gemini');
  return JSON.parse(match[0].replace(/,\s*([}\]])/g, '$1').trim());
}
