/**
 * api.js — Kenso API layer
 *
 * Responsible for: fetching or simulating external data (market prices,
 * user transactions, portfolio quotes). All network calls live here.
 * Nothing in this file touches the DOM.
 *
 * To swap in a real API later, replace the relevant function body —
 * the rest of the app won't need to change.
 */

// ── Market ticker ─────────────────────────────────────────────────────────────

/**
 * Returns current market snapshot data.
 * Replace this with a real fetch() call to your market data provider.
 *
 * @returns {Promise<Array<{symbol: string, price: string, change: string, up: boolean}>>}
 */
export async function fetchMarketData() {
  // Simulated — swap for: const res = await fetch('/api/market'); return res.json();
  return [
    { symbol: 'S&P 500',  price: '5,341.22',  change: '▲ +0.82%', up: true  },
    { symbol: 'NASDAQ',   price: '18,924.40', change: '▲ +1.14%', up: true  },
    { symbol: '10Y YIELD',price: '4.28%',     change: '▼ −0.04%', up: false },
    { symbol: 'BTC',      price: '$67,204',   change: '▲ +2.3%',  up: true  },
    { symbol: 'GOLD',     price: '$2,341/oz', change: '▼ −0.18%', up: false },
    { symbol: 'USD/EUR',  price: '0.9182',    change: '▲ +0.06%', up: true  },
    { symbol: 'VIX',      price: '14.32',     change: '▼ −1.2%',  up: false },
  ];
}

// ── Budget transactions ────────────────────────────────────────────────────────

/**
 * Returns this month's budget data for the current user.
 * Replace with a real authenticated API call.
 *
 * @returns {Promise<{income: number, categories: Array<{name: string, amount: number, color: string}>}>}
 */
export async function fetchBudgetData() {
  return {
    income: 5000,
    categories: [
      { name: 'Housing',        amount: 1550, color: '#0F1F4B' },
      { name: 'Food & dining',  amount: 640,  color: '#C9881A' },
      { name: 'Transport',      amount: 380,  color: '#3B82F6' },
      { name: 'Subscriptions',  amount: 142,  color: '#8B5CF6' },
      { name: 'Entertainment',  amount: 96,   color: '#10B981' },
      { name: 'Everything else',amount: 300,  color: '#A8AFBD' },
    ],
  };
}

// ── Portfolio holdings ─────────────────────────────────────────────────────────

/**
 * Returns the user's tracked portfolio holdings.
 * Replace with a real authenticated API call.
 *
 * @returns {Promise<{holdings: Array<{ticker: string, name: string, value: number, changePercent: number, color: string}>}>}
 */
export async function fetchPortfolioData() {
  return {
    holdings: [
      { ticker: 'VTI',  name: 'Vanguard Total Market ETF', value: 20840, changePercent:  1.2, color: '#0F1F4B' },
      { ticker: 'BND',  name: 'Vanguard Total Bond ETF',   value: 13025, changePercent:  0.3, color: '#C9881A' },
      { ticker: 'VXUS', name: 'Intl. Stock ETF',           value: 10420, changePercent: -0.6, color: '#3B82F6' },
      { ticker: 'AAPL', name: 'Apple Inc.',                value:  4210, changePercent:  0.9, color: '#0F1F4B' },
    ],
  };
}
