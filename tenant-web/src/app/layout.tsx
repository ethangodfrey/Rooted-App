import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Vendorly Marketplace',
  description: 'Your local food marketplace.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-zinc-50/40 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-50">
        {children}
      </body>
    </html>
  );
}
