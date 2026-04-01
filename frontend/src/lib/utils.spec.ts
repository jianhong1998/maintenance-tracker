import { describe, it, expect } from 'vitest';
import { parsePositiveInteger } from './utils';

describe('parsePositiveInteger', () => {
  it('returns the integer for a valid positive string', () => {
    expect(parsePositiveInteger('42')).toBe(42);
  });

  it('returns null for zero', () => {
    expect(parsePositiveInteger('0')).toBeNull();
  });

  it('returns null for a negative value', () => {
    expect(parsePositiveInteger('-5')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parsePositiveInteger('')).toBeNull();
  });

  it('returns null for a non-numeric string', () => {
    expect(parsePositiveInteger('abc')).toBeNull();
  });

  it('returns null for whitespace only', () => {
    expect(parsePositiveInteger('  ')).toBeNull();
  });

  it('parses an integer from a float-like string (truncates)', () => {
    expect(parsePositiveInteger('5000')).toBe(5000);
  });
});
