import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decodeTripFromPayload, encodeTripToShareUrl, SHARE_WORKER_URL } from './share';
import type { Trip } from './types';

// share.ts uses window.location and fetch — stub them out
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
vi.stubGlobal('window', {
  location: { origin: 'https://shoutmate.app', pathname: '/' },
});

const sampleTrip: Trip = {
  id: 'trip-1',
  name: 'Byron Bay',
  createdAt: 1000000,
  state: {
    currency: 'AUD',
    participants: [
      { id: 'p0', name: 'Alice' },
      { id: 'p1', name: 'Bob' },
    ],
    expenses: [
      {
        id: 'e0',
        description: 'Airbnb',
        amount: 300,
        paidById: 'p0',
        splitAmongIds: ['p0', 'p1'],
      },
    ],
  },
};

beforeEach(() => {
  mockFetch.mockReset();
});

describe('encodeTripToShareUrl', () => {
  it('returns a short-code URL when Worker responds ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: 'abcd1234' }),
    });

    const url = await encodeTripToShareUrl(sampleTrip);
    expect(url).toBe('https://shoutmate.app/#/share/abcd1234');
    expect(mockFetch).toHaveBeenCalledWith(
      SHARE_WORKER_URL,
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('falls back to inline base64 when Worker fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const url = await encodeTripToShareUrl(sampleTrip);
    expect(url).toMatch(/^https:\/\/shoutmate\.app\/#\/share\/[A-Za-z0-9_-]+$/);
    // Should not be a short code
    expect(url.split('/share/')[1].length).toBeGreaterThan(8);
  });

  it('falls back to inline base64 when Worker returns non-ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const url = await encodeTripToShareUrl(sampleTrip);
    expect(url).toMatch(/^https:\/\/shoutmate\.app\/#\/share\//);
    expect(url.split('/share/')[1].length).toBeGreaterThan(8);
  });
});

describe('decodeTripFromPayload', () => {
  it('fetches from Worker for an 8-char short code', async () => {
    const compact = {
      v: 2,
      n: 'Byron Bay',
      c: 'AUD',
      p: ['Alice', 'Bob'],
      e: [['Airbnb', 300, 0, [0, 1]]],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => compact,
    });

    const trip = await decodeTripFromPayload('abcd1234');
    expect(trip).not.toBeNull();
    expect(trip!.name).toBe('Byron Bay');
    expect(trip!.state.participants).toHaveLength(2);
    expect(trip!.state.expenses[0].amount).toBe(300);
  });

  it('returns null when Worker returns 404 for short code', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await decodeTripFromPayload('notfound')).toBeNull();
  });

  it('decodes an inline base64 compact payload without network call', async () => {
    // Round-trip: encode then decode via inline path (Worker fails on encode)
    mockFetch.mockRejectedValueOnce(new Error('offline'));
    const encoded = await encodeTripToShareUrl(sampleTrip);
    const payload = encoded.split('/share/')[1];

    // Decode should not call fetch (it's not an 8-char code)
    const trip = await decodeTripFromPayload(payload);
    expect(mockFetch).toHaveBeenCalledTimes(1); // only the encode call
    expect(trip!.name).toBe('Byron Bay');
    expect(trip!.state.currency).toBe('AUD');
  });

  it('returns null for a malformed payload', async () => {
    expect(await decodeTripFromPayload('!!!invalid!!!')).toBeNull();
  });
});
