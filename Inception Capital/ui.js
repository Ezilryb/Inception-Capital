// ============================================================
//  ui.js — Interface utilisateur
//  Statut · Loader · Dashboard · Indicateurs · Thème
// ============================================================

// ─── Utilitaires de formatage ─────────────────────────────────
function fmt(n, dec = 2) {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ─── Statut header ───────────────────────────────────────────
function setStatus(msg, type) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className   = `status status-${type}`;
}

// ─── Overlay de chargement ───────────────────────────────────
function showLoader(show) {
  document.getElementById('loader').style.display = show ? 'flex' : 'none';
}

// ─── Carte indicateur ────────────────────────────────────────
function setInd(id, value, cls) {
  const el = document.getElementById(`ind-${id}`);
  if (!el) return;
  el.textContent = value ?? '—';
  el.className   = `ind-value ${cls || ''}`;
}

// ─── Mise à jour du countdown ────────────────────────────────
function updateCountdown(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  document.getElementById('countdown').textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Dashboard complet ───────────────────────────────────────
function updateDashboard(ind, ind5m, pred, regime, confluence) {
  // ── Prix + tendance ──
  document.getElementById('price').textContent = `$${fmt(ind.currentPrice)}`;
  const tb = document.getElementById('trend-badge');
  tb.textContent = ind.trend;
  tb.className   = 'pill ' + (ind.trend === 'HAUSSIER' ? 'pill-green' : ind.trend === 'BAISSIER' ? 'pill-red' : 'pill-neutral');

  // ── Badge 5m ──
  const badge5m = document.getElementById('badge-5m');
  if (badge5m && ind5m) {
    badge5m.textContent = `5m: ${ind5m.trend}`;
    badge5m.className = 'pill pill-sm ' + (ind5m.trend === 'HAUSSIER' ? 'pill-green' : ind5m.trend === 'BAISSIER' ? 'pill-red' : 'pill-neutral');
    badge5m.style.display = 'inline-flex';
  } else if (badge5m) {
    badge5m.style.display = 'none';
  }

  // ── Méta prix ──
  document.getElementById('meta-support').textContent    = `$${fmt(ind.sr.support)}`;
  document.getElementById('meta-resistance').textContent = `$${fmt(ind.sr.resistance)}`;
  document.getElementById('meta-atr').textContent        = `$${fmt(ind.atr.value)} (${fmt(ind.atr.pct, 1)}%)`;
  document.getElementById('meta-fib').textContent        = `${ind.nearestFib.label} · $${fmt(ind.nearestFib.value)}`;

  // ── 5m indicateurs clés ──
  if (ind5m) {
    const rsi5mEl = document.getElementById('meta-rsi5m');
    if (rsi5mEl) rsi5mEl.textContent = `RSI 5m: ${fmt(ind5m.rsi.value, 1)} · ${ind5m.pattern}`;
  }

  // ── Régime ──
  const r  = regimeLabel(regime);
  const rt = document.getElementById('regime-tag');
  rt.textContent = r.label;
  rt.className   = `regime-tag ${r.cls} ml-auto`;
  const pr = document.getElementById('pred-regime');
  if (pr) pr.textContent = r.label;

  // ── Barre confluence ──
  if (confluence) {
    const bar = document.getElementById('confluence-bar');
    bar.style.width      = `${confluence.score}%`;
    bar.style.background = confluence.score > 65 ? 'var(--green)'
                         : confluence.score < 35 ? 'var(--red)'
                         : 'var(--orange)';
    document.getElementById('confluence-score').textContent = `${confluence.bull}↑ ${confluence.bear}↓`;
  }

  // ── Cartes indicateurs 30m ──
  setInd('rsi',    fmt(ind.rsi.value, 1),
    ind.rsi.overbought ? 'ind-red' : ind.rsi.oversold ? 'ind-green' : 'ind-text');

  setInd('srsi',   ind.stochRSI.value != null ? fmt(ind.stochRSI.value, 1) : '—',
    ind.stochRSI.overbought ? 'ind-red' : ind.stochRSI.oversold ? 'ind-green' : 'ind-text');

  setInd('macd',   fmt(ind.macd.histogram, 4),
    ind.macd.bullish ? 'ind-green' : 'ind-red');

  setInd('adx',    `${fmt(ind.adx.value, 1)} · ${ind.adx.label}`,
    ind.adx.strong ? 'ind-blue' : 'ind-text');

  setInd('ema20',  `$${fmt(ind.ema.ema20)}`,
    ind.currentPrice > ind.ema.ema20 ? 'ind-green' : 'ind-red');

  setInd('ema50',  `$${fmt(ind.ema.ema50)}`,
    ind.currentPrice > ind.ema.ema50 ? 'ind-green' : 'ind-red');

  setInd('ema200', `$${fmt(ind.ema.ema200)}`,
    ind.currentPrice > ind.ema.ema200 ? 'ind-green' : 'ind-red');

  setInd('bb-pct', `${fmt(ind.bb.percentB, 1)}%`,
    ind.bb.percentB > 80 ? 'ind-red' : ind.bb.percentB < 20 ? 'ind-green' : 'ind-text');

  setInd('bb-bw',  `${fmt(ind.bb.bandwidth, 1)}%`, 'ind-orange');

  setInd('obv',    ind.obv.trend,
    ind.obv.trend === 'HAUSSIER' ? 'ind-green' : ind.obv.trend === 'BAISSIER' ? 'ind-red' : 'ind-text');

  setInd('roc',    ind.roc.label,
    ind.roc.value > 0 ? 'ind-green' : ind.roc.value < 0 ? 'ind-red' : 'ind-text');

  setInd('volume', ind.volume.trend,
    ind.volume.ratio > 1.5 ? 'ind-green' : ind.volume.ratio < 0.5 ? 'ind-red' : 'ind-text');

  // ── Cartes 5m (si disponibles) ──
  if (ind5m) {
    setInd('5m-rsi',  fmt(ind5m.rsi.value, 1),
      ind5m.rsi.overbought ? 'ind-red' : ind5m.rsi.oversold ? 'ind-green' : 'ind-text');
    setInd('5m-macd', fmt(ind5m.macd.histogram, 4),
      ind5m.macd.bullish ? 'ind-green' : 'ind-red');
    setInd('5m-obv',  ind5m.obv.trend,
      ind5m.obv.trend === 'HAUSSIER' ? 'ind-green' : ind5m.obv.trend === 'BAISSIER' ? 'ind-red' : 'ind-text');
    setInd('5m-adx',  `${fmt(ind5m.adx.value, 1)} · ${ind5m.adx.label}`,
      ind5m.adx.strong ? 'ind-blue' : 'ind-text');
  }

  // ── Panneau IA ──
  if (pred) {
    const icons = { LONG: '↑', SHORT: '↓', NEUTRAL: '—' };
    const mark  = document.getElementById('signal-mark');
    mark.innerHTML = `<span style="font-size:1.2rem;">${icons[pred.signal] || '—'}</span>`;
    mark.className = `signal-mark ${
      pred.signal === 'LONG'  ? 'sig-long-mark'  :
      pred.signal === 'SHORT' ? 'sig-short-mark' : 'sig-neutral-mark'
    }`;

    const sigEl = document.getElementById('signal');
    sigEl.textContent = pred.signal;
    sigEl.className   = `signal-word ${
      pred.signal === 'LONG'  ? 'sig-long-txt'  :
      pred.signal === 'SHORT' ? 'sig-short-txt' : 'sig-neutral-txt'
    }`;

    document.getElementById('signal-sub').textContent = `${pred.confidence}% de confiance · ${pred.time_horizon || '—'}`;

    document.getElementById('confidence').textContent = `${pred.confidence}%`;
    const fill = document.getElementById('conf-bar-fill');
    fill.style.width  = `${pred.confidence}%`;
    fill.className    = `conf-fill ${
      pred.confidence >= 70 ? 'conf-fill-high' :
      pred.confidence >= 50 ? 'conf-fill-mid'  : 'conf-fill-low'
    }`;

    // Entrée
    const entryEl = document.getElementById('entry-price');
    if (entryEl) entryEl.textContent = `$${fmt(pred.entry_price || null)}`;

    document.getElementById('target').textContent   = `$${fmt(pred.target_price)}`;
    document.getElementById('stoploss').textContent = `$${fmt(pred.stop_loss)}`;
    document.getElementById('horizon').textContent  = pred.time_horizon || '—';
    document.getElementById('rr').textContent       = pred.risk_reward != null ? fmt(pred.risk_reward) : '—';

    // ── Fermer le trade dans X heures ──
    const ttcEl = document.getElementById('time-to-close');
    if (ttcEl) {
      if (pred.time_to_close != null) {
        ttcEl.textContent = `Dans ${pred.time_to_close}h max`;
        ttcEl.style.color = pred.time_to_close <= 2 ? 'var(--orange)' : 'var(--text1)';
      } else {
        ttcEl.textContent = '—';
      }
    }

    // ── Note d'entrée 5m ──
    const entryNoteEl = document.getElementById('entry-note');
    if (entryNoteEl) {
      entryNoteEl.textContent = pred.entry_note || '';
      entryNoteEl.style.display = pred.entry_note ? 'block' : 'none';
    }

    document.getElementById('reasoning').textContent = pred.reasoning || '';

    // Badge NEUTRAL : afficher avertissement, pas de trade à sauvegarder
    const neutralWarn = document.getElementById('neutral-warn');
    if (neutralWarn) {
      neutralWarn.style.display = pred.signal === 'NEUTRAL' ? 'flex' : 'none';
    }

    document.getElementById('no-pred-msg').style.display  = 'none';
    document.getElementById('pred-content').style.display = 'block';
  }

  document.getElementById('last-update').textContent = new Date().toLocaleTimeString('fr-FR');
  renderHistory();
}

// ─── Réinitialiser le panneau IA (changement de symbole) ─────
function resetAIPanel() {
  document.getElementById('no-pred-msg').style.display  = 'block';
  document.getElementById('pred-content').style.display = 'none';
  document.getElementById('signal').textContent         = 'Attente';
  document.getElementById('signal').className           = 'signal-word sig-neutral-txt';
  document.getElementById('signal-sub').textContent     = 'Aucun signal';
}

// ─── Gestion du thème clair / sombre ─────────────────────────
function initTheme() {
  const saved = localStorage.getItem('oracle_theme') || 'light';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('oracle_theme', theme);
}

function toggleTheme(state) {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next    = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
  if (state && state.chart) refreshChartTheme(state);
}
