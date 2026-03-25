import { describe, it, expect } from 'vitest';
import { QueryGroup } from './key';

describe('QueryGroup', () => {
  it('should be frozen (immutable)', () => {
    expect(Object.isFrozen(QueryGroup)).toBe(true);
  });
});
