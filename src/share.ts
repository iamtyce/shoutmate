import type { Trip } from './types';

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

export function encodeTripToShareUrl(trip: Trip): string {
  const payload = toBase64Url(JSON.stringify(trip));
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/share/${payload}`;
}

export function decodeTripFromPayload(payload: string): Trip | null {
  try {
    return JSON.parse(fromBase64Url(payload)) as Trip;
  } catch {
    return null;
  }
}
