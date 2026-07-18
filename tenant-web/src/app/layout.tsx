import type { Metadata } from 'next';

import '../lib/env-guard';
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
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#0B1228" />
      </head>
      <body className="bg-[#0B1228] text-zinc-50 antialiased">{children}</body>
    </html>
  );
}
