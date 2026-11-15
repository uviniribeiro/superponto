import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const jakarta = localFont({ src: './fonts/plus-jakarta-sans-latin.woff2', variable: '--font-jakarta', display: 'swap' });
const syne = localFont({ src: './fonts/syne-latin.woff2', variable: '--font-syne', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'SuperPonto', template: '%s · SuperPonto' },
  description: 'Gestão de pessoas, jornadas, ponto eletrônico, escalas e equipamentos.',
  applicationName: 'SuperPonto',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#07080a' },
    { media: '(prefers-color-scheme: light)', color: '#eef0f3' },
  ],
};

// Aplica o tema salvo antes da pintura (evita piscar ao carregar).
const themeScript = `try{var t=localStorage.getItem('sp-theme');if(t==='light')document.documentElement.dataset.theme='light'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${jakarta.variable} ${syne.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <div className="app-backdrop" aria-hidden />
        {children}
      </body>
    </html>
  );
}
