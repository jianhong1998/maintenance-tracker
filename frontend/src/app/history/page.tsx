'use client';

import { AuthGuard } from '@/components/auth/auth-guard';
import { FeatureFlagGuard } from '@/components/auth/feature-flag-guard';
import { HistoryPage as HistoryPageContent } from '@/components/pages/history-page';

export default function HistoryPage() {
  return (
    <AuthGuard>
      <FeatureFlagGuard flagKey="enableHistory">
        <HistoryPageContent />
      </FeatureFlagGuard>
    </AuthGuard>
  );
}
