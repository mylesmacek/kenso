/**
 * landing-ui.js — Landing page UI
 *
 * Responsible for: ticker rendering, hero dashboard tab switching,
 * and scroll-in animations. Scoped to index.html only.
 * No math, no localStorage — just DOM wiring for the landing page.
 */

import { fetchMarketData } from './api.js';

// ── Ticker ─────────────────────────────────────────────────────────────────────

/**
 * Fetches market data and renders it into .ticker-inner, duplicated for
 * a seamless CSS loop animation.
 */
async function renderTicker() {
  const container = document.querySelector('.ticker-inner');
  if (!container) return;

  const items = await fetchMarketData();

  const buildItem = ({ symbol, price, change, up }) => `
    <span class="tick-item">
      <span class="tick-sym">${symbol}</span>&nbsp;${price}&nbsp;
      <span class="tick-chg ${up ? 'up' : 'dn'}">${change}</span>
    </span>
    <span class="tick-sep">|</span>
  `;

  container.innerHTML = [...items, ...items].map(buildItem).join('');
}

// ── Hero dashboard tabs ────────────────────────────────────────────────────────

/**
 * Wires the decorative dashboard tab buttons in the hero card.
 */
function initDashTabs() {
  document.querySelectorAll('.dash-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });
}

// ── Scroll animations ──────────────────────────────────────────────────────────

/**
 * Fades feature cards in as they scroll into the viewport.
 */
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.opacity = '1';
        e.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.feature-card').forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    el.style.transition = `opacity 0.4s ${i * 0.055}s ease, transform 0.4s ${i * 0.055}s ease`;
    observer.observe(el);
  });
}

// ── Bootstrap ──────────────────────────────────────────────────────────────────

function init() {
  renderTicker().catch(err => console.error('[Kenso] Ticker failed:', err));
  initDashTabs();
  initScrollAnimations();
}

document.addEventListener('DOMContentLoaded', init);
