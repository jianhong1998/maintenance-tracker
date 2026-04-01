import { describe, it, expect } from 'vitest';
import { dateTransformer } from './date.transformer';

describe('dateTransformer', () => {
  describe('.from (DB → JS)', () => {
    it('converts a YYYY-MM-DD string to a Date instance', () => {
      const result: Date | null = dateTransformer.from(
        '2026-04-01',
      ) as Date | null;
      expect(result).toBeInstanceOf(Date);
    });

    it('preserves the calendar date when converting from string', () => {
      const result = dateTransformer.from('2026-04-01') as Date;
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(3); // April = 3 (0-indexed)
      expect(result.getDate()).toBe(1);
    });

    it('returns null when DB value is null', () => {
      expect(dateTransformer.from(null)).toBeNull();
    });

    it('returns a value on which getTime() can be called', () => {
      const result = dateTransformer.from('2026-04-01') as Date;
      expect(() => result.getTime()).not.toThrow();
    });
  });

  describe('.to (JS → DB)', () => {
    it('passes a Date object through unchanged', () => {
      const date = new Date('2026-04-01');
      expect(dateTransformer.to(date)).toBe(date);
    });

    it('passes null through unchanged', () => {
      expect(dateTransformer.to(null)).toBeNull();
    });
  });
});
