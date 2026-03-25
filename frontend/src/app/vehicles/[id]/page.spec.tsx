import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import VehiclePage from '@/app/vehicles/[id]/page';

vi.mock('@/components/pages/vehicle-dashboard-page', () => ({
  VehicleDashboardPage: ({ vehicleId }: { vehicleId: string }) => (
    <div data-testid="dashboard">{vehicleId}</div>
  ),
}));

describe('VehiclePage', () => {
  it('renders VehicleDashboardPage with the vehicleId from params', async () => {
    const component = await VehiclePage({
      params: Promise.resolve({ id: 'abc' }),
      searchParams: Promise.resolve({}),
    });
    render(component);

    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard')).toHaveTextContent('abc');
  });
});
