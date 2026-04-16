'use client';

import { AuthGuard } from '@/components/auth/auth-guard';
import { FeatureFlagGuard } from '@/components/auth/feature-flag-guard';
import { ProfilePage as ProfilePageContent } from '@/components/pages/profile-page';

export default function ProfilePage() {
  return (
    <AuthGuard>
      <FeatureFlagGuard flagKey="enableProfile">
        <ProfilePageContent />
      </FeatureFlagGuard>
    </AuthGuard>
  );
}
