import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ProductForm } from '@/components/vendor/ProductForm';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

export function VendorProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { vendor } = useAuth();
  const isEdit = Boolean(id);
  const [initial, setInitial] = useState<Partial<{
    name: string;
    description: string | null;
    price: number;
    category: string | null;
    reserve_enabled: boolean;
    reserve_limit_total: number | null;
    reserve_limit_per_shopper: number | null;
    media_urls: string[];
  }> | null>(null);
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
        });
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSave(values: {
    name: string;
    description: string | null;
    price: number;
    category: string | null;
    reserve_enabled: boolean;
    reserve_limit_total: number | null;
    reserve_limit_per_shopper: number | null;
    media_urls: string[];
  }) {
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

  if (loading) return <div className="app-loading"><div className="app-spinner" /></div>;

  return (
    <div className="app-screen app-screen--narrow">
      <Link to="/vendor/products" className="app-back-link">← Products</Link>
      <h1 className="app-title">{isEdit ? 'Edit product' : 'New product'}</h1>

      {isEdit ? (
        <Link
          to={`/vendor/products/${id}/availability`}
          className="app-card app-card--pressable app-card--honeydew"
          style={{ display: 'block', marginBottom: '1rem' }}>
          <p className="app-row-title">Event availability</p>
          <p className="app-row-meta">Set presale and in-person quantities per market</p>
        </Link>
      ) : null}

      {error ? <p className="app-error">{error}</p> : null}

      <ProductForm
        initial={initial ?? undefined}
        submitLabel={isEdit ? 'Save product' : 'Create product'}
        loading={saving}
        onSubmit={handleSave}
      />
    </div>
  );
}
