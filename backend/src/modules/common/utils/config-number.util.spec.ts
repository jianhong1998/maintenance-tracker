import { describe, it, expect, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { readNumericEnv } from './config-number.util';

const stubConfig = (returns: unknown): ConfigService =>
  ({ get: vi.fn().mockReturnValue(returns) }) as unknown as ConfigService;

describe('readNumericEnv', () => {
  it('returns a number when env holds a numeric string', () => {
    expect(
      readNumericEnv({
        configService: stubConfig('500'),
        key: 'X',
        fallback: 7,
      }),
    ).toBe(500);
  });

  it('returns the number as-is when ConfigService already returns a number', () => {
    expect(
      readNumericEnv({ configService: stubConfig(42), key: 'X', fallback: 7 }),
    ).toBe(42);
  });

  it('falls back when env is undefined', () => {
    expect(
      readNumericEnv({
        configService: stubConfig(undefined),
        key: 'X',
        fallback: 7,
      }),
    ).toBe(7);
  });

  it('falls back when env is an empty string', () => {
    expect(
      readNumericEnv({ configService: stubConfig(''), key: 'X', fallback: 7 }),
    ).toBe(7);
  });

  it('falls back when env is a non-numeric string', () => {
    expect(
      readNumericEnv({
        configService: stubConfig('abc'),
        key: 'X',
        fallback: 7,
      }),
    ).toBe(7);
  });

  it('falls back when env is a NaN number', () => {
    expect(
      readNumericEnv({
        configService: stubConfig(Number.NaN),
        key: 'X',
        fallback: 7,
      }),
    ).toBe(7);
  });
});
