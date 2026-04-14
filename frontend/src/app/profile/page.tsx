'use client';

import { AuthGuard } from '@/components/auth/auth-guard';

const ProfileContent = () => (
  <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
    <p className="text-eyebrow mb-2">PROFILE</p>
    <p className="text-[color:var(--text-muted)] text-sm">Coming soon.</p>
  </main>
);

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  );
}
