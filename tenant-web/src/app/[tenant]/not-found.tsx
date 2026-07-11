import Link from 'next/link';

export default function TenantNotFound() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 640 }}>
      <h1>Marketplace not found</h1>
      <p>The tenant segment in this URL does not match an active marketplace.</p>
      <p>
        <Link href="/">Return to platform home</Link>
      </p>
    </main>
  );
}
