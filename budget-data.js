/**
 * budget-data.js — Budget localStorage layer
 *
 * Handles reading and writing budget data. Defaults are always returned
 * if no user data exists yet. Pure functions where possible — each one
 * does one thing and is independently testable.
 */

import { calcTotalSpent, calcRemaining, calcSavingsRate } from './data.js';

// ── Storage keys ───────────────────────────────────────────────────────────────

const STORAGE_KEY  = 'kenso_budget';
const SECTIONS_KEY = 'kenso_custom_sections';

// ── Default data ───────────────────────────────────────────────────────────────

/** Hardcoded fallback used when localStorage has nothing. */
const DEFAULT_BUDGET = {
  income: 5000,
  categories: [
    // ── Needs (target ~50%) ──────────────────────────────────────────────────
    { id: 'housing',   name: 'Housing & Shelter', section: 'needs',   amount: 1500, budget: 1500, color: '#0F1F4B' },
    { id: 'utilities', name: 'Utilities',          section: 'needs',   amount: 180,  budget: 220,  color: '#1A3270' },
    { id: 'food',      name: 'Food & Groceries',   section: 'needs',   amount: 400,  budget: 450,  color: '#3B82F6' },
    { id: 'transport', name: 'Transportation',      section: 'needs',   amount: 280,  budget: 350,  color: '#6366F1' },
    { id: 'health',    name: 'Health & Wellness',   section: 'needs',   amount: 120,  budget: 200,  color: '#8B5CF6' },
    { id: 'debt',      name: 'Debt Repayment',      section: 'needs',   amount: 0,    budget: 0,    color: '#EC4899' },
    // ── Wants (target ~30%) ──────────────────────────────────────────────────
    { id: 'dining',    name: 'Dining & Entertainment', section: 'wants', amount: 220, budget: 300, color: '#F97316' },
    { id: 'subs',      name: 'Subscriptions',          section: 'wants', amount: 85,  budget: 100, color: '#C9881A' },
    { id: 'travel',    name: 'Travel & Leisure',        section: 'wants', amount: 0,   budget: 200, color: '#EAB308' },
    { id: 'shopping',  name: 'Shopping',                section: 'wants', amount: 150, budget: 150, color: '#10B981' },
    { id: 'gifts',     name: 'Gifts & Giving',          section: 'wants', amount: 40,  budget: 75,  color: '#14B8A6' },
  ],
};

// ── Month key helper ───────────────────────────────────────────────────────────

/**
 * Returns a storage key for a given month, e.g. "kenso_budget_2026-06".
 * @param {number} year
 * @param {number} month  1-indexed
 * @returns {string}
 */
export function monthKey(year, month) {
  return `${STORAGE_KEY}_${year}-${String(month).padStart(2, '0')}`;
}

// ── Load ───────────────────────────────────────────────────────────────────────

/**
 * Loads budget data for a given month. Falls back to defaults if nothing saved.
 * @param {number} year
 * @param {number} month  1-indexed
 * @returns {{ income: number, categories: Array }}
 */
export function loadBudget(year, month) {
  try {
    const raw = localStorage.getItem(monthKey(year, month));
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('[Kenso] Could not read budget from localStorage:', e);
  }
  // Return a deep copy of defaults so mutations don't bleed through
  return JSON.parse(JSON.stringify(DEFAULT_BUDGET));
}

// ── Save ───────────────────────────────────────────────────────────────────────

/**
 * Persists budget data for a given month.
 * @param {number} year
 * @param {number} month  1-indexed
 * @param {{ income: number, categories: Array }} data
 */
export function saveBudget(year, month, data) {
  try {
    localStorage.setItem(monthKey(year, month), JSON.stringify(data));
  } catch (e) {
    console.warn('[Kenso] Could not save budget to localStorage:', e);
  }
}

// ── Income ─────────────────────────────────────────────────────────────────────

/**
 * Updates income for the month and saves.
 * @param {number} year
 * @param {number} month
 * @param {number} income
 */
export function updateIncome(year, month, income) {
  const data = loadBudget(year, month);
  data.income = income;
  saveBudget(year, month, data);
  return data;
}

// ── Categories ─────────────────────────────────────────────────────────────────

/**
 * Adds a new category.
 * @param {number} year
 * @param {number} month
 * @param {{ name: string, amount: number, budget: number, color: string }} cat
 * @returns Updated budget data
 */
export function addCategory(year, month, cat) {
  const data = loadBudget(year, month);
  data.categories.push({
    id:      `cat_${Date.now()}`,
    name:    cat.name,
    section: cat.section || 'needs',
    amount:  Number(cat.amount) || 0,
    budget:  Number(cat.budget) || 0,
    color:   cat.color || '#A8AFBD',
  });
  saveBudget(year, month, data);
  return data;
}

/**
 * Updates an existing category by id.
 * @param {number} year
 * @param {number} month
 * @param {string} id
 * @param {Partial<{ name, amount, budget, color }>} updates
 * @returns Updated budget data
 */
export function updateCategory(year, month, id, updates) {
  const data = loadBudget(year, month);
  const idx = data.categories.findIndex(c => c.id === id);
  if (idx === -1) return data;
  data.categories[idx] = { ...data.categories[idx], ...updates };
  saveBudget(year, month, data);
  return data;
}

/**
 * Deletes a category by id.
 * @param {number} year
 * @param {number} month
 * @param {string} id
 * @returns Updated budget data
 */
export function deleteCategory(year, month, id) {
  const data = loadBudget(year, month);
  data.categories = data.categories.filter(c => c.id !== id);
  saveBudget(year, month, data);
  return data;
}

// ── Custom sections ────────────────────────────────────────────────────────────

export function loadCustomSections() {
  try {
    const raw = localStorage.getItem(SECTIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map(s => typeof s === 'string' ? { name: s, color: '#1A6B3C' } : s);
  } catch { return []; }
}

export function saveCustomSections(sections) {
  try {
    localStorage.setItem(SECTIONS_KEY, JSON.stringify(sections));
  } catch {}
}

// ── Derived summary ────────────────────────────────────────────────────────────

/**
 * Returns computed summary values for the UI.
 * @param {{ income: number, categories: Array }} data
 * @returns {{ income, totalSpent, remaining, savingsRate, categories }}
 */
export function getBudgetSummary(data) {
  const totalSpent  = calcTotalSpent(data.categories);
  const remaining   = calcRemaining(data.income, totalSpent);
  const savingsRate = calcSavingsRate(data.income, totalSpent);
  return { income: data.income, totalSpent, remaining, savingsRate, categories: data.categories };
}
