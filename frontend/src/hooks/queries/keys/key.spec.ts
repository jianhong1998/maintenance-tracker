import { describe, it, expect } from 'vitest';
import { QueryGroup } from './key';

describe('QueryGroup', () => {
  it('should have HEALTH_CHECK equal to "health-check"', () => {
    expect(QueryGroup.HEALTH_CHECK).toBe('health-check');
  });

  it('should have CONFIG equal to "config"', () => {
    expect(QueryGroup.CONFIG).toBe('config');
  });

  it('should have VEHICLES equal to "vehicles"', () => {
    expect(QueryGroup.VEHICLES).toBe('vehicles');
  });

  it('should have MAINTENANCE_CARDS equal to "maintenance-cards"', () => {
    expect(QueryGroup.MAINTENANCE_CARDS).toBe('maintenance-cards');
  });
});
