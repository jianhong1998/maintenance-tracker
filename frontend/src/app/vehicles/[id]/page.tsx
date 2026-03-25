import type { PageContext } from '@/types/page-context.type';
import { VehicleDashboardPage } from '@/components/pages/vehicle-dashboard-page';

type Props = PageContext<{ id: string }>;

export default async function VehiclePage({ params }: Props) {
  const { id } = await params;
  return <VehicleDashboardPage vehicleId={id} />;
}
