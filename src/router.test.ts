import { describe, it, expect } from 'vitest';
import { parseRoute } from './router';

describe('parseRoute', () => {
  it('returns home for empty hash', () => {
    expect(parseRoute('')).toEqual({ view: 'home' });
    expect(parseRoute('#/')).toEqual({ view: 'home' });
    expect(parseRoute('#')).toEqual({ view: 'home' });
  });

  it('returns trip view for a trip ID', () => {
    expect(parseRoute('#/abc-123')).toEqual({ view: 'trip', tripId: 'abc-123' });
  });

  it('returns share view with payload', () => {
    expect(parseRoute('#/share/j7buckkv')).toEqual({ view: 'share', payload: 'j7buckkv' });
  });

  it('handles long base64 share payloads', () => {
    const payload = 'eyJ2IjoyLCJuIjoiVGVzdCJ9';
    expect(parseRoute(`#/share/${payload}`)).toEqual({ view: 'share', payload });
  });
});
