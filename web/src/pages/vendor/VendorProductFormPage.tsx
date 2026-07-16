import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ProductForm, type ProductFormValues } from '@/components/vendor/ProductForm';
import {
  VendorHero,
  VendorListPanel,
  VendorListRow,
  VendorScreen,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import { emptyVariantsPayload, parseVariants } from '@/lib/product-variants';
import { supabase } from '@/lib/supabase';
import { isMicroBrandVendor } from '@/lib/vendor-types';
import '@/components/ui/ui.css';

export function VendorProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { vendor } = useAuth();
  const isEdit = Boolean(id);
  const [initial, setInitial] = useState<Partial<ProductFormValues> | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    async function load() {
      const { data } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
      if (data) {
        setInitial({
          name: data.name,
          description: data.description,
          price: data.price,
          category: data.category,
          reserve_enabled: data.reserve_enabled,
          reserve_limit_total: data.reserve_limit_total,
          reserve_limit_per_shopper: data.reserve_limit_per_shopper,
          media_urls: data.media_urls ?? [],
          is_snap_eligible: Boolean(data.is_snap_eligible),
          has_variants: Boolean(data.has_variants),
          variants: parseVariants(data.variants),
        });
      }
      setLoading(false);
    }
    void load();
  }, [id]);

  async function handleSave(values: ProductFormValues) {
    if (!vendor) return;
    setSaving(true);
    setError(null);

    const payload = {
      vendor_id: vendor.id,
      name: values.name,
      description: values.description,
      price: values.price,
      category: values.category,
      reserve_enabled: values.reserve_enabled,
      reserve_limit_total: values.reserve_limit_total,
      reserve_limit_per_shopper: values.reserve_limit_per_shopper,
      media_urls: values.media_urls,
      is_snap_eligible: values.is_snap_eligible,
      has_variants: values.has_variants,
      variants: values.has_variants ? values.variants : emptyVariantsPayload(),
      status: 'active' as const,
      updated_at: new Date().toISOString(),
    };

    const result = isEdit
      ? await supabase.from('products').update(payload).eq('id', id)
      : await supabase
          .from('products')
          .insert({ ...payload, created_at: new Date().toISOString() })
          .select('id')
          .single();

    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (isEdit) {
      navigate('/vendor/products');
    } else {
      const newId = (result.data as { id: string }).id;
      navigate(`/vendor/products/${newId}/availability`);
    }
  }

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-spinner" />
      </div>
    );
  }

  return (
    <VendorScreen>
      <Link to="/vendor/products" className="app-back-link">
        ← Products
      </Link>
      <VendorHero eyebrow="Manage" title={isEdit ? 'Edit product' : 'New product'} />

      {isEdit ? (
        <div className="mb-5">
          <VendorListPanel>
            <VendorListRow
              to={`/vendor/products/${id}/availability`}
              title="Event availability"
              subtitle="Presale and in-person quantities"
              icon="calendar"
              tone="sky"
            />
          </VendorListPanel>
        </div>
      ) : null}

      {error ? <p className="app-error">{error}</p> : null}

      <ProductForm
        initial={initial ?? undefined}
        submitLabel={isEdit ? 'Save product' : 'Create product'}
        loading={saving}
        microBrand={isMicroBrandVendor(vendor?.vendor_type)}
        onSubmit={handleSave}
      />
    </VendorScreen>
  );
}
