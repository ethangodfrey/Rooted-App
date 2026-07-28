import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { FieldError } from '@/components/ui/FieldError';
import {
  VendorFormPanel,
  VendorHero,
  VendorPrimaryButton,
  VendorScreen,
  VendorSection,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import {
  isVendorPersona,
  VENDOR_PERSONA_OPTIONS,
  type VendorPersona,
  vendorTypeLabel,
} from '@/lib/vendor-types';
import '@/components/ui/ui.css';

/**
 * Dynamic fulfillment / service settings — `/vendor/settings/fulfillment`.
 * Home Chef: pickup + delivery radius + cottage food disclosure.
 * Private Chef: travel radius, base rate, minimum guests.
 * Micro-Brand: nationwide flat-rate shipping.
 */
export function VendorFulfillmentSettingsPage() {
  const { vendor, refreshUser } = useAuth();
  const [vendorType, setVendorType] = useState<VendorPersona | null>(
    isVendorPersona(vendor?.vendor_type) ? vendor.vendor_type : null,
  );
  const [streetAddress, setStreetAddress] = useState(vendor?.street_address ?? '');
  const [servesDelivery, setServesDelivery] = useState(Boolean(vendor?.serves_delivery));
  const [deliveryRadius, setDeliveryRadius] = useState(
    vendor?.delivery_radius_miles != null ? String(vendor.delivery_radius_miles) : '',
  );
  const [minimumOrder, setMinimumOrder] = useState(
    vendor?.minimum_order_amount != null ? (vendor.minimum_order_amount / 100).toFixed(2) : '',
  );
  const [cottageDisclosure, setCottageDisclosure] = useState(
    vendor?.cottage_food_disclosure ?? '',
  );
  const [baseRate, setBaseRate] = useState(
    vendor?.base_service_rate_cents != null
      ? (vendor.base_service_rate_cents / 100).toFixed(2)
      : '',
  );
  const [minGuests, setMinGuests] = useState(
    vendor?.minimum_guest_count != null ? String(vendor.minimum_guest_count) : '',
  );
  const [shippingEnabled, setShippingEnabled] = useState(Boolean(vendor?.shipping_enabled));
  const [flatShipping, setFlatShipping] = useState(
    vendor?.flat_rate_shipping_fee_cents != null
      ? (vendor.flat_rate_shipping_fee_cents / 100).toFixed(2)
      : '',
  );
  const [freeShipMin, setFreeShipMin] = useState(
    vendor?.free_shipping_minimum_cents != null
      ? (vendor.free_shipping_minimum_cents / 100).toFixed(2)
      : '',
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<
      Record<
        | 'deliveryRadius'
        | 'minimumOrder'
        | 'baseRate'
        | 'minGuests'
        | 'flatShipping'
        | 'freeShipMin',
        string
      >
    >
  >({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  function clearFieldError(field: keyof typeof fieldErrors) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  const load = useCallback(async () => {
    if (!vendor?.id) {
      setLoading(false);
      return;
    }
    const { data, error: qError } = await supabase
      .from('vendors')
      .select(
        `vendor_type, street_address, serves_delivery, delivery_radius_miles, minimum_order_amount,
         cottage_food_disclosure, base_service_rate_cents, minimum_guest_count,
         shipping_enabled, flat_rate_shipping_fee_cents, free_shipping_minimum_cents`,
      )
      .eq('id', vendor.id)
      .maybeSingle();

    if (qError) {
      setError(qError.message);
      setLoading(false);
      return;
    }

    if (data) {
      setVendorType(
        isVendorPersona(data.vendor_type as string | null)
          ? (data.vendor_type as VendorPersona)
          : null,
      );
      setStreetAddress((data.street_address as string | null) ?? '');
      setServesDelivery(Boolean(data.serves_delivery));
      setDeliveryRadius(
        data.delivery_radius_miles != null ? String(data.delivery_radius_miles as number) : '',
      );
      setMinimumOrder(
        data.minimum_order_amount != null
          ? ((data.minimum_order_amount as number) / 100).toFixed(2)
          : '',
      );
      setCottageDisclosure((data.cottage_food_disclosure as string | null) ?? '');
      setBaseRate(
        data.base_service_rate_cents != null
          ? ((data.base_service_rate_cents as number) / 100).toFixed(2)
          : '',
      );
      setMinGuests(
        data.minimum_guest_count != null ? String(data.minimum_guest_count as number) : '',
      );
      setShippingEnabled(Boolean(data.shipping_enabled));
      setFlatShipping(
        data.flat_rate_shipping_fee_cents != null
          ? ((data.flat_rate_shipping_fee_cents as number) / 100).toFixed(2)
          : '',
      );
      setFreeShipMin(
        data.free_shipping_minimum_cents != null
          ? ((data.free_shipping_minimum_cents as number) / 100).toFixed(2)
          : '',
      );
    }
    setLoading(false);
  }, [vendor?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSavePersona(next: VendorPersona) {
    if (!vendor?.id) return;
    setVendorType(next);
    const { error: upError } = await supabase
      .from('vendors')
      .update({ vendor_type: next, updated_at: new Date().toISOString() })
      .eq('id', vendor.id);
    if (upError) setError(upError.message);
    else void refreshUser();
  }

  async function handleSave() {
    if (!vendor?.id) return;
    setSaving(true);
    setError(null);
    setSaveMessage(null);

    const radius = deliveryRadius.trim() ? Number(deliveryRadius) : null;
    const minOrderDollars = minimumOrder.trim() ? Number(minimumOrder) : null;
    const rateDollars = baseRate.trim() ? Number(baseRate) : null;
    const guests = minGuests.trim() ? Number(minGuests) : null;
    const flatShipDollars = flatShipping.trim() ? Number(flatShipping) : null;
    const freeMinDollars = freeShipMin.trim() ? Number(freeShipMin) : null;

    const nextFieldErrors: typeof fieldErrors = {};

    if (deliveryRadius.trim() && (!Number.isFinite(radius) || (radius as number) < 0)) {
      nextFieldErrors.deliveryRadius = 'Radius must be a non-negative number.';
    }
    if (minimumOrder.trim() && (!Number.isFinite(minOrderDollars) || (minOrderDollars as number) < 0)) {
      nextFieldErrors.minimumOrder = 'Enter a valid dollar amount (e.g. 25.00).';
    }
    if (baseRate.trim() && (!Number.isFinite(rateDollars) || (rateDollars as number) < 0)) {
      nextFieldErrors.baseRate = 'Enter a valid service rate (e.g. 150.00).';
    }
    if (minGuests.trim() && (!Number.isFinite(guests) || (guests as number) < 1)) {
      nextFieldErrors.minGuests = 'Minimum guest count must be at least 1.';
    }
    if (flatShipping.trim() && (!Number.isFinite(flatShipDollars) || (flatShipDollars as number) < 0)) {
      nextFieldErrors.flatShipping = 'Enter a valid shipping fee (e.g. 8.00).';
    }
    if (freeShipMin.trim() && (!Number.isFinite(freeMinDollars) || (freeMinDollars as number) < 0)) {
      nextFieldErrors.freeShipMin = 'Enter a valid order minimum (e.g. 75.00).';
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setSaving(false);
      return;
    }

    setFieldErrors({});

    const payload: Record<string, unknown> = {
      street_address: streetAddress.trim() || null,
      serves_delivery: servesDelivery,
      delivery_radius_miles: radius,
      minimum_order_amount:
        minOrderDollars != null ? Math.round((minOrderDollars as number) * 100) : null,
      cottage_food_disclosure: cottageDisclosure.trim() || null,
      base_service_rate_cents:
        rateDollars != null ? Math.round((rateDollars as number) * 100) : null,
      minimum_guest_count: guests,
      shipping_enabled: shippingEnabled,
      flat_rate_shipping_fee_cents:
        flatShipDollars != null ? Math.round((flatShipDollars as number) * 100) : null,
      free_shipping_minimum_cents:
        freeMinDollars != null ? Math.round((freeMinDollars as number) * 100) : null,
      updated_at: new Date().toISOString(),
    };

    const { error: upError } = await supabase.from('vendors').update(payload).eq('id', vendor.id);
    setSaving(false);
    if (upError) {
      setError(upError.message);
      return;
    }
    setSaveMessage('Fulfillment settings saved.');
    void refreshUser();
  }

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-spinner" />
      </div>
    );
  }

  const persona = isVendorPersona(vendorType) ? vendorType : null;
  const typeLabel = vendorTypeLabel(vendorType) ?? 'Not set';

  return (
    <VendorScreen>
      <Link to="/vendor/dashboard" className="app-back-link">
        ← Dashboard
      </Link>
      <VendorHero
        eyebrow="Fulfillment"
        title="Service settings"
        subtitle="Configure pickup, delivery, or private dining details for how shoppers book you."
        pill={typeLabel}
      />

      {error ? <p className="app-error mb-4">{error}</p> : null}
      {saveMessage ? (
        <p className="mb-4 text-sm font-semibold text-orange-400" role="status">
          {saveMessage}
        </p>
      ) : null}

      <VendorSection title="Vendor type">
        <div className="grid gap-2 sm:grid-cols-2">
          {VENDOR_PERSONA_OPTIONS.map((option) => {
            const selected = persona === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => void handleSavePersona(option.value)}
                aria-pressed={selected}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  selected
                    ? 'border-orange-500/55 bg-orange-500/15'
                    : 'border-white/10 bg-[#121A36] hover:border-white/20'
                }`}
              >
                <span className="text-sm font-bold text-white">{option.title}</span>
                <p className="mt-1 text-xs text-white/55">{option.description}</p>
              </button>
            );
          })}
        </div>
        {!persona ? (
          <p className="mt-3 text-sm text-white/55">
            Choose a type above, or start from{' '}
            <Link to="/vendor/onboarding" className="text-orange-400 underline">
              onboarding
            </Link>
            .
          </p>
        ) : null}
      </VendorSection>

      {persona === 'home_kitchen' ? (
        <VendorSection title="Home Chef fulfillment">
          <VendorFormPanel className="!bg-[#121A36] !text-zinc-50">
            <label className="mb-4 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <span>
                <span className="block text-sm font-bold text-white">Offer local pickup</span>
                <span className="mt-0.5 block text-xs text-white/55">
                  Shoppers collect orders at your kitchen address.
                </span>
              </span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-orange-500"
                checked={Boolean(streetAddress.trim())}
                onChange={(e) => {
                  if (!e.target.checked) setStreetAddress('');
                }}
                aria-label="Offer local pickup"
              />
            </label>

            <div className="app-input-group">
              <label className="!text-white/80">Local pickup address</label>
              <input
                className="app-input"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                placeholder="123 Kitchen Lane, City"
              />
            </div>

            <label className="mb-4 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <span>
                <span className="block text-sm font-bold text-white">Local delivery</span>
                <span className="mt-0.5 block text-xs text-white/55">
                  Enable delivery within a radius with optional minimum order.
                </span>
              </span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-orange-500"
                checked={servesDelivery}
                onChange={(e) => setServesDelivery(e.target.checked)}
              />
            </label>

            {servesDelivery ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="app-input-group">
                  <label className="!text-white/80">Local delivery radius (miles)</label>
                  <input
                    className={`app-input${fieldErrors.deliveryRadius ? ' app-input--invalid' : ''}`}
                    inputMode="numeric"
                    value={deliveryRadius}
                    aria-invalid={Boolean(fieldErrors.deliveryRadius)}
                    onChange={(e) => {
                      setDeliveryRadius(e.target.value);
                      clearFieldError('deliveryRadius');
                    }}
                    placeholder="10"
                  />
                  <FieldError message={fieldErrors.deliveryRadius} />
                </div>
                <div className="app-input-group">
                  <label className="!text-white/80">Minimum order ($)</label>
                  <input
                    className={`app-input${fieldErrors.minimumOrder ? ' app-input--invalid' : ''}`}
                    inputMode="decimal"
                    value={minimumOrder}
                    aria-invalid={Boolean(fieldErrors.minimumOrder)}
                    onChange={(e) => {
                      setMinimumOrder(e.target.value);
                      clearFieldError('minimumOrder');
                    }}
                    placeholder="25.00"
                  />
                  <FieldError message={fieldErrors.minimumOrder} />
                </div>
              </div>
            ) : null}

            <div className="app-input-group">
              <label className="!text-white/80">Cottage Food License / Disclosure</label>
              <textarea
                className="app-textarea"
                rows={4}
                value={cottageDisclosure}
                onChange={(e) => setCottageDisclosure(e.target.value)}
                placeholder="Required state cottage-food disclaimer shown on your product pages…"
              />
              <p className="mt-1 text-xs text-white/45">
                Appended on Explore menu and product pages so shoppers see the legal disclosure.
              </p>
            </div>

            <VendorPrimaryButton disabled={saving} onClick={() => void handleSave()}>
              {saving ? 'Saving…' : 'Save fulfillment settings'}
            </VendorPrimaryButton>
          </VendorFormPanel>
        </VendorSection>
      ) : null}

      {persona === 'private_chef' ? (
        <VendorSection title="Private Chef service settings">
          <VendorFormPanel className="!bg-[#121A36] !text-zinc-50">
            <div className="app-input-group">
              <label className="!text-white/80">Travel radius (miles)</label>
              <input
                className={`app-input${fieldErrors.deliveryRadius ? ' app-input--invalid' : ''}`}
                inputMode="numeric"
                value={deliveryRadius}
                aria-invalid={Boolean(fieldErrors.deliveryRadius)}
                onChange={(e) => {
                  setDeliveryRadius(e.target.value);
                  clearFieldError('deliveryRadius');
                }}
                placeholder="25"
              />
              <FieldError message={fieldErrors.deliveryRadius} />
            </div>
            <div className="app-input-group">
              <label className="!text-white/80">Base service rate ($)</label>
              <input
                className={`app-input${fieldErrors.baseRate ? ' app-input--invalid' : ''}`}
                inputMode="decimal"
                value={baseRate}
                aria-invalid={Boolean(fieldErrors.baseRate)}
                onChange={(e) => {
                  setBaseRate(e.target.value);
                  clearFieldError('baseRate');
                }}
                placeholder="150.00"
              />
              <FieldError message={fieldErrors.baseRate} />
            </div>
            <div className="app-input-group">
              <label className="!text-white/80">Minimum guest count</label>
              <input
                className={`app-input${fieldErrors.minGuests ? ' app-input--invalid' : ''}`}
                inputMode="numeric"
                value={minGuests}
                aria-invalid={Boolean(fieldErrors.minGuests)}
                onChange={(e) => {
                  setMinGuests(e.target.value);
                  clearFieldError('minGuests');
                }}
                placeholder="4"
              />
              <FieldError message={fieldErrors.minGuests} />
            </div>
            <p className="mb-4 text-xs text-white/45">
              Shoppers see an Inquire / Book Date CTA instead of Add to Cart for Private Chef menus.
            </p>
            <VendorPrimaryButton
              disabled={saving}
              onClick={() => {
                setServesDelivery(true);
                void handleSave();
              }}
            >
              {saving ? 'Saving…' : 'Save service settings'}
            </VendorPrimaryButton>
          </VendorFormPanel>
        </VendorSection>
      ) : null}

      {persona === 'micro_brand' ? (
        <VendorSection title="Nationwide shipping settings">
          <VendorFormPanel className="!bg-[#121A36] !text-zinc-50">
            <label className="mb-4 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <span>
                <span className="block text-sm font-bold text-white">Enable shipping</span>
                <span className="mt-0.5 block text-xs text-white/55">
                  Shoppers enter a shipping address at checkout instead of market pickup.
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                aria-checked={shippingEnabled}
                className="h-5 w-5 accent-orange-500"
                checked={shippingEnabled}
                onChange={(e) => setShippingEnabled(e.target.checked)}
              />
            </label>

            {shippingEnabled ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="app-input-group">
                  <label className="!text-white/80">Flat rate shipping fee ($)</label>
                  <input
                    className={`app-input${fieldErrors.flatShipping ? ' app-input--invalid' : ''}`}
                    inputMode="decimal"
                    value={flatShipping}
                    aria-invalid={Boolean(fieldErrors.flatShipping)}
                    onChange={(e) => {
                      setFlatShipping(e.target.value);
                      clearFieldError('flatShipping');
                    }}
                    placeholder="8.00"
                  />
                  <FieldError message={fieldErrors.flatShipping} />
                </div>
                <div className="app-input-group">
                  <label className="!text-white/80">Free shipping minimum ($)</label>
                  <input
                    className={`app-input${fieldErrors.freeShipMin ? ' app-input--invalid' : ''}`}
                    inputMode="decimal"
                    value={freeShipMin}
                    aria-invalid={Boolean(fieldErrors.freeShipMin)}
                    onChange={(e) => {
                      setFreeShipMin(e.target.value);
                      clearFieldError('freeShipMin');
                    }}
                    placeholder="75.00"
                  />
                  <FieldError message={fieldErrors.freeShipMin} />
                </div>
              </div>
            ) : null}

            <p className="mb-4 text-xs text-white/45">
              Products can use the variant builder (Size / Color + stock) on the product form.
            </p>
            <VendorPrimaryButton disabled={saving} onClick={() => void handleSave()}>
              {saving ? 'Saving…' : 'Save shipping settings'}
            </VendorPrimaryButton>
          </VendorFormPanel>
        </VendorSection>
      ) : null}

      {persona === 'farmers_market' ? (
        <VendorSection title="Market vendor">
          <VendorFormPanel className="!bg-[#121A36] !text-zinc-50">
            <p className="m-0 text-sm text-white/70">
              Market vendors fulfill at booth pickup. Manage market dates from Events and inventory
              from Products.
            </p>
            <Link
              to="/vendor/events"
              className="mt-4 inline-flex text-sm font-semibold text-orange-400 no-underline"
            >
              Open my events →
            </Link>
          </VendorFormPanel>
        </VendorSection>
      ) : null}
    </VendorScreen>
  );
}
