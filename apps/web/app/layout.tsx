import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { DensityProvider } from '@/lib/providers/DensityProvider';
import { QueryProvider } from '@/lib/query-client';
import './globals.css';

export const metadata: Metadata = {
  title: 'datos.nicoholas.dev',
  description: 'Planificación de mantenimiento preventivo',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
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
