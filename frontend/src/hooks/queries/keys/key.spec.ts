import { describe, it, expect } from 'vitest';
import { QueryGroup } from './key';

describe('QueryGroup', () => {
  it('should be frozen (immutable)', () => {
    expect(Object.isFrozen(QueryGroup)).toBe(true);
  });

  it('should contain FEATURE_FLAG key', () => {
    expect(QueryGroup.FEATURE_FLAG).toBe('feature-flag');
  });
});
