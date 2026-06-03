/**
 * portfolio-ui.js — Portfolio page rendering & interactions
 */

import { calcPortfolioTotal, calcAllocationPercent, formatDollars } from './data.js';
import { fetchPortfolioData } from './api.js';

// ── Palettes & constants ───────────────────────────────────────────────────────

const PALETTE = [
  '#0F1F4B','#1A3270','#3B82F6','#6366F1','#8B5CF6',
  '#EC4899','#EF4444','#F97316','#C9881A','#EAB308',
  '#10B981','#14B8A6','#A8AFBD',
];

const TYPES = ['equity', 'bond', 'intl', 'crypto', 'cash', 'other'];

const TYPE_LABELS = {
  equity: 'US Equities',
  bond:   'Bonds',
  intl:   'International',
  crypto: 'Crypto',
  cash:   'Cash & equiv.',
  other:  'Other',
};

const TYPE_COLORS = {
  equity: '#0F1F4B',
  bond:   '#C9881A',
  intl:   '#3B82F6',
  crypto: '#8B5CF6',
  cash:   '#A8AFBD',
  other:  '#6B7280',
};

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── State ──────────────────────────────────────────────────────────────────────

let holdings    = [];
let editingId   = null;
let chartMonths = 6;

// ── Storage ────────────────────────────────────────────────────────────────────

function loadHoldings() {
  try {
    const raw = localStorage.getItem('kenso_portfolio');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function saveHoldings(h) {
  localStorage.setItem('kenso_portfolio', JSON.stringify(h));
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

function addHolding(data) {
  holdings.push({ ...data, id: 'h' + Date.now() });
  saveHoldings(holdings);
}

function updateHolding(id, data) {
  holdings = holdings.map(h => h.id === id ? { ...h, ...data } : h);
  saveHoldings(holdings);
}

function deleteHolding(id) {
  holdings = holdings.filter(h => h.id !== id);
  saveHoldings(holdings);
}

// ── Init ───────────────────────────────────────────────────────────────────────

async function init() {
  const stored = loadHoldings();
  if (stored && stored.length > 0) {
    holdings = stored;
  } else {
    const { holdings: api } = await fetchPortfolioData();
    const defaultTypes = ['equity', 'bond', 'intl', 'equity'];
    holdings = api.map((h, i) => ({
      id:            'h' + (Date.now() + i),
      ticker:        h.ticker,
      name:          h.name,
      value:         h.value,
      costBasis:     Math.round(h.value * 0.87),
      changePercent: h.changePercent,
      color:         h.color,
      type:          defaultTypes[i] ?? 'equity',
    }));
    saveHoldings(holdings);
  }
  refresh();
}

// ── Refresh ────────────────────────────────────────────────────────────────────

function refresh() {
  const total      = calcPortfolioTotal(holdings);
  const dayChange  = holdings.reduce((s, h) => s + h.value * (h.changePercent / 100), 0);
  const totalCost  = holdings.reduce((s, h) => s + (h.costBasis || h.value), 0);
  const totalReturn    = total - totalCost;
  const totalReturnPct = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;

  renderKPIs(total, dayChange, totalReturn, totalReturnPct);
  renderHoldings(total);
  renderAllocation(total);
  renderInsight(total);
  renderChart(chartMonths);
}

// ── KPI cards ──────────────────────────────────────────────────────────────────

function renderKPIs(total, dayChange, totalReturn, totalReturnPct) {
  setText('kpi-total', formatDollars(total));
  const n = holdings.length;
  setText('kpi-holdings-count', `Across ${n} holding${n !== 1 ? 's' : ''}`);

  const dayEl = document.getElementById('kpi-day-change');
  if (dayEl) {
    const up = dayChange >= 0;
    dayEl.textContent = (up ? '+' : '') + formatDollars(Math.round(Math.abs(dayChange)));
    if (!up) dayEl.textContent = '−' + formatDollars(Math.round(Math.abs(dayChange)));
    dayEl.className = 'summary-card-val ' + (up ? 'green' : 'red');
  }

  const dayPctEl = document.getElementById('kpi-day-pct');
  if (dayPctEl) {
    const base = total - dayChange;
    const pct  = base > 0 ? (dayChange / base) * 100 : 0;
    dayPctEl.textContent = (pct >= 0 ? '▲ +' : '▼ ') + Math.abs(pct).toFixed(2) + '% today';
    dayPctEl.className   = 'summary-card-delta ' + (pct >= 0 ? 'up' : 'dn');
  }

  const retEl = document.getElementById('kpi-return');
  if (retEl) {
    const up = totalReturn >= 0;
    retEl.textContent = (up ? '+' : '−') + formatDollars(Math.round(Math.abs(totalReturn)));
    retEl.className   = 'summary-card-val ' + (up ? 'green' : 'red');
  }

  const retPctEl = document.getElementById('kpi-return-pct');
  if (retPctEl) {
    const up = totalReturnPct >= 0;
    retPctEl.textContent = (up ? '▲ +' : '▼ ') + Math.abs(totalReturnPct).toFixed(1) + '% all time';
    retPctEl.className   = 'summary-card-delta ' + (up ? 'up' : 'dn');
  }
}

// ── Holdings table ─────────────────────────────────────────────────────────────

function renderHoldings(total) {
  const container = document.getElementById('holdings-rows');
  if (!container) return;

  if (holdings.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📈</div>
        <div class="empty-state-text">No holdings yet.<br>Add one to start tracking your portfolio.</div>
      </div>`;
    return;
  }

  const sorted   = [...holdings].sort((a, b) => b.value - a.value);
  const maxValue = sorted[0].value;

  let html = '';
  sorted.forEach(h => {
    const alloc    = calcAllocationPercent(h.value, total);
    const barWidth = calcAllocationPercent(h.value, maxValue);
    const up       = h.changePercent >= 0;
    const chgLabel = (up ? '▲ +' : '▼ ') + Math.abs(h.changePercent).toFixed(2) + '%';
    const gain     = h.value - (h.costBasis || h.value);
    const gainUp   = gain >= 0;
    const gainStr  = (gainUp ? '+' : '−') + formatDollars(Math.round(Math.abs(gain)));

    html += `
      <div class="port-row">
        <div class="port-dot" style="background:${h.color}"></div>
        <div class="port-ticker" style="background:${h.color}18;color:${h.color};">${escHtml(h.ticker)}</div>
        <div class="port-name-wrap">
          <div class="port-name">${escHtml(h.name)}</div>
          <div class="port-type-label">${escHtml(TYPE_LABELS[h.type] || h.type)}</div>
        </div>
        <div class="port-bar-track">
          <div class="port-bar-fill" style="width:${barWidth}%;background:${h.color};"></div>
        </div>
        <div class="port-alloc">${alloc}%</div>
        <div class="port-value">${formatDollars(h.value)}</div>
        <div class="port-chg ${up ? 'up' : 'dn'}">${chgLabel}</div>
        <div class="port-gain ${gainUp ? 'up' : 'dn'}">${gainStr}</div>
        <button class="cat-menu-btn" data-id="${h.id}" title="Edit holding">⋯</button>
      </div>`;
  });

  container.innerHTML = html;

  container.querySelectorAll('.cat-menu-btn').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.id));
  });
}

// ── Allocation donut ───────────────────────────────────────────────────────────

function renderAllocation(total) {
  const container = document.getElementById('allocation-chart');
  if (!container) return;

  // Group by type
  const groups = {};
  holdings.forEach(h => {
    const t = h.type || 'other';
    groups[t] = (groups[t] || 0) + h.value;
  });

  const entries = Object.entries(groups)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No holdings.</div></div>';
    return;
  }

  // SVG donut using stroke-dasharray technique
  const r = 54, cx = 72, cy = 72, sw = 20;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const segs = entries.map(([type, value]) => {
    const dash = (value / total) * circ;
    const seg  = { type, value, dash, offset };
    offset    += dash;
    return seg;
  });

  const svgSegs = segs.map(s => `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="${TYPE_COLORS[s.type] || '#A8AFBD'}"
      stroke-width="${sw}"
      stroke-dasharray="${s.dash.toFixed(2)} ${circ.toFixed(2)}"
      stroke-dashoffset="${(circ / 4 - s.offset).toFixed(2)}"
    />`).join('');

  const topType  = entries[0][0];
  const topPct   = Math.round((entries[0][1] / total) * 100);
  const topLabel = TYPE_LABELS[topType] || topType;

  const svg = `
    <svg width="144" height="144" viewBox="0 0 144 144">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${sw}"/>
      ${svgSegs}
      <text x="${cx}" y="${cy - 5}" text-anchor="middle" font-size="18" font-weight="600"
        font-family="Sora,sans-serif" fill="var(--ink)">${topPct}%</text>
      <text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="9"
        font-family="Sora,sans-serif" fill="var(--ink-4)">${escHtml(topLabel)}</text>
    </svg>`;

  const legendRows = entries.map(([type, value]) => {
    const pct = Math.round((value / total) * 100);
    return `
      <div class="leg-row">
        <div class="leg-dot" style="background:${TYPE_COLORS[type] || '#A8AFBD'}"></div>
        <div class="leg-name">${escHtml(TYPE_LABELS[type] || type)}</div>
        <div class="leg-val">${formatDollars(value)}</div>
        <div class="leg-pct">${pct}%</div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="donut-row" style="align-items:center;gap:16px;">
      ${svg}
      <div class="legend">${legendRows}</div>
    </div>`;
}

// ── Insight ────────────────────────────────────────────────────────────────────

function renderInsight(total) {
  const pill = document.getElementById('port-insight');
  if (!pill) return;

  if (holdings.length === 0) {
    pill.innerHTML = `<div class="insight-icon">💡</div><div class="insight-text"><strong>Kenso insight:</strong> Add your first holding to see personalised insights about your portfolio.</div>`;
    return;
  }

  // Flag concentration risk
  const topHolding = [...holdings].sort((a, b) => b.value - a.value)[0];
  const topPct     = calcAllocationPercent(topHolding.value, total);
  if (topPct > 40) {
    pill.innerHTML = `<div class="insight-icon">⚠️</div><div class="insight-text"><strong>Concentration risk:</strong> ${escHtml(topHolding.ticker)} makes up ${topPct}% of your portfolio — consider diversifying to reduce single-asset risk.</div>`;
    pill.style.background  = '#FEF2F2';
    pill.style.borderColor = 'rgba(185,28,28,0.2)';
    return;
  }

  // Check bond allocation
  const bondValue = holdings.filter(h => h.type === 'bond').reduce((s, h) => s + h.value, 0);
  const bondPct   = Math.round((bondValue / total) * 100);
  if (bondPct < 10 && holdings.length > 1) {
    pill.innerHTML = `<div class="insight-icon">💡</div><div class="insight-text"><strong>Kenso insight:</strong> Your portfolio has ${bondPct}% in bonds — a small bond allocation can reduce volatility without significantly impacting long-term returns.</div>`;
    pill.style.background  = '';
    pill.style.borderColor = '';
    return;
  }

  // Default: show best performer
  const best = [...holdings].sort((a, b) => b.changePercent - a.changePercent)[0];
  const up   = best.changePercent >= 0;
  pill.innerHTML = `<div class="insight-icon">💡</div><div class="insight-text"><strong>Today's top mover:</strong> ${escHtml(best.ticker)} is ${up ? 'up' : 'down'} ${Math.abs(best.changePercent).toFixed(2)}% — ${up ? 'contributing ' + formatDollars(Math.round(best.value * best.changePercent / 100)) + ' to today\'s gain' : 'the biggest drag on today\'s performance'}.</div>`;
  pill.style.background  = '';
  pill.style.borderColor = '';
}

// ── Performance chart ──────────────────────────────────────────────────────────

function getHistory(months) {
  const total = calcPortfolioTotal(holdings);
  if (total === 0) return [];

  const now    = new Date();
  const result = [];

  for (let i = months - 1; i >= 0; i--) {
    const d          = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label      = MONTH_SHORT[d.getMonth()] + (months > 12 ? ` '${String(d.getFullYear()).slice(2)}` : '');
    const annReturn  = 0.12;
    const factor     = Math.pow(1 + annReturn / 12, -i);
    // Deterministic noise — no Math.random() so chart is stable
    const noise      = Math.sin(i * 2.7) * 0.022 + Math.sin(i * 5.1) * 0.009;
    result.push({ label, value: Math.round(total * factor * (1 + noise)) });
  }

  // Pin last point to exact current total
  result[result.length - 1].value = total;
  return result;
}

function niceMax(val) {
  if (val <= 0) return 1000;
  const mag = Math.pow(10, Math.floor(Math.log10(val)));
  return Math.ceil(val / mag) * mag;
}

function renderChart(months) {
  const container = document.getElementById('port-chart');
  if (!container) return;

  const data = getHistory(months);
  if (data.length === 0) return;

  const W = 700, H = 180;
  const pad = { top: 16, right: 20, bottom: 38, left: 68 };
  const cW  = W - pad.left - pad.right;
  const cH  = H - pad.top  - pad.bottom;

  const values = data.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const spread = maxVal - minVal || 1;
  const yMin   = Math.max(0, minVal - spread * 0.12);
  const yMax   = maxVal + spread * 0.06;

  const xOf = i => (data.length === 1) ? cW / 2 : (i / (data.length - 1)) * cW;
  const yOf = v => cH - ((v - yMin) / (yMax - yMin)) * cH;

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(d.value).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${xOf(data.length - 1).toFixed(1)},${cH} L${xOf(0).toFixed(1)},${cH} Z`;

  // Y ticks
  const tickValues = [0, 0.25, 0.5, 0.75, 1].map(f => yMin + (yMax - yMin) * f);
  const yGrid = tickValues.map(v => {
    const y     = yOf(v).toFixed(1);
    const label = v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `$${Math.round(v)}`;
    return `
      <line x1="0" y1="${y}" x2="${cW}" y2="${y}" stroke="rgba(11,14,26,0.05)" stroke-width="1"/>
      <text x="-8" y="${(parseFloat(y) + 4).toFixed(1)}" font-size="10" fill="#A8AFBD" text-anchor="end" font-family="Sora,sans-serif">${label}</text>`;
  }).join('');

  // X labels
  const maxLabels = Math.floor(cW / 56);
  const skip      = Math.ceil(data.length / maxLabels);
  const xLabels   = data.map((d, i) =>
    (i % skip === 0 || i === data.length - 1)
      ? `<text x="${xOf(i).toFixed(1)}" y="${cH + 24}" font-size="10" fill="#A8AFBD" text-anchor="middle" font-family="Sora,sans-serif">${d.label}</text>`
      : ''
  ).join('');

  const lastX = xOf(data.length - 1).toFixed(1);
  const lastY = yOf(data[data.length - 1].value).toFixed(1);

  const svg = `
    <svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1A6B3C" stop-opacity="0.13"/>
          <stop offset="100%" stop-color="#1A6B3C" stop-opacity="0.01"/>
        </linearGradient>
        <clipPath id="portClip"><rect x="0" y="0" width="${cW}" height="${cH}"/></clipPath>
      </defs>
      <g transform="translate(${pad.left},${pad.top})">
        ${yGrid}
        <g clip-path="url(#portClip)">
          <path d="${areaPath}" fill="url(#portGrad)"/>
          <path d="${linePath}" fill="none" stroke="#1A6B3C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="${lastX}" cy="${lastY}" r="4" fill="#1A6B3C" stroke="white" stroke-width="2"/>
        </g>
        ${xLabels}
      </g>
    </svg>`;

  container.innerHTML = svg;
}

// ── Modal ──────────────────────────────────────────────────────────────────────

function openModal(id = null) {
  editingId = id;
  const backdrop = document.getElementById('modal-backdrop');
  const title    = document.getElementById('modal-title');

  let selectedColor = PALETTE[0];
  let selectedType  = 'equity';

  if (id) {
    const h = holdings.find(x => x.id === id);
    if (!h) return;
    title.textContent                                  = 'Edit holding';
    document.getElementById('modal-ticker').value     = h.ticker;
    document.getElementById('modal-name').value       = h.name;
    document.getElementById('modal-value').value      = h.value;
    document.getElementById('modal-cost').value       = h.costBasis ?? '';
    selectedColor                                      = h.color;
    selectedType                                       = h.type || 'equity';
    document.getElementById('modal-delete').style.display = 'inline-flex';
  } else {
    title.textContent                                  = 'Add holding';
    document.getElementById('modal-ticker').value     = '';
    document.getElementById('modal-name').value       = '';
    document.getElementById('modal-value').value      = '';
    document.getElementById('modal-cost').value       = '';
    document.getElementById('modal-delete').style.display = 'none';
  }

  renderTypeTabs(selectedType, t => { selectedType = t; });

  const swatches = document.getElementById('modal-swatches');
  swatches.innerHTML = PALETTE.map(c => `
    <div class="color-swatch${c === selectedColor ? ' selected' : ''}" style="background:${c};" data-color="${c}"></div>
  `).join('');
  swatches.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      swatches.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      selectedColor = sw.dataset.color;
    });
  });

  document.getElementById('modal-save').onclick = () => {
    const ticker    = document.getElementById('modal-ticker').value.trim().toUpperCase();
    const name      = document.getElementById('modal-name').value.trim();
    const value     = parseFloat(document.getElementById('modal-value').value) || 0;
    const costBasis = parseFloat(document.getElementById('modal-cost').value) || value;
    if (!ticker) { document.getElementById('modal-ticker').focus(); return; }
    if (!name)   { document.getElementById('modal-name').focus();   return; }

    // Reuse existing changePercent if same ticker, else derive a stable sim value
    const existing      = holdings.find(h => h.ticker === ticker && h.id !== id);
    const changePercent = existing?.changePercent
      ?? (Math.sin(ticker.charCodeAt(0) * 1.7 + ticker.length) * 1.8);

    if (editingId) {
      updateHolding(editingId, { ticker, name, value, costBasis, color: selectedColor, type: selectedType });
    } else {
      addHolding({ ticker, name, value, costBasis, changePercent, color: selectedColor, type: selectedType });
    }
    closeModal(); refresh();
  };

  backdrop.classList.add('open');
  setTimeout(() => document.getElementById('modal-ticker')?.focus(), 60);
}

function renderTypeTabs(selected, onSelect) {
  const container = document.getElementById('modal-type-tabs');
  if (!container) return;
  container.innerHTML = TYPES.map(t =>
    `<button class="section-tab${t === selected ? ' active' : ''}" data-type="${t}">${TYPE_LABELS[t]}</button>`
  ).join('');
  container.querySelectorAll('.section-tab').forEach(tab => {
    tab.onclick = () => {
      container.querySelectorAll('.section-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      onSelect(tab.dataset.type);
    };
  });
}

function closeModal() {
  document.getElementById('modal-backdrop').classList.remove('open');
  editingId = null;
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function escHtml(str)     { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Bootstrap ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('add-holding-btn')?.addEventListener('click',   () => openModal(null));
  document.getElementById('add-holding-btn-2')?.addEventListener('click', () => openModal(null));

  document.getElementById('modal-backdrop')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
  document.getElementById('modal-delete')?.addEventListener('click', () => {
    if (!editingId) return;
    if (confirm('Delete this holding?')) { deleteHolding(editingId); closeModal(); refresh(); }
  });

  document.getElementById('modal-ticker')?.addEventListener('input', e => {
    e.target.value = e.target.value.toUpperCase();
  });

  document.getElementById('port-chart-tabs')?.addEventListener('click', e => {
    const tab = e.target.closest('.chart-tab');
    if (!tab) return;
    document.querySelectorAll('#port-chart-tabs .chart-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    chartMonths = parseInt(tab.dataset.months);
    renderChart(chartMonths);
  });

  init();
});
