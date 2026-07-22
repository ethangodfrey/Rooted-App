import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import {
  countNetworkMetrics,
  listV2vConnections,
  type V2vConnectionRow,
} from '@/lib/v2v-connections';
import {
  VendorFormPanel,
  VendorListPanel,
  VendorListRow,
  VendorSection,
} from '@/components/vendor/vendor-ui';

interface WholesalePeerProduct {
  id: string;
  name: string;
  price_cents: number | null;
  vendor_id: string;
  vendor_name: string;
}

/**
 * Phase 83b — network metrics + connected-peer wholesale listings on vendor profile.
 */
export function VendorNetworkPanel() {
  const { vendor } = useAuth();
  const vendorId = vendor?.id;
  const [rows, setRows] = useState<V2vConnectionRow[]>([]);
  const [products, setProducts] = useState<WholesalePeerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!vendorId) {
      setLoading(false);
      return;
    }

    void (async () => {
      setLoading(true);
      try {
        const connections = await listV2vConnections();
        if (!active) return;
        setRows(connections);

        const peerIds = connections
          .filter((r) => r.status === 'connected')
          .map((r) => (r.senderId === vendorId ? r.receiverId : r.senderId));

        if (peerIds.length === 0) {
          setProducts([]);
          setError(null);
          return;
        }

        const { data, error: productError } = await supabase
          .from('products')
          .select('id, name, price_cents, vendor_id, vendors(business_name)')
          .in('vendor_id', peerIds)
          .eq('visibility', 'connected_vendors')
          .eq('status', 'active')
          .limit(24);

        if (productError) throw new Error(productError.message);
        if (!active) return;

        const mapped: WholesalePeerProduct[] = (data ?? []).map((row) => {
          const vendors = row.vendors as
            | { business_name: string | null }
            | { business_name: string | null }[]
            | null;
          const vendorName = Array.isArray(vendors)
            ? vendors[0]?.business_name
            : vendors?.business_name;
          return {
            id: row.id as string,
            name: row.name as string,
            price_cents: (row.price_cents as number | null) ?? null,
            vendor_id: row.vendor_id as string,
            vendor_name: vendorName?.trim() || 'Connected vendor',
          };
        });
        setProducts(mapped);
        setError(null);
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load network');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [vendorId]);

  const metrics = useMemo(
    () => (vendorId ? countNetworkMetrics(rows, vendorId) : null),
    [rows, vendorId],
  );

  if (!vendorId) return null;

  return (
    <>
      <VendorSection title="Network">
        {loading ? (
          <p className="ft-subhead">Loading network metrics…</p>
        ) : error ? (
          <p className="app-error">{error}</p>
        ) : (
          <VendorFormPanel>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Connections
                </p>
                <p className="m-0 mt-1 font-mono text-xl font-semibold tabular-nums text-stone-900">
                  {metrics?.connections ?? 0}
                </p>
              </div>
              <div>
                <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Following
                </p>
                <p className="m-0 mt-1 font-mono text-xl font-semibold tabular-nums text-stone-900">
                  {metrics?.following ?? 0}
                </p>
              </div>
              <div>
                <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Incoming
                </p>
                <p className="m-0 mt-1 font-mono text-xl font-semibold tabular-nums text-stone-900">
                  {metrics?.pendingIncoming ?? 0}
                </p>
              </div>
            </div>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-stone-500">
              V2V_NETWORK_ACTIVE
            </p>
            <Link
              to="/vendor/network"
              className="mt-3 inline-flex text-sm font-semibold text-orange-600 no-underline hover:text-orange-500"
            >
              Open business network
            </Link>
          </VendorFormPanel>
        )}
      </VendorSection>

      <VendorSection title="Peer wholesale">
        {loading ? (
          <p className="ft-subhead">Loading peer catalog…</p>
        ) : products.length === 0 ? (
          <VendorFormPanel>
            <p className="m-0 text-sm text-stone-600">
              Connected peers with bulk / wholesale visibility will appear here.
            </p>
          </VendorFormPanel>
        ) : (
          <VendorListPanel>
            {products.map((product) => (
              <VendorListRow
                key={product.id}
                to={`/vendors/${product.vendor_id}`}
                title={product.name}
                subtitle={`${product.vendor_name}${
                  product.price_cents != null ? ` · ${formatPrice(product.price_cents)}` : ''
                }`}
                icon="package"
                tone="orange"
              />
            ))}
          </VendorListPanel>
        )}
      </VendorSection>
    </>
  );
}
