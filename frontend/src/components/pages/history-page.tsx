import type { FC } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';

export const HistoryPage: FC = () => {
  return (
    <AuthGuard>
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="text-eyebrow mb-2">HISTORY</p>
        <p className="text-[color:var(--text-muted)] text-sm">Coming soon.</p>
      </main>
    </AuthGuard>
  );
};
