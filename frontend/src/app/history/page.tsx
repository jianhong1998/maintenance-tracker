'use client';

import { AuthGuard } from '@/components/auth/auth-guard';
import { FeatureFlagGuard } from '@/components/auth/feature-flag-guard';

const HistoryContent = () => (
  <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
    <p className="text-eyebrow mb-2">HISTORY</p>
    <p className="text-[color:var(--text-muted)] text-sm">Coming soon.</p>
  </main>
);

export default function HistoryPage() {
  return (
    <AuthGuard>
      <FeatureFlagGuard flagKey="enableHistory">
        <HistoryContent />
      </FeatureFlagGuard>
    </AuthGuard>
  );
}
