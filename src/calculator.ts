import type { Participant, Expense, Settlement } from './types';

/**
 * Calculates the net balance for each participant.
 * Positive = they are owed money. Negative = they owe money.
 */
export function calculateBalances(
  participants: Participant[],
  expenses: Expense[]
): Map<string, number> {
  const balances = new Map<string, number>(
    participants.map((p) => [p.id, 0])
  );

  for (const expense of expenses) {
    const splitCount = expense.splitAmongIds.length;
    if (splitCount === 0) continue;

    const sharePerPerson = expense.amount / splitCount;

    // Payer gets credited the full amount
    balances.set(
      expense.paidById,
      (balances.get(expense.paidById) ?? 0) + expense.amount
    );

    // Each person in the split gets debited their share
    for (const personId of expense.splitAmongIds) {
      balances.set(personId, (balances.get(personId) ?? 0) - sharePerPerson);
    }
  }

  return balances;
}

/**
 * Computes the minimal set of transactions needed to settle all debts.
 * Uses a greedy algorithm: pair the largest creditor with the largest debtor.
 */
export function calculateSettlements(
  participants: Participant[],
  expenses: Expense[]
): Settlement[] {
  const balances = calculateBalances(participants, expenses);
  const nameMap = new Map(participants.map((p) => [p.id, p.name]));

  // Separate into creditors (positive) and debtors (negative)
  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];

  for (const [id, balance] of balances) {
    const rounded = Math.round(balance * 100) / 100;
    if (rounded > 0.005) creditors.push({ id, amount: rounded });
    else if (rounded < -0.005) debtors.push({ id, amount: -rounded });
  }

  // Sort descending so we always deal with the largest amounts first
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];

  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const amount = Math.min(creditor.amount, debtor.amount);
    const rounded = Math.round(amount * 100) / 100;

    if (rounded > 0.005) {
      settlements.push({
        fromId: debtor.id,
        fromName: nameMap.get(debtor.id) ?? 'Unknown',
        toId: creditor.id,
        toName: nameMap.get(creditor.id) ?? 'Unknown',
        amount: rounded,
      });
    }

    creditor.amount -= amount;
    debtor.amount -= amount;

    if (creditor.amount < 0.005) ci++;
    if (debtor.amount < 0.005) di++;
  }

  return settlements;
}

export function totalExpenses(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}
