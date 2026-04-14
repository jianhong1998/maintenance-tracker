import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { ConfigProvider } from '@/components/providers/config-provider';
import { ReactQueryProvider } from '@/components/providers/react-query-provider';
import { AuthProvider } from '@/components/providers/auth-provider';
import { AppShell } from '@/components/layout/app-shell';
import './globals.css';

// Prevent static pre-rendering: process.env.FRONTEND_BACKEND_BASE_URL must be
// read at request time from the container environment, not baked in at build time.
export const dynamic = 'force-dynamic';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Maintenance Tracker',
  description: 'Track your vehicle maintenance schedules',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const backendUrl =
    process.env.FRONTEND_BACKEND_BASE_URL ?? 'http://localhost:3001';

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>
        <ConfigProvider backendUrl={backendUrl}>
          <ReactQueryProvider>
            <AuthProvider>
              <AppShell>{children}</AppShell>
            </AuthProvider>
          </ReactQueryProvider>
        </ConfigProvider>
        <Toaster
          position="top-right"
          duration={5000}
          theme="dark"
        />
      </body>
    </html>
  );
}
