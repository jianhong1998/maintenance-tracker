'use client';

import { AuthGuard } from '@/components/auth/auth-guard';

export function HomePage() {
  return (
    <AuthGuard>
      <main className="p-6">
        <h1 className="text-xl font-semibold">Home</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your vehicles will appear here.
        </p>
      </main>
    </AuthGuard>
  );
}
