export interface Participant {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  paidById: string;
  splitAmongIds: string[];
}

export interface Settlement {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
}

export interface AppState {
  participants: Participant[];
  expenses: Expense[];
  currency: string;
}

export interface Trip {
  id: string;
  name: string;
  createdAt: number;
  state: AppState;
}

export type TripRegistry = Record<string, Trip>;
