import type { Trip } from './types';

// ---------------------------------------------------------------------------
// Worker URL — update this after running: cd worker && npm run deploy
// ---------------------------------------------------------------------------

export const SHARE_WORKER_URL = 'https://shoutmate-share.tyce.workers.dev';

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

function tripToCompact(trip: Trip): CompactTrip {
  const { participants, expenses, currency } = trip.state;
  const idxMap = new Map(participants.map((p, i) => [p.id, i]));
  return {
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
}

function compactToTrip(raw: CompactTrip): Trip {
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
// Public API
// ---------------------------------------------------------------------------

/** Returns a short share URL via the Worker, falls back to inline base64 URL. */
export async function encodeTripToShareUrl(trip: Trip): Promise<string> {
  const compact = JSON.stringify(tripToCompact(trip));
  const base = `${window.location.origin}${window.location.pathname}`;

  try {
    const res = await fetch(SHARE_WORKER_URL, {
      method: 'POST',
      body: compact,
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const { code } = (await res.json()) as { code: string };
      return `${base}#/share/${code}`;
    }
  } catch {
    // Worker unreachable — fall through to inline encoding
  }

  // Fallback: inline base64 compact payload (still much shorter than v1)
  return `${base}#/share/${toBase64Url(compact)}`;
}

/** Decodes a share payload — short code (fetches from Worker) or inline base64. */
export async function decodeTripFromPayload(payload: string): Promise<Trip | null> {
  // Short code: 8 lowercase alphanumeric chars → fetch from Worker
  if (/^[a-z0-9]{8}$/.test(payload)) {
    try {
      const res = await fetch(`${SHARE_WORKER_URL}/${payload}`);
      if (!res.ok) return null;
      const raw = (await res.json()) as CompactTrip;
      return raw?.v === 2 ? compactToTrip(raw) : (raw as unknown as Trip);
    } catch {
      return null;
    }
  }

  // Inline base64 payload (v2 compact or v1 full Trip JSON)
  try {
    const parsed = JSON.parse(fromBase64Url(payload));
    if (parsed?.v === 2) return compactToTrip(parsed as CompactTrip);
    return parsed as Trip;
  } catch {
    return null;
  }
}
