import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { useWholesaleCatalog } from '@/src/hooks/use-wholesale-catalog';
import { useWholesaleOrder } from '@/src/hooks/use-wholesale-order';
import {
  evaluateWholesalePricing,
  formatUsdFromCents,
} from '@/src/lib/b2b/pricing';
import type { WholesaleProductRow } from '@/src/lib/b2b/types';
import { colors } from '@/src/theme/colors';

type QtyMap = Record<string, number>;
type OrderDraft = Record<string, number>;

export type WholesaleOrderEntryScreenProps = {
  /** Optional peer seller from deep link / partner profile. */
  initialSellerVendorId?: string | null;
};

/**
 * Touch-optimized wholesale order entry for buyers in the field.
 * Mirrors tenant-web draft → ORDER_DRAFT_INITIALIZED → invoice pipeline.
 */
export function WholesaleOrderEntryScreen({
  initialSellerVendorId = null,
}: WholesaleOrderEntryScreenProps) {
  const { vendor } = useAuth();
  const buyerVendorId = vendor?.id ?? null;

  const [sellerInput, setSellerInput] = useState(initialSellerVendorId?.trim() ?? '');
  const [activeSellerId, setActiveSellerId] = useState(
    initialSellerVendorId?.trim() || null,
  );
  const [qtyBySku, setQtyBySku] = useState<QtyMap>({});
  const [orderDraft, setOrderDraft] = useState<OrderDraft>({});
  const [orderMessage, setOrderMessage] = useState<string | null>(null);

  const {
    loading,
    error: catalogError,
    products,
    vendorName,
    sessionVendorId,
    resolvedSellerId,
    fromCache,
    reload,
  } = useWholesaleCatalog({ sellerVendorId: activeSellerId });

  const sellerVendorId = resolvedSellerId ?? activeSellerId;
  const effectiveBuyerId = sessionVendorId ?? buyerVendorId;

  const {
    canDispatch,
    submitting,
    error: draftError,
    status: draftStatus,
    order: initializedOrder,
    initializeOrder,
  } = useWholesaleOrder({
    buyerVendorId: effectiveBuyerId,
    sellerVendorId,
  });

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('MOBILE_ORDER_INTERFACE_READY');
  }, []);

  useEffect(() => {
    if (products.length === 0) return;
    setQtyBySku((prev) => {
      const next: QtyMap = { ...prev };
      for (const product of products) {
        if (next[product.ID] == null) {
          next[product.ID] = Number(product.MOQ) || 1;
        }
      }
      return next;
    });
  }, [products]);

  const rows = useMemo(() => {
    return products.map((product) => {
      const moq = Number(product.MOQ) || 1;
      const qty = qtyBySku[product.ID] ?? moq;
      const priced = evaluateWholesalePricing({
        quantity: qty,
        moq,
        baseUnitPriceCents: product.UNIT_PRICE_CENTS,
        tiersRaw: product.PRICING_TIERS,
      });
      return { product, priced, moq };
    });
  }, [products, qtyBySku]);

  const runningTotalCents = useMemo(() => {
    return rows.reduce((sum, row) => {
      const drafted = orderDraft[row.product.ID];
      if (drafted == null) return sum;
      const evaled = evaluateWholesalePricing({
        quantity: drafted,
        moq: row.moq,
        baseUnitPriceCents: row.product.UNIT_PRICE_CENTS,
        tiersRaw: row.product.PRICING_TIERS,
      });
      return sum + evaled.lineTotalCents;
    }, 0);
  }, [orderDraft, rows]);

  const queuedLines = useMemo(() => {
    return rows
      .filter((row) => orderDraft[row.product.ID] != null)
      .map((row) => ({
        product: row.product,
        quantity: orderDraft[row.product.ID]!,
      }));
  }, [orderDraft, rows]);

  const loadSellerCatalog = useCallback(() => {
    const next = sellerInput.trim();
    if (!next) {
      setOrderMessage('SELLER_VENDOR_ID_REQUIRED');
      return;
    }
    setOrderDraft({});
    setOrderMessage(null);
    setActiveSellerId(next);
  }, [sellerInput]);

  const bumpQty = useCallback((product: WholesaleProductRow, delta: number) => {
    const moq = Number(product.MOQ) || 1;
    setQtyBySku((prev) => {
      const current = prev[product.ID] ?? moq;
      const next = Math.max(0, current + delta);
      return { ...prev, [product.ID]: next };
    });
    setOrderMessage(null);
  }, []);

  const setQtyExact = useCallback((product: WholesaleProductRow, raw: string) => {
    const parsed = Number(raw);
    const qty = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
    setQtyBySku((prev) => ({ ...prev, [product.ID]: qty }));
    setOrderMessage(null);
  }, []);

  const addLine = useCallback(
    (productId: string, qty: number, moqGuardActive: boolean) => {
      if (moqGuardActive || qty <= 0) {
        // eslint-disable-next-line no-console
        console.log(`MOQ_GUARD_ACTIVE SKU=${productId} ACTION=ADD_BLOCKED`);
        setOrderMessage('MOQ_GUARD_ACTIVE');
        return;
      }
      setOrderDraft((prev) => ({ ...prev, [productId]: qty }));
      setOrderMessage(`WHOLESALE_LINE_QUEUED SKU=${productId} QTY=${qty}`);
      // eslint-disable-next-line no-console
      console.log(`WHOLESALE_LINE_QUEUED SKU=${productId} QTY=${qty}`);
    },
    [],
  );

  const removeLine = useCallback((productId: string) => {
    setOrderDraft((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
    setOrderMessage(null);
  }, []);

  const onInitializeOrder = useCallback(async () => {
    if (queuedLines.length === 0) {
      setOrderMessage('WHOLESALE_ORDER_VALIDATION_ERROR: ITEMS REQUIRED');
      return;
    }
    const result = await initializeOrder(queuedLines);
    if (result?.STATUS === 'ORDER_DRAFT_INITIALIZED') {
      setOrderMessage(
        `ORDER_DRAFT_INITIALIZED ID=${result.ORDER?.ID ?? 'UNKNOWN'}`,
      );
      setOrderDraft({});
    } else if (!result) {
      setOrderMessage('WHOLESALE_ORDER_CREATE_FAILED');
    }
  }, [initializeOrder, queuedLines]);

  return (
    <Screen scroll>
      <Text variant="eyebrow" className="mb-2">
        Wholesale
      </Text>
      <Text variant="title" className="mb-1">
        Order entry
      </Text>
      <Text variant="caption" className="mb-4">
        Browse a supplier catalog and submit a draft that follows the same
        wholesale invoice path as web.
      </Text>

      <Card className="mb-4">
        <Text variant="caption" className="mb-1">
          Buyer
        </Text>
        <Text variant="body" className="mb-3">
          {vendor?.business_name ?? effectiveBuyerId ?? 'Not linked'}
        </Text>
        <Input
          label="Seller vendor ID"
          value={sellerInput}
          onChangeText={setSellerInput}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Paste supplier vendor UUID"
        />
        <Button
          label={loading ? 'Loading catalog' : 'Load catalog'}
          onPress={loadSellerCatalog}
          loading={loading}
          disabled={loading}
        />
        {fromCache ? (
          <Text variant="caption" className="mt-2" style={{ color: colors.muted }}>
            CATALOG_SOURCE=OFFLINE_CACHE
          </Text>
        ) : null}
        {vendorName ? (
          <Text variant="caption" className="mt-2">
            Supplier: {vendorName}
          </Text>
        ) : null}
      </Card>

      {catalogError ? (
        <Card className="mb-4">
          <Text variant="body" style={{ color: '#B91C1C' }}>
            {catalogError}
          </Text>
          <View className="mt-3">
            <Button label="Retry" variant="secondary" onPress={() => void reload()} />
          </View>
        </Card>
      ) : null}

      {loading && products.length === 0 ? (
        <View className="mb-4 items-center py-8">
          <LoadingIndicator />
        </View>
      ) : null}

      {!activeSellerId && !loading ? (
        <Card className="mb-4">
          <Text variant="body">
            Enter a seller vendor ID to load wholesale listings.
          </Text>
        </Card>
      ) : null}

      {rows.map(({ product, priced, moq }) => {
        const queued = orderDraft[product.ID] != null;
        return (
          <Card key={product.ID} className="mb-3">
            <Text variant="body" className="mb-1 font-semibold">
              {product.NAME}
            </Text>
            <Text variant="caption" className="mb-2">
              {product.PACKAGING_UNIT} · MOQ {moq} ·{' '}
              {formatUsdFromCents(product.UNIT_PRICE_CENTS)} base
            </Text>
            <Text variant="caption" className="mb-3">
              {priced.tierLabel} · {formatUsdFromCents(priced.unitPriceCents)} / unit
              {priced.moqGuardActive ? ' · MOQ_GUARD_ACTIVE' : ''}
            </Text>

            <View className="mb-3 flex-row items-center gap-3">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Decrease quantity"
                onPress={() => bumpQty(product, -1)}
                className="h-12 w-12 items-center justify-center rounded-xl bg-honeydew"
              >
                <Text variant="title" className="mb-0">
                  -
                </Text>
              </Pressable>
              <View className="min-w-[72px] flex-1">
                <Input
                  value={String(qtyBySku[product.ID] ?? moq)}
                  onChangeText={(text) => setQtyExact(product, text)}
                  keyboardType="number-pad"
                  className="mb-0"
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Increase quantity"
                onPress={() => bumpQty(product, 1)}
                className="h-12 w-12 items-center justify-center rounded-xl bg-honeydew"
              >
                <Text variant="title" className="mb-0">
                  +
                </Text>
              </Pressable>
            </View>

            <Text variant="caption" className="mb-3">
              Line {formatUsdFromCents(priced.lineTotalCents)}
            </Text>

            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button
                  label={queued ? 'Update line' : 'Add to order'}
                  onPress={() =>
                    addLine(product.ID, qtyBySku[product.ID] ?? moq, priced.moqGuardActive)
                  }
                  disabled={priced.moqGuardActive || (qtyBySku[product.ID] ?? 0) <= 0}
                />
              </View>
              {queued ? (
                <View className="flex-1">
                  <Button
                    label="Remove"
                    variant="secondary"
                    onPress={() => removeLine(product.ID)}
                  />
                </View>
              ) : null}
            </View>
          </Card>
        );
      })}

      <Card className="mb-4 mt-2">
        <Text variant="caption" className="mb-1">
          Draft total
        </Text>
        <Text variant="title" className="mb-2">
          {formatUsdFromCents(runningTotalCents)}
        </Text>
        <Text variant="caption" className="mb-3">
          {queuedLines.length} line{queuedLines.length === 1 ? '' : 's'} queued
          {!canDispatch ? ' · BUYER_SELLER_REQUIRED' : ''}
        </Text>
        <Button
          label={submitting ? 'Submitting draft' : 'Initialize order draft'}
          onPress={() => void onInitializeOrder()}
          loading={submitting}
          disabled={submitting || queuedLines.length === 0 || !canDispatch}
        />
        {orderMessage ? (
          <Text
            variant="caption"
            className="mt-3 font-mono"
            style={{ color: colors.soil }}
          >
            {orderMessage}
          </Text>
        ) : null}
        {draftError ? (
          <Text variant="caption" className="mt-2" style={{ color: '#B91C1C' }}>
            {draftError}
          </Text>
        ) : null}
        {draftStatus ? (
          <Text variant="caption" className="mt-2 font-mono">
            {draftStatus}
            {initializedOrder?.ID ? ` · ${initializedOrder.ID}` : ''}
          </Text>
        ) : null}
      </Card>
    </Screen>
  );
}
