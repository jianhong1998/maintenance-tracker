import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { ConfigProvider } from '@/components/providers/config-provider';
import { ReactQueryProvider } from '@/components/providers/react-query-provider';
import { AuthProvider } from '@/components/providers/auth-provider';
import './globals.css';

// Prevent static pre-rendering: process.env.FRONTEND_BACKEND_BASE_URL must be
// read at request time from the container environment, not baked in at build time.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Maintenance Tracker',
  description: 'Track your vehicle maintenance schedules',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const backendUrl =
    process.env.FRONTEND_BACKEND_BASE_URL ?? 'http://localhost:3001';

  return (
    <html lang="en">
      <body>
        <ConfigProvider backendUrl={backendUrl}>
          <ReactQueryProvider>
            <AuthProvider>{children}</AuthProvider>
          </ReactQueryProvider>
        </ConfigProvider>
        <Toaster
          position="top-right"
          duration={5000}
        />
      </body>
    </html>
  );
}
