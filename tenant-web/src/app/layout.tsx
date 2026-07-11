import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Vendorly Marketplace',
  description: 'Your local food marketplace.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
