import type { AppState, Expense, Trip, TripRegistry } from './types';

const REGISTRY_KEY = 'shoutmate_trips';

function defaultAppState(): AppState {
  return { participants: [], expenses: [], currency: 'AUD' };
}

function loadRegistry(): TripRegistry {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    return raw ? (JSON.parse(raw) as TripRegistry) : {};
  } catch {
    return {};
  }
}

function saveRegistry(): void {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
}

let registry: TripRegistry = loadRegistry();
let activeTripId: string | null = null;

// ---------------------------------------------------------------------------
// Registry operations
// ---------------------------------------------------------------------------

export function listTrips(): Trip[] {
  return Object.values(registry).sort((a, b) => b.createdAt - a.createdAt);
}

export function getTrip(id: string): Trip | undefined {
  return registry[id];
}

export function createTrip(name: string): Trip {
  const trip: Trip = {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: Date.now(),
    state: defaultAppState(),
  };
  registry[trip.id] = trip;
  saveRegistry();
  return trip;
}

export function deleteTrip(id: string): void {
  const { [id]: _removed, ...rest } = registry;
  registry = rest;
  saveRegistry();
}

export function renameTrip(id: string, name: string): void {
  if (registry[id]) {
    registry[id] = { ...registry[id], name: name.trim() };
    saveRegistry();
  }
}

export function importTrip(trip: Trip): Trip {
  // Assign a fresh local ID to avoid collisions
  const local: Trip = { ...trip, id: crypto.randomUUID() };
  registry[local.id] = local;
  saveRegistry();
  return local;
}

// ---------------------------------------------------------------------------
// Active trip
// ---------------------------------------------------------------------------

export function setActiveTrip(id: string): void {
  activeTripId = id;
}

function getActiveTrip(): Trip {
  if (!activeTripId || !registry[activeTripId]) {
    throw new Error('No active trip');
  }
  return registry[activeTripId];
}

function updateActiveState(updater: (s: AppState) => AppState): void {
  const trip = getActiveTrip();
  registry[trip.id] = { ...trip, state: updater(trip.state) };
  saveRegistry();
}

export function getState(): AppState {
  return getActiveTrip().state;
}

// ---------------------------------------------------------------------------
// Per-trip mutations (same signatures as before)
// ---------------------------------------------------------------------------

export function addParticipant(name: string): void {
  updateActiveState((s) => ({
    ...s,
    participants: [
      ...s.participants,
      { id: crypto.randomUUID(), name: name.trim() },
    ],
  }));
}

export function removeParticipant(id: string): void {
  updateActiveState((s) => ({
    ...s,
    participants: s.participants.filter((p) => p.id !== id),
    expenses: s.expenses
      .map((e) =>
        e.paidById === id
          ? null
          : { ...e, splitAmongIds: e.splitAmongIds.filter((sid) => sid !== id) }
      )
      .filter((e): e is Expense => e !== null && e.splitAmongIds.length > 0),
  }));
}

export function addExpense(expense: Omit<Expense, 'id'>): void {
  updateActiveState((s) => ({
    ...s,
    expenses: [...s.expenses, { id: crypto.randomUUID(), ...expense }],
  }));
}

export function removeExpense(id: string): void {
  updateActiveState((s) => ({
    ...s,
    expenses: s.expenses.filter((e) => e.id !== id),
  }));
}

export function setCurrency(currency: string): void {
  updateActiveState((s) => ({ ...s, currency }));
}
