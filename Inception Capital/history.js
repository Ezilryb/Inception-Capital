// ============================================================
//  history.js — Historique des prédictions
//  Persistance localStorage · Résolution automatique · Rendu
// ============================================================

const HISTORY_KEY = 'oracle_pred_history';
const MAX_HISTORY = 200;

// ─── Sauvegarde d'une prédiction ─────────────────────────────
function savePrediction(pred, ind, symbol, regime) {
  const history = loadHistory();
  history.push({
    timestamp:   Date.now(),
    symbol,
    priceAtCall: ind.currentPrice,
    signal:      pred.signal,
    target:      pred.target_price,
    stopLoss:    pred.stop_loss,
    confidence:  pred.confidence,
    regime,
    resolved:    false,
    outcome:     null
  });
  persistHistory(history.slice(-MAX_HISTORY));
}

// ─── Résolution des prédictions ouvertes ─────────────────────
function resolvePredictions(currentPrice, symbol) {
  const history = loadHistory();
  history.forEach(p => {
    if (p.resolved || p.symbol !== symbol) return;
    if (p.signal === 'LONG') {
      if (currentPrice >= p.target)   { p.outcome = 'WIN';  p.resolved = true; }
      if (currentPrice <= p.stopLoss) { p.outcome = 'LOSS'; p.resolved = true; }
    } else if (p.signal === 'SHORT') {
      if (currentPrice <= p.target)   { p.outcome = 'WIN';  p.resolved = true; }
      if (currentPrice >= p.stopLoss) { p.outcome = 'LOSS'; p.resolved = true; }
    }
  });
  persistHistory(history);
}

// ─── Rendu du tableau historique ─────────────────────────────
function renderHistory() {
  const history = loadHistory();
  const tbody   = document.getElementById('history-tbody');
  const badge   = document.getElementById('winrate-badge');

  // Win rate
  const resolved = history.filter(p => p.resolved);
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

  // Tableau (10 dernières)
  const recent = [...history].reverse().slice(0, 10);
  if (!recent.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-history">Aucune prédiction enregistrée</td></tr>';
    return;
  }

  tbody.innerHTML = recent.map(p => {
    const time  = new Date(p.timestamp).toLocaleTimeString('fr-FR',  { hour: '2-digit', minute: '2-digit' });
    const date  = new Date(p.timestamp).toLocaleDateString('fr-FR',  { month: 'short', day: 'numeric' });
    const sigStyle    = p.signal === 'LONG'  ? 'style="color:var(--green)"'
                      : p.signal === 'SHORT' ? 'style="color:var(--red)"' : '';
    const outcomeCls  = p.outcome === 'WIN'  ? 'outcome-win'
                      : p.outcome === 'LOSS' ? 'outcome-loss' : 'outcome-pending';
    const outcomeLabel = p.outcome || (p.resolved ? '—' : 'Ouvert');
    return `<tr>
      <td>${date} ${time}</td>
      <td>${p.symbol.replace('USDT','')}</td>
      <td ${sigStyle}>${p.signal}</td>
      <td>$${fmtPrice(p.priceAtCall)}</td>
      <td>$${fmtPrice(p.target)}</td>
      <td>$${fmtPrice(p.stopLoss)}</td>
      <td>${p.confidence}%</td>
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
