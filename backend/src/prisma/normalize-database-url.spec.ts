import { describeDatabaseTarget, normalizeDatabaseUrl } from './normalize-database-url';

describe('normalizeDatabaseUrl', () => {
  it('adds pgbouncer + connection_limit for Supabase transaction pooler', () => {
    const raw =
      'postgresql://postgres.ref:secret@aws-1-us-east-2.pooler.supabase.com:6543/postgres';
    const normalized = normalizeDatabaseUrl(raw)!;
    const url = new URL(normalized);
    expect(url.searchParams.get('pgbouncer')).toBe('true');
    expect(url.searchParams.get('connection_limit')).toBe('5');
    expect(url.searchParams.get('connect_timeout')).toBe('15');
  });

  it('strips sslmode=require which breaks some pooler TLS stacks', () => {
    const raw =
      'postgresql://postgres.ref:secret@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require';
    const normalized = normalizeDatabaseUrl(raw)!;
    const url = new URL(normalized);
    expect(url.searchParams.get('sslmode')).toBeNull();
    expect(url.searchParams.get('pgbouncer')).toBe('true');
  });

  it('leaves direct 5432 URLs without forcing pgbouncer', () => {
    const raw = 'postgresql://postgres:secret@db.ref.supabase.co:5432/postgres';
    const normalized = normalizeDatabaseUrl(raw)!;
    const url = new URL(normalized);
    expect(url.searchParams.get('pgbouncer')).toBeNull();
    expect(url.searchParams.get('connect_timeout')).toBe('15');
  });
});

describe('describeDatabaseTarget', () => {
  it('redacts credentials', () => {
    expect(
      describeDatabaseTarget(
        'postgresql://postgres.ref:supersecret@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true',
      ),
    ).toBe('aws-1-us-east-2.pooler.supabase.com:6543/postgres');
  });
});
