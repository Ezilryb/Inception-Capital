// ============================================================
//  history.js — Historique des prédictions
//  Persistance localStorage · Résolution automatique · Rendu
//  ⚠ Les trades NEUTRAL ne sont JAMAIS sauvegardés
// ============================================================

const HISTORY_KEY = 'oracle_pred_history';
const MAX_HISTORY = 200;

// ─── Sauvegarde (LONG et SHORT uniquement) ────────────────────
function savePrediction(pred, ind, symbol, regime) {
  if (!pred || pred.signal === 'NEUTRAL') return; // 🚫 Jamais de NEUTRAL

  const history = loadHistory();
  history.push({
    timestamp:    Date.now(),
    symbol,
    priceAtCall:  pred.entry_price || ind.currentPrice,
    signal:       pred.signal,
    target:       pred.target_price,
    stopLoss:     pred.stop_loss,
    confidence:   pred.confidence,
    timeToClose:  pred.time_to_close || null, // heures avant fermeture suggérée
    regime,
    resolved:     false,
    outcome:      null,
    entryNote:    pred.entry_note || ''
  });
  persistHistory(history.slice(-MAX_HISTORY));
}

// ─── Résolution des prédictions ouvertes ─────────────────────
function resolvePredictions(currentPrice, symbol, candles = []) {
  const history = loadHistory();

  history.forEach(p => {
    if (p.resolved || p.symbol !== symbol) return;
    // Bougies postérieures à la prédiction
    const recentCandles = candles.filter(c => c.time * 1000 > p.timestamp);
    const highs = recentCandles.map(c => c.high);
    const lows  = recentCandles.map(c => c.low);
    const maxHigh = highs.length ? Math.max(...highs) : currentPrice;
    const minLow  = lows.length  ? Math.min(...lows)  : currentPrice;

    // Fermeture automatique si time_to_close dépassé
    const hoursElapsed = (Date.now() - p.timestamp) / 3600000;
    const expired = p.timeToClose && hoursElapsed > p.timeToClose * 1.5;

    if (p.signal === 'LONG') {
      if (maxHigh >= p.target)        { p.outcome = 'WIN';     p.resolved = true; }
      else if (minLow <= p.stopLoss)  { p.outcome = 'LOSS';    p.resolved = true; }
      else if (expired)               { p.outcome = 'EXPIRÉ';  p.resolved = true; }
    } else if (p.signal === 'SHORT') {
      if (minLow <= p.target)         { p.outcome = 'WIN';     p.resolved = true; }
      else if (maxHigh >= p.stopLoss) { p.outcome = 'LOSS';    p.resolved = true; }
      else if (expired)               { p.outcome = 'EXPIRÉ';  p.resolved = true; }
    }
  });
  persistHistory(history);
}

// ─── Rendu du tableau historique ─────────────────────────────
function renderHistory() {
  const history = loadHistory();
  const tbody   = document.getElementById('history-tbody');
  const badge   = document.getElementById('winrate-badge');

  // Win rate (LONG/SHORT résolus, hors EXPIRÉ)
  const resolved = history.filter(p => p.resolved && (p.outcome === 'WIN' || p.outcome === 'LOSS'));
  const wins     = resolved.filter(p => p.outcome === 'WIN').length;
  const wr       = resolved.length ? Math.round(wins / resolved.length * 100) : null;

  badge.textContent = wr !== null
    ? `Win rate ${wr}% (${wins}/${resolved.length})`
    : 'Win rate —';
  badge.style.background = wr != null
    ? (wr >= 60 ? 'var(--green-bg)'  : wr >= 40 ? 'var(--orange-bg)' : 'var(--red-bg)')
    : '';
  badge.style.color = wr != null
    ? (wr >= 60 ? 'var(--green)'  : wr >= 40 ? 'var(--orange)' : 'var(--red)')
    : '';

  // Tableau (10 derniers trades LONG/SHORT uniquement)
  const recent = [...history]
    .filter(p => p.signal !== 'NEUTRAL')  // 🚫 Exclure NEUTRAL de l'affichage
    .reverse()
    .slice(0, 10);

  if (!recent.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-history">Aucune prédiction LONG/SHORT enregistrée</td></tr>';
    return;
  }

  tbody.innerHTML = recent.map(p => {
    const time  = new Date(p.timestamp).toLocaleTimeString('fr-FR',  { hour: '2-digit', minute: '2-digit' });
    const date  = new Date(p.timestamp).toLocaleDateString('fr-FR',  { month: 'short', day: 'numeric' });
    const sigStyle    = p.signal === 'LONG'  ? 'style="color:var(--green);font-weight:600"'
                      : p.signal === 'SHORT' ? 'style="color:var(--red);font-weight:600"' : '';

    const outcomeCls  = p.outcome === 'WIN'  ? 'outcome-win'
                      : p.outcome === 'LOSS' ? 'outcome-loss'
                      : p.outcome === 'EXPIRÉ' ? 'outcome-expired'
                      : 'outcome-pending';
    const outcomeLabel = p.outcome || (p.resolved ? '—' : 'Ouvert');

    // Temps restant pour les trades ouverts
    let timeInfo = p.timeToClose ? `${p.timeToClose}h` : '—';
    if (!p.resolved && p.timeToClose) {
      const hoursElapsed = (Date.now() - p.timestamp) / 3600000;
      const remaining = p.timeToClose - hoursElapsed;
      if (remaining > 0) {
        timeInfo = `Fermer dans ${remaining.toFixed(1)}h`;
      } else {
        timeInfo = `⚠ Fermer maintenant`;
      }
    }

    return `<tr>
      <td>${date} ${time}</td>
      <td>${p.symbol.replace('USDT','')}</td>
      <td ${sigStyle}>${p.signal}</td>
      <td>$${fmtPrice(p.priceAtCall)}</td>
      <td>$${fmtPrice(p.target)}</td>
      <td>$${fmtPrice(p.stopLoss)}</td>
      <td>${p.confidence}%</td>
      <td class="time-to-close-cell">${timeInfo}</td>
      <td><span class="${outcomeCls}">${outcomeLabel}</span></td>
    </tr>`;
  }).join('');
}

// ─── Helpers internes ─────────────────────────────────────────
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function persistHistory(arr) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
}

// Formatage prix (partagé avec ui.js via window scope)
function fmtPrice(n, dec = 2) {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
