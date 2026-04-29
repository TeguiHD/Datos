import type { Metadata } from 'next';
import { IBM_Plex_Mono, Sora } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { DensityProvider } from '@/lib/providers/DensityProvider';
import { QueryProvider } from '@/lib/query-client';
import './globals.css';

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  weight: ['400', '500', '600', '700'],
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-plex-mono',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'datos.nicoholas.dev',
  description: 'Planificación de mantenimiento preventivo',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${sora.variable} ${plexMono.variable}`}>
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
