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
    volume: parseFloat(c[5])
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
async function callGemini(geminiKey, ind, ind1h, ind4h, symbol, regime, confluence, funding, oi) {
  if (!geminiKey) return null;

  const fmt2 = n => n != null && !isNaN(n) ? n.toFixed(2) : 'N/A';
  const fmt4 = n => n != null && !isNaN(n) ? n.toFixed(4) : 'N/A';
  const pct  = n => n != null ? (n > 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%`) : 'N/A';

  const multiTF = ind1h && ind4h ? `
=== MULTI-TIMEFRAMES ===
4H — Tendance: ${ind4h.trend} (score ${ind4h.trendScore}/4) · RSI: ${fmt2(ind4h.rsi.value)} · MACD: ${ind4h.macd.bullish ? 'haussier' : 'baissier'} · ADX: ${fmt2(ind4h.adx.value)} ${ind4h.adx.label}
1H — Tendance: ${ind1h.trend} (score ${ind1h.trendScore}/4) · RSI: ${fmt2(ind1h.rsi.value)} · MACD: ${ind1h.macd.bullish ? 'haussier' : 'baissier'} · ADX: ${fmt2(ind1h.adx.value)} ${ind1h.adx.label}
30M — Tendance: ${ind.trend} (score ${ind.trendScore}/4) · RSI: ${fmt2(ind.rsi.value)} · MACD: ${ind.macd.bullish ? 'haussier' : 'baissier'} · ADX: ${fmt2(ind.adx.value)} ${ind.adx.label}
Alignement timeframes: ${
  [ind4h.trend, ind1h.trend, ind.trend].every(t => t === 'HAUSSIER') ? '✅ CONFLUENCE HAUSSIÈRE TOTALE' :
  [ind4h.trend, ind1h.trend, ind.trend].every(t => t === 'BAISSIER') ? '✅ CONFLUENCE BAISSIÈRE TOTALE' :
  '⚠ Divergence entre timeframes'
}` : '';

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
  const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Aucun JSON dans la réponse Gemini');
  return JSON.parse(match[0].replace(/,\s*([}\]])/g, '$1').trim());
}
