/**
 * budget-ui.js — Budget page rendering & interactions
 */

import {
  loadBudget, saveBudget, addCategory, updateCategory,
  deleteCategory, getBudgetSummary, loadCustomSections, saveCustomSections,
} from './budget-data.js';
import { formatDollars, calcBarWidth, calcTotalSpent } from './data.js';

// ── State ──────────────────────────────────────────────────────────────────────

let currentYear  = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let editingId    = null;
let chartMonths       = 6;
const collapsedSections = new Set(['needs', 'wants', 'savings']); // all closed by default

// ── Month helpers ──────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function monthLabel(year, month) { return `${MONTH_NAMES[month - 1]} ${year}`; }

function stepMonth(delta) {
  currentMonth += delta;
  if (currentMonth > 12) { currentMonth = 1;  currentYear++; }
  if (currentMonth < 1)  { currentMonth = 12; currentYear--; }
  refresh();
}

// ── Sections ───────────────────────────────────────────────────────────────────

const SECTIONS = [
  { key: 'needs', label: 'Needs', target: 50, cls: 'cat-section-needs' },
  { key: 'wants', label: 'Wants', target: 30, cls: 'cat-section-wants' },
];

// ── Section color palette (for custom sections) ────────────────────────────────

const SECTION_COLORS = ['#1A6B3C', '#8B5CF6', '#EC4899', '#10B981', '#F97316'];

// ── Color palette ──────────────────────────────────────────────────────────────

const PALETTE = [
  '#0F1F4B','#1A3270','#3B82F6','#6366F1','#8B5CF6',
  '#EC4899','#EF4444','#F97316','#C9881A','#EAB308',
  '#10B981','#14B8A6','#A8AFBD',
];

// ── Refresh ────────────────────────────────────────────────────────────────────

function refresh() {
  const data    = loadBudget(currentYear, currentMonth);
  const summary = getBudgetSummary(data);
  renderMonthLabel();
  renderSummaryCards(summary);
  renderCategories(summary);
  renderInsight(summary);
  renderBudgetOverview(summary);
  renderChart(chartMonths);
  const addBtn = document.getElementById('add-section-btn');
  if (addBtn) {
    const atLimit = SECTIONS.length + loadCustomSections().length >= 5;
    addBtn.style.display = atLimit ? 'none' : '';
  }
}

// ── Month label ────────────────────────────────────────────────────────────────

function renderMonthLabel() {
  const el = document.getElementById('month-label');
  if (el) el.textContent = monthLabel(currentYear, currentMonth);
}

// ── Summary KPI cards ──────────────────────────────────────────────────────────

function renderSummaryCards({ income, totalSpent, remaining }) {
  setText('kpi-income',    formatDollars(income));
  setText('kpi-spent',     formatDollars(totalSpent));
  setText('kpi-remaining', formatDollars(remaining));

  const remEl = document.getElementById('kpi-remaining');
  if (remEl) remEl.className = 'summary-card-val ' + (remaining >= 0 ? 'green' : 'red');
}

// ── Categories ─────────────────────────────────────────────────────────────────

function renderCategories({ categories, income }) {
  const container = document.getElementById('category-rows');
  if (!container) return;

  if (categories.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📂</div>
        <div class="empty-state-text">No categories yet.<br>Add one to start tracking.</div>
      </div>`;
    return;
  }

  const maxAmount = Math.max(...categories.map(c => c.amount), 1);
  let html = '';

  const knownKeys    = SECTIONS.map(s => s.key);
  const storedCustom = loadCustomSections(); // [{ name, color }]
  const usedCustom   = categories.map(c => c.section || 'needs').filter(k => !knownKeys.includes(k));
  // merge stored + any orphaned keys already on categories
  const customMap    = new Map(storedCustom.map(s => [s.name, s.color]));
  usedCustom.forEach(k => { if (!customMap.has(k)) customMap.set(k, '#A8AFBD'); });
  const allSections  = [
    ...SECTIONS,
    ...[...customMap.entries()].map(([name, color]) => ({
      key: name, label: name, target: null, cls: 'cat-section-custom', color,
    })),
  ];

  allSections.forEach(sec => {
    const cats      = categories.filter(c => (c.section || 'needs') === sec.key);
    const isCustom  = sec.target === null;
    if (cats.length === 0 && !isCustom) return;

    const secTotal  = cats.reduce((s, c) => s + c.amount, 0);
    const secPct    = income > 0 ? Math.round((secTotal / income) * 100) : 0;
    const isOpen    = !collapsedSections.has(sec.key);
    const targetBit = sec.target != null ? ` <span style="color:var(--ink-4);">(target ${sec.target}%)</span>` : '';

    html += `
      <div class="cat-section-header ${sec.cls} section-toggle" data-section="${sec.key}" style="cursor:pointer;user-select:none;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="section-chevron${isOpen ? ' open' : ''}">›</span>
          <span class="cat-section-title"${sec.color ? ` style="color:${sec.color}"` : ''}>${escHtml(sec.label)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="cat-section-meta">${formatDollars(secTotal)} &middot; ${secPct}%${targetBit}</span>
          <button class="section-delete-btn" data-section="${escHtml(sec.key)}" title="Delete section">×</button>
        </div>
      </div>
      <div class="section-body${isOpen ? ' open' : ''}" data-section-body="${sec.key}">`;

    if (cats.length === 0) {
      html += `<div class="cat-section-empty">No categories yet — <button class="cat-section-empty-add" data-section="${escHtml(sec.key)}">add one</button></div>`;
    }

    cats.forEach(cat => {
      const barWidth   = calcBarWidth(cat.amount, maxAmount);
      const pct        = income > 0 ? Math.round((cat.amount / income) * 100) : 0;
      const overBudget = cat.budget > 0 && cat.amount > cat.budget;
      const budgetHint = cat.budget > 0
        ? `<span class="cat-budget-hint">${formatDollars(cat.budget)} limit</span>` : '';
      html += `
        <div class="cat-row${overBudget ? ' over' : ''}">
          <div class="cat-dot" style="background:${cat.color}"></div>
          <div class="cat-name-wrap">
            <div class="cat-name">${escHtml(cat.name)}</div>
            ${budgetHint}
          </div>
          <div class="cat-bar-track">
            <div class="cat-bar-fill" style="width:${barWidth}%;background:${overBudget ? '#B91C1C' : cat.color};"></div>
          </div>
          <div class="cat-amount editable-amount" data-id="${cat.id}" data-amount="${cat.amount}" title="Click to edit">${formatDollars(cat.amount)}</div>
          <div class="cat-pct">${pct}%</div>
          <button class="cat-menu-btn" data-id="${cat.id}" title="Edit category">⋯</button>
        </div>`;
    });

    html += `</div>`; // close section-body
  });

  container.innerHTML = html;

  // Section accordion toggles
  container.querySelectorAll('.section-toggle').forEach(header => {
    header.addEventListener('click', () => {
      const key    = header.dataset.section;
      const body   = container.querySelector(`[data-section-body="${key}"]`);
      const chev   = header.querySelector('.section-chevron');
      if (collapsedSections.has(key)) {
        collapsedSections.delete(key);
        body.classList.add('open');
        chev.classList.add('open');
      } else {
        collapsedSections.add(key);
        body.classList.remove('open');
        chev.classList.remove('open');
      }
    });
  });

  container.querySelectorAll('.section-delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const key  = btn.dataset.section;
      const data = loadBudget(currentYear, currentMonth);
      const cats = data.categories.filter(c => (c.section || 'needs') === key);
      const msg  = cats.length > 0
        ? `Delete "${key}" and its ${cats.length} categor${cats.length === 1 ? 'y' : 'ies'}?`
        : `Delete section "${key}"?`;
      if (!confirm(msg)) return;
      // Remove categories in this section
      data.categories = data.categories.filter(c => (c.section || 'needs') !== key);
      saveBudget(currentYear, currentMonth, data);
      // Remove from custom sections list if it's a custom one
      const customs = loadCustomSections().filter(s => s.name !== key);
      saveCustomSections(customs);
      refresh();
    });
  });

  container.querySelectorAll('.cat-section-empty-add').forEach(btn => {
    btn.addEventListener('click', () => openModal(null, btn.dataset.section));
  });

  container.querySelectorAll('.cat-menu-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openModal(btn.dataset.id); });
  });

  container.querySelectorAll('.editable-amount').forEach(el => {
    el.addEventListener('click', () => startInlineEdit(el));
  });
}

// ── Insight pill ───────────────────────────────────────────────────────────────

function renderInsight({ categories, income, totalSpent }) {
  const pill = document.getElementById('budget-insight');
  if (!pill) return;

  const overCats = categories.filter(c => c.budget > 0 && c.amount > c.budget);
  if (overCats.length > 0) {
    const worst = overCats.reduce((a, b) => (a.amount - a.budget) > (b.amount - b.budget) ? a : b);
    const over  = worst.amount - worst.budget;
    pill.innerHTML = `
      <div class="insight-icon">⚠️</div>
      <div class="insight-text"><strong>Over budget:</strong> ${escHtml(worst.name)} is ${formatDollars(over)} over your ${formatDollars(worst.budget)} limit this month.</div>`;
    pill.style.background  = '#FEF2F2';
    pill.style.borderColor = 'rgba(185,28,28,0.2)';
    return;
  }

  if (categories.length > 0 && income > 0) {
    const top = [...categories].sort((a, b) => b.amount - a.amount)[0];
    const pct = totalSpent > 0 ? Math.round((top.amount / totalSpent) * 100) : 0;
    pill.innerHTML = `
      <div class="insight-icon">💡</div>
      <div class="insight-text"><strong>Kenso insight:</strong> ${escHtml(top.name)} is your largest spend at ${formatDollars(top.amount)} (${pct}% of total spending).</div>`;
    pill.style.background  = '';
    pill.style.borderColor = '';
  }
}

// ── Budget overview panel ──────────────────────────────────────────────────────

function renderBudgetOverview({ categories, totalSpent }) {
  const body = document.getElementById('budget-overview-body');
  if (!body) return;

  const withBudget = categories.filter(c => c.budget > 0);
  if (withBudget.length === 0) {
    body.innerHTML = `<p style="font-size:13px;color:var(--ink-3);line-height:1.6;">Add budget limits to categories when editing them to see how your actual spending compares.</p>`;
    return;
  }

  const totalBudget = withBudget.reduce((s, c) => s + c.budget, 0);
  const totalPct    = totalBudget > 0 ? Math.min(Math.round((totalSpent / totalBudget) * 100), 100) : 0;
  const totalOver   = totalSpent > totalBudget;

  const rows = withBudget.map(cat => {
    const pct    = cat.budget > 0 ? Math.round((cat.amount / cat.budget) * 100) : 0;
    const barPct = Math.min(pct, 100);
    const over   = cat.amount > cat.budget;
    const delta  = over
      ? `<span style="color:#B91C1C;font-weight:600;">+${formatDollars(cat.amount - cat.budget)} over</span>`
      : `<span style="color:#1A6B3C;font-weight:600;">${formatDollars(cat.budget - cat.amount)} left</span>`;
    return `
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-size:12px;color:var(--ink-2);display:flex;align-items:center;gap:6px;">
            <span style="width:8px;height:8px;border-radius:50%;background:${cat.color};display:inline-block;flex-shrink:0;"></span>
            ${escHtml(cat.name)}
          </span>${delta}
        </div>
        <div class="progress-bar-track" style="height:5px;margin:0 0 3px;">
          <div class="progress-bar-fill" style="width:${barPct}%;background:${over ? '#B91C1C' : cat.color};height:5px;"></div>
        </div>
        <div style="font-size:11px;color:var(--ink-4);">${formatDollars(cat.amount)} of ${formatDollars(cat.budget)} — ${pct}% used</div>
      </div>`;
  }).join('');

  body.innerHTML = `
    <div style="margin-bottom:18px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <span style="font-size:12px;font-weight:600;color:var(--ink-3);text-transform:uppercase;letter-spacing:.05em;">Total</span>
        <span style="font-size:12px;font-weight:600;color:${totalOver ? '#B91C1C' : 'var(--ink-2)'};">${formatDollars(totalSpent)} / ${formatDollars(totalBudget)}</span>
      </div>
      <div class="progress-bar-track" style="margin:0 0 4px;">
        <div class="progress-bar-fill" style="width:${totalPct}%;background:${totalOver ? '#B91C1C' : 'var(--navy)'};"></div>
      </div>
      <div style="font-size:11px;color:var(--ink-4);">${totalPct}% of total budget used</div>
    </div>
    <div style="border-top:1px solid var(--border-soft);padding-top:14px;">${rows}</div>`;
}

// ── Spending chart ─────────────────────────────────────────────────────────────

function getChartData(endYear, endMonth, count) {
  const months = [];
  let y = endYear, m = endMonth;
  for (let i = 0; i < count; i++) {
    const data = loadBudget(y, m);
    const cats = data.categories;
    months.unshift({
      label:   MONTH_SHORT[m - 1] + (count > 12 ? ` '${String(y).slice(2)}` : ''),
      total:   calcTotalSpent(cats),
      income:  data.income || 0,
      needs:   cats.filter(c => (c.section || 'needs') === 'needs').reduce((s, c) => s + c.amount, 0),
      wants:   cats.filter(c => c.section === 'wants').reduce((s, c) => s + c.amount, 0),
      savings: cats.filter(c => c.section === 'savings').reduce((s, c) => s + c.amount, 0),
    });
    m--;
    if (m < 1) { m = 12; y--; }
  }
  return months;
}

function niceMax(val) {
  if (val <= 0) return 1000;
  const mag = Math.pow(10, Math.floor(Math.log10(val)));
  return Math.ceil(val / mag) * mag;
}

function renderChart(count) {
  const container = document.getElementById('spending-chart');
  if (!container) return;

  const months = getChartData(currentYear, currentMonth, count);

  // Chart dimensions (fixed viewBox — SVG scales to container)
  const W = 700, H = 200;
  const pad = { top: 16, right: 20, bottom: 38, left: 58 };
  const cW = W - pad.left - pad.right;  // chart area width
  const cH = H - pad.top  - pad.bottom; // chart area height

  const maxVal = niceMax(Math.max(...months.map(m => Math.max(m.total, m.income)), 100));
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxVal * f));

  const xOf = i => (months.length === 1) ? cW / 2 : (i / (months.length - 1)) * cW;
  const yOf = v => cH - (v / maxVal) * cH;

  // Build SVG paths
  function makePath(key) {
    return months.map((m, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(m[key]).toFixed(1)}`).join(' ');
  }
  const totalPath  = makePath('total');
  const incomePath = makePath('income');

  // Area fill under total line
  const firstX = xOf(0).toFixed(1), lastX = xOf(months.length - 1).toFixed(1);
  const areaPath = `${totalPath} L${lastX},${cH} L${firstX},${cH} Z`;

  // X-axis labels — skip every Nth to avoid crowding
  const maxLabels = Math.floor(cW / 48);
  const skip = Math.ceil(months.length / maxLabels);
  const xLabels = months.map((m, i) =>
    (i % skip === 0 || i === months.length - 1)
      ? `<text x="${xOf(i).toFixed(1)}" y="${cH + 24}" font-size="10" fill="#A8AFBD" text-anchor="middle" font-family="Sora,sans-serif">${m.label}</text>`
      : ''
  ).join('');

  // Y-axis labels & grid
  const yGrid = yTicks.map(v => {
    const y = yOf(v).toFixed(1);
    const label = v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `$${v}`;
    return `
      <line x1="0" y1="${y}" x2="${cW}" y2="${y}" stroke="rgba(11,14,26,0.05)" stroke-width="1"/>
      <text x="-8" y="${(parseFloat(y) + 4).toFixed(1)}" font-size="10" fill="#A8AFBD" text-anchor="end" font-family="Sora,sans-serif">${label}</text>`;
  }).join('');

  // Dots on total line
  const dots = months.length <= 24
    ? months.map((m, i) => `<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(m.total).toFixed(1)}" r="3.5" fill="#E8183A" stroke="white" stroke-width="2"/>`).join('')
    : '';

  const svg = `
    <svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#E8183A" stop-opacity="0.12"/>
          <stop offset="100%" stop-color="#E8183A" stop-opacity="0.01"/>
        </linearGradient>
        <clipPath id="chartClip">
          <rect x="0" y="0" width="${cW}" height="${cH}"/>
        </clipPath>
      </defs>
      <g transform="translate(${pad.left},${pad.top})">
        ${yGrid}
        <g clip-path="url(#chartClip)">
          <path d="${areaPath}" fill="url(#chartArea)"/>
          <path d="${incomePath}"  fill="none" stroke="#4DFFA3" stroke-width="3.5" stroke-dasharray="8,5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="${totalPath}"   fill="none" stroke="#E8183A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          ${dots}
        </g>
        ${xLabels}
      </g>
    </svg>`;

  const legend = `
    <div class="chart-legend">
      <span class="chart-legend-item"><span class="chart-legend-line" style="background:#E8183A;height:3px;"></span>Total spent</span>
      <span class="chart-legend-item"><span class="chart-legend-line" style="background:#4DFFA3;height:3px;"></span>Income</span>
    </div>`;

  container.innerHTML = svg + legend;
}

// ── Inline amount edit ─────────────────────────────────────────────────────────

function startInlineEdit(el) {
  const id      = el.dataset.id;
  const current = parseFloat(el.dataset.amount) || 0;

  const input = document.createElement('input');
  input.type = 'number'; input.min = '0'; input.step = '0.01';
  input.value = current; input.className = 'inline-amount-input';

  el.replaceWith(input);
  input.focus(); input.select();

  function commit() {
    const val = parseFloat(input.value);
    if (!isNaN(val) && val >= 0) updateCategory(currentYear, currentMonth, id, { amount: val });
    refresh();
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  input.blur();
    if (e.key === 'Escape') refresh();
  });
}

// ── Section tabs (modal) ───────────────────────────────────────────────────────

function renderSectionTabs(selectedSection, onSelect) {
  const container = document.getElementById('modal-section-tabs');
  if (!container) return;

  const customs = loadCustomSections();
  const allSections = [
    ...SECTIONS.map(s => ({ key: s.key, label: s.label })),
    ...customs.map(s => ({ key: s.name, label: s.name })),
  ];

  container.innerHTML = allSections.map(s =>
    `<button class="section-tab${s.key === selectedSection ? ' active' : ''}" data-section="${escHtml(s.key)}">${escHtml(s.label)}</button>`
  ).join('');

  container.querySelectorAll('.section-tab').forEach(tab => {
    tab.onclick = () => {
      container.querySelectorAll('.section-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      onSelect(tab.dataset.section);
    };
  });
}

// ── Category modal ─────────────────────────────────────────────────────────────

function openModal(id = null, preSection = null) {
  editingId = id;
  const backdrop = document.getElementById('modal-backdrop');
  const title    = document.getElementById('modal-title');
  const nameEl   = document.getElementById('modal-name');
  const amtEl    = document.getElementById('modal-amount');
  const budEl    = document.getElementById('modal-budget');
  const delBtn   = document.getElementById('modal-delete');

  let selectedColor   = PALETTE[0];
  let selectedSection = preSection || 'needs';

  if (id) {
    const data = loadBudget(currentYear, currentMonth);
    const cat  = data.categories.find(c => c.id === id);
    if (!cat) return;
    title.textContent    = 'Edit category';
    nameEl.value         = cat.name;
    amtEl.value          = cat.amount;
    budEl.value          = cat.budget || '';
    selectedColor        = cat.color;
    selectedSection      = cat.section || 'needs';
    delBtn.style.display = 'inline-flex';
  } else {
    title.textContent    = 'Add category';
    nameEl.value = ''; amtEl.value = ''; budEl.value = '';
    selectedColor        = PALETTE[0];
    selectedSection      = 'needs';
    delBtn.style.display = 'none';
  }

  // Section tabs — rendered dynamically so custom sections appear as real tabs
  renderSectionTabs(selectedSection, sec => { selectedSection = sec; });

  // Color swatches
  const swatchContainer = document.getElementById('color-swatches');
  swatchContainer.innerHTML = PALETTE.map(c => `
    <div class="color-swatch${c === selectedColor ? ' selected' : ''}" style="background:${c};" data-color="${c}"></div>
  `).join('');
  swatchContainer.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      swatchContainer.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      selectedColor = sw.dataset.color;
    });
  });

  document.getElementById('modal-save').onclick = () => {
    const name    = nameEl.value.trim();
    const amount  = parseFloat(amtEl.value) || 0;
    const budget  = parseFloat(budEl.value) || 0;
    if (!name) { nameEl.focus(); return; }
    if (editingId) {
      updateCategory(currentYear, currentMonth, editingId, { name, amount, budget, color: selectedColor, section: selectedSection });
    } else {
      addCategory(currentYear, currentMonth, { name, amount, budget, color: selectedColor, section: selectedSection });
    }
    closeModal(); refresh();
  };

  backdrop.classList.add('open');
}

function closeModal() {
  document.getElementById('modal-backdrop').classList.remove('open');
  editingId = null;
}

// ── Income modal ───────────────────────────────────────────────────────────────

function openIncomeModal() {
  const data  = loadBudget(currentYear, currentMonth);
  const input = document.getElementById('income-input');
  if (input) input.value = data.income || '';
  document.getElementById('income-backdrop')?.classList.add('open');
  setTimeout(() => input?.select(), 50);
}

function closeIncomeModal() {
  document.getElementById('income-backdrop')?.classList.remove('open');
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function escHtml(str) { return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Bootstrap ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('month-prev')?.addEventListener('click', () => stepMonth(-1));
  document.getElementById('month-next')?.addEventListener('click', () => stepMonth(1));

  document.getElementById('add-cat-btn')?.addEventListener('click', () => openModal(null));

  document.getElementById('add-section-btn')?.addEventListener('click', () => {
    const container = document.getElementById('category-rows');
    if (container.querySelector('.add-section-form')) return;
    const form = document.createElement('div');
    form.className = 'add-section-form';
    form.innerHTML = `
      <input class="form-input add-section-input" id="section-name-input" type="text" placeholder="e.g. Kids, Pets, Car, Home improvement…" maxlength="30" autocomplete="off">
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="btn-primary" id="section-name-save" style="flex:1;justify-content:center;padding:9px 0;">Create section</button>
        <button class="btn-cancel" id="section-name-cancel" style="padding:9px 16px;">Cancel</button>
      </div>`;
    container.appendChild(form);
    const input = form.querySelector('#section-name-input');
    input.focus();
    form.querySelector('#section-name-save').onclick = () => {
      const name = input.value.trim();
      if (!name) { input.focus(); return; }
      const customs = loadCustomSections();
      const total   = SECTIONS.length + customs.length;
      if (total >= 5) { input.value = ''; input.placeholder = 'Section limit reached (5 max)'; input.focus(); return; }
      if (!customs.find(s => s.name.toLowerCase() === name.toLowerCase())) {
        const color = SECTION_COLORS[customs.length % SECTION_COLORS.length];
        customs.push({ name, color });
        saveCustomSections(customs);
      }
      refresh();
    };
    form.querySelector('#section-name-cancel').onclick = () => form.remove();
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  form.querySelector('#section-name-save').click();
      if (e.key === 'Escape') form.remove();
    });
  });

  document.getElementById('modal-backdrop')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
  document.getElementById('modal-delete')?.addEventListener('click', () => {
    if (!editingId) return;
    if (confirm('Delete this category?')) {
      deleteCategory(currentYear, currentMonth, editingId);
      closeModal(); refresh();
    }
  });

  document.getElementById('edit-income-btn')?.addEventListener('click', openIncomeModal);
  document.getElementById('income-cancel')?.addEventListener('click', closeIncomeModal);
  document.getElementById('income-backdrop')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeIncomeModal();
  });
  document.getElementById('income-save')?.addEventListener('click', () => {
    const val = parseFloat(document.getElementById('income-input')?.value);
    if (isNaN(val) || val < 0) return;
    const data = loadBudget(currentYear, currentMonth);
    data.income = val;
    saveBudget(currentYear, currentMonth, data);
    closeIncomeModal(); refresh();
  });
  document.getElementById('income-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter')  document.getElementById('income-save')?.click();
    if (e.key === 'Escape') closeIncomeModal();
  });

  // Chart view tabs
  document.getElementById('chart-tabs')?.addEventListener('click', e => {
    const tab = e.target.closest('.chart-tab');
    if (!tab) return;
    document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    chartMonths = parseInt(tab.dataset.months);
    renderChart(chartMonths);
  });

  refresh();
});
