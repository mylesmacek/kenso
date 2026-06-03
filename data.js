/**
 * data.js — Kenso data processing layer
 *
 * Responsible for: pure calculation and transformation functions.
 * No API calls. No DOM access. Every function here is independently testable —
 * pass in data, get a result back.
 */

// ── Budget calculations ────────────────────────────────────────────────────────

/**
 * Sums all category amounts to get total spending.
 * @param {Array<{amount: number}>} categories
 * @returns {number}
 */
export function calcTotalSpent(categories) {
  return categories.reduce((sum, cat) => sum + cat.amount, 0);
}

/**
 * Remaining budget = income - total spent.
 * @param {number} income
 * @param {number} totalSpent
 * @returns {number}
 */
export function calcRemaining(income, totalSpent) {
  return income - totalSpent;
}

/**
 * Spending percentage of income for a single category.
 * @param {number} amount
 * @param {number} income
 * @returns {number} 0–100
 */
export function calcCategoryPercent(amount, income) {
  if (income === 0) return 0;
  return Math.round((amount / income) * 100);
}

/**
 * Bar fill width as percentage relative to the largest category (not income),
 * so bars are visually proportional to each other.
 * @param {number} amount
 * @param {number} maxAmount  — the largest single category amount
 * @returns {number} 0–100
 */
export function calcBarWidth(amount, maxAmount) {
  if (maxAmount === 0) return 0;
  return Math.round((amount / maxAmount) * 100);
}

/**
 * Savings rate = (income - spent) / income * 100.
 * @param {number} income
 * @param {number} totalSpent
 * @returns {number} percentage, rounded to 1 decimal
 */
export function calcSavingsRate(income, totalSpent) {
  if (income === 0) return 0;
  return Math.round(((income - totalSpent) / income) * 1000) / 10;
}

// ── Portfolio calculations ─────────────────────────────────────────────────────

/**
 * Total portfolio value.
 * @param {Array<{value: number}>} holdings
 * @returns {number}
 */
export function calcPortfolioTotal(holdings) {
  return holdings.reduce((sum, h) => sum + h.value, 0);
}

/**
 * Allocation percentage for a single holding.
 * @param {number} holdingValue
 * @param {number} portfolioTotal
 * @returns {number} 0–100
 */
export function calcAllocationPercent(holdingValue, portfolioTotal) {
  if (portfolioTotal === 0) return 0;
  return Math.round((holdingValue / portfolioTotal) * 100);
}

/**
 * Formats a number as a dollar string with commas.
 * @param {number} n
 * @returns {string}  e.g. "$52,100"
 */
export function formatDollars(n) {
  return '$' + n.toLocaleString('en-US');
}

/**
 * Formats a percentage change with a sign and arrow.
 * @param {number} pct
 * @returns {{ label: string, up: boolean }}
 */
export function formatChange(pct) {
  const up = pct >= 0;
  const arrow = up ? '▲ +' : '▼ ';
  return { label: `${arrow}${Math.abs(pct)}%`, up };
}

// ── Net worth helpers ──────────────────────────────────────────────────────────

/**
 * Approximate net worth from assets and liabilities.
 * @param {number} assets
 * @param {number} liabilities
 * @returns {number}
 */
export function calcNetWorth(assets, liabilities) {
  return assets - liabilities;
}

/**
 * Emergency fund runway in months.
 * @param {number} savings     — current emergency savings balance
 * @param {number} monthlySpend
 * @returns {number} months of coverage, 1 decimal
 */
export function calcEmergencyRunway(savings, monthlySpend) {
  if (monthlySpend === 0) return 0;
  return Math.round((savings / monthlySpend) * 10) / 10;
}
