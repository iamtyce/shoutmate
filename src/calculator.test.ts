import { describe, it, expect } from 'vitest';
import { calculateBalances, calculateSettlements, totalExpenses } from './calculator';
import type { Participant, Expense } from './types';

const alice: Participant = { id: 'p0', name: 'Alice' };
const bob: Participant = { id: 'p1', name: 'Bob' };
const cara: Participant = { id: 'p2', name: 'Cara' };

function expense(
  id: string,
  description: string,
  amount: number,
  paidById: string,
  splitAmongIds: string[]
): Expense {
  return { id, description, amount, paidById, splitAmongIds };
}

describe('calculateBalances', () => {
  it('returns zero balances with no expenses', () => {
    const balances = calculateBalances([alice, bob], []);
    expect(balances.get('p0')).toBe(0);
    expect(balances.get('p1')).toBe(0);
  });

  it('credits payer and debits split members', () => {
    const exp = expense('e0', 'Dinner', 90, 'p0', ['p0', 'p1', 'p2']);
    const balances = calculateBalances([alice, bob, cara], [exp]);
    expect(balances.get('p0')).toBeCloseTo(60); // paid 90, owes 30
    expect(balances.get('p1')).toBeCloseTo(-30);
    expect(balances.get('p2')).toBeCloseTo(-30);
  });

  it('handles expenses not split among payer', () => {
    const exp = expense('e0', 'Taxi', 40, 'p0', ['p1', 'p2']);
    const balances = calculateBalances([alice, bob, cara], [exp]);
    expect(balances.get('p0')).toBeCloseTo(40);
    expect(balances.get('p1')).toBeCloseTo(-20);
    expect(balances.get('p2')).toBeCloseTo(-20);
  });

  it('skips expenses with no split members', () => {
    const exp = expense('e0', 'Solo', 50, 'p0', []);
    const balances = calculateBalances([alice, bob], [exp]);
    // Expense is ignored entirely — payer is not credited when there's nobody to split with
    expect(balances.get('p0')).toBe(0);
    expect(balances.get('p1')).toBe(0);
  });
});

describe('calculateSettlements', () => {
  it('returns empty array when no expenses', () => {
    expect(calculateSettlements([alice, bob], [])).toEqual([]);
  });

  it('produces one settlement for a simple two-person split', () => {
    const exp = expense('e0', 'Hotel', 100, 'p0', ['p0', 'p1']);
    const settlements = calculateSettlements([alice, bob], [exp]);
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toMatchObject({
      fromId: 'p1',
      fromName: 'Bob',
      toId: 'p0',
      toName: 'Alice',
      amount: 50,
    });
  });

  it('minimises transactions for three people', () => {
    // Alice pays $90 split 3 ways — Bob and Cara each owe $30
    const exp = expense('e0', 'Dinner', 90, 'p0', ['p0', 'p1', 'p2']);
    const settlements = calculateSettlements([alice, bob, cara], [exp]);
    expect(settlements).toHaveLength(2);
    const total = settlements.reduce((s, t) => s + t.amount, 0);
    expect(total).toBeCloseTo(60);
  });

  it('nets out mutual debts', () => {
    const exp1 = expense('e0', 'Lunch', 60, 'p0', ['p0', 'p1']); // Bob owes Alice $30
    const exp2 = expense('e1', 'Drinks', 40, 'p1', ['p0', 'p1']); // Alice owes Bob $20
    // Net: Bob owes Alice $10
    const settlements = calculateSettlements([alice, bob], [exp1, exp2]);
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toMatchObject({ fromId: 'p1', toId: 'p0', amount: 10 });
  });
});

describe('totalExpenses', () => {
  it('sums all expense amounts', () => {
    const exps = [
      expense('e0', 'A', 10, 'p0', []),
      expense('e1', 'B', 25.5, 'p0', []),
      expense('e2', 'C', 4.5, 'p0', []),
    ];
    expect(totalExpenses(exps)).toBe(40);
  });

  it('returns 0 for empty list', () => {
    expect(totalExpenses([])).toBe(0);
  });
});
