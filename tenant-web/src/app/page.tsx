import Link from 'next/link';

export default function PlatformHomePage() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 720 }}>
      <h1>Vendorly Marketplace</h1>
      <p>Platform home — tenant marketplaces are served on custom domains or subdomains.</p>
      <p>
        Example: <code>market-a.rooted.app</code> or <code>market-a.com</code>
      </p>
      <p>
        <Link href="/tenant-error?reason=not_found&host=unknown.example">Tenant error page preview</Link>
      </p>
    </main>
  );
}
