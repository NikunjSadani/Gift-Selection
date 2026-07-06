/**
 * TDD tests for src/lib/gift-window.ts
 *
 * Verifies the change-window constant and expiry helper
 * without any Firebase dependency.
 */

export {}; // make this file a module so top-level await is allowed under tsc

const { CHANGE_WINDOW_MS, isChangeWindowExpired } = await import('@/lib/gift-window');

const HOUR = 3600000;

describe('CHANGE_WINDOW_MS', () => {
  it('is exactly 48 hours in milliseconds', () => {
    expect(CHANGE_WINDOW_MS).toBe(48 * HOUR);
  });
});

describe('isChangeWindowExpired', () => {
  it('returns false when gift was confirmed 1 hour ago', () => {
    const confirmedAt = new Date(Date.now() - HOUR).toISOString();
    expect(isChangeWindowExpired(confirmedAt)).toBe(false);
  });

  it('returns false when gift was confirmed 47 hours ago', () => {
    const confirmedAt = new Date(Date.now() - 47 * HOUR).toISOString();
    expect(isChangeWindowExpired(confirmedAt)).toBe(false);
  });

  it('returns true when gift was confirmed exactly 48 hours ago', () => {
    const confirmedAt = new Date(Date.now() - 48 * HOUR).toISOString();
    expect(isChangeWindowExpired(confirmedAt)).toBe(true);
  });

  it('returns true when gift was confirmed 72 hours ago', () => {
    const confirmedAt = new Date(Date.now() - 72 * HOUR).toISOString();
    expect(isChangeWindowExpired(confirmedAt)).toBe(true);
  });

  it('accepts a Date object as well as a string', () => {
    const confirmedAt = new Date(Date.now() - HOUR);
    expect(isChangeWindowExpired(confirmedAt)).toBe(false);
  });
});
