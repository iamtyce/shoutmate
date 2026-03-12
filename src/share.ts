import type { Trip } from './types';

// ---------------------------------------------------------------------------
// v2 compact format — short keys, participant indices instead of UUIDs
// ---------------------------------------------------------------------------

interface CompactTrip {
  v: 2;
  n: string;        // name
  c: string;        // currency
  p: string[];      // participant names (index = implicit id)
  e: [string, number, number, number[]][]; // [desc, amount, payerIdx, splitIdxs]
}

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeCompact(trip: Trip): string {
  const { participants, expenses, currency } = trip.state;
  const idxMap = new Map(participants.map((p, i) => [p.id, i]));

  const compact: CompactTrip = {
    v: 2,
    n: trip.name,
    c: currency,
    p: participants.map((p) => p.name),
    e: expenses.map((exp) => [
      exp.description,
      exp.amount,
      idxMap.get(exp.paidById) ?? 0,
      exp.splitAmongIds.map((id) => idxMap.get(id) ?? 0),
    ]),
  };

  return toBase64Url(JSON.stringify(compact));
}

function decodeCompact(raw: CompactTrip): Trip {
  const participants = raw.p.map((name, i) => ({ id: `p${i}`, name }));
  const expenses = raw.e.map((e, i) => ({
    id: `e${i}`,
    description: e[0],
    amount: e[1],
    paidById: `p${e[2]}`,
    splitAmongIds: e[3].map((idx) => `p${idx}`),
  }));

  return {
    id: crypto.randomUUID(),
    name: raw.n,
    createdAt: Date.now(),
    state: { participants, expenses, currency: raw.c },
  };
}

// ---------------------------------------------------------------------------
// v1 legacy format — full JSON trip
// ---------------------------------------------------------------------------

function decodeLegacy(encoded: string): Trip | null {
  try {
    return JSON.parse(fromBase64Url(encoded)) as Trip;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function encodeTripToShareUrl(trip: Trip): string {
  const payload = encodeCompact(trip);
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/share/${payload}`;
}

export function decodeTripFromPayload(payload: string): Trip | null {
  try {
    const parsed = JSON.parse(fromBase64Url(payload));
    if (parsed?.v === 2) return decodeCompact(parsed as CompactTrip);
    // v1: raw Trip JSON
    return parsed as Trip;
  } catch {
    // Try legacy non-JSON-wrapped format as last resort
    return decodeLegacy(payload);
  }
}