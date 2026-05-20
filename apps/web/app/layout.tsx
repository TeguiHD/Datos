import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from 'next-themes';
import { DensityProvider } from '@/lib/providers/DensityProvider';
import { QueryProvider } from '@/lib/query-client';
import './globals.css';

export const metadata: Metadata = {
  title: 'datos.nicoholas.dev',
  description: 'Planificación de mantenimiento preventivo SAP-PM',
  manifest: '/manifest.webmanifest',
  applicationName: 'Datos PM',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Datos PM',
  },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          storageKey="datos-theme"
        >
          <DensityProvider>
            <QueryProvider>{children}</QueryProvider>
          </DensityProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
