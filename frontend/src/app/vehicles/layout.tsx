import type { ReactNode } from 'react';
import { VehiclesLayout } from '@/components/layout/vehicles-layout';

export default function VehiclesSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <VehiclesLayout>{children}</VehiclesLayout>;
}
