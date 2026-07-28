import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { FieldError } from '@/components/ui/FieldError';
import { useAuth } from '@/hooks/use-auth';
import { CHEF_SERVICE_TYPE_LABEL } from '@/lib/chefs';
import { supabase } from '@/lib/supabase';
import type { ChefPriceType, ChefServiceType } from '@/types/database';
import '@/components/ui/ui.css';

const SERVICE_TYPES = Object.keys(CHEF_SERVICE_TYPE_LABEL) as ChefServiceType[];

const PRICE_TYPES: { value: ChefPriceType; label: string }[] = [
  { value: 'flat_rate', label: 'Flat rate' },
  { value: 'per_person', label: 'Per person' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'custom_quote', label: 'Custom quote' },
];

export function ChefServiceFormPage() {
  const navigate = useNavigate();
  const { chef } = useAuth();
  const [serviceName, setServiceName] = useState('');
  const [serviceType, setServiceType] = useState<ChefServiceType>('private_dining');
  const [priceType, setPriceType] = useState<ChefPriceType>('flat_rate');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'serviceName' | 'description' | 'basePrice', string>>>({});

  const MAX_DESCRIPTION_LENGTH = 2000;

  function clearFieldError(field: keyof typeof fieldErrors) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function handleSave() {
    if (!chef?.id) return;
    const priceCents =
      priceType === 'custom_quote' ? 0 : Math.round(Number(basePrice) * 100);
    const nextFieldErrors: Partial<Record<'serviceName' | 'description' | 'basePrice', string>> = {};

    if (!serviceName.trim()) {
      nextFieldErrors.serviceName = 'Enter a service name.';
    }
    const trimmedDescription = description.trim();
    if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
      nextFieldErrors.description = `Description must be ${MAX_DESCRIPTION_LENGTH.toLocaleString()} characters or fewer.`;
    }
    if (priceType !== 'custom_quote') {
      const trimmedPrice = basePrice.trim();
      if (!trimmedPrice) {
        nextFieldErrors.basePrice = 'Enter a price greater than zero.';
      } else if (!/^\d+(\.\d{1,2})?$/.test(trimmedPrice)) {
        nextFieldErrors.basePrice = 'Enter a valid price with up to two decimal places (e.g. 150.00).';
      } else if (!Number.isFinite(priceCents) || priceCents <= 0) {
        nextFieldErrors.basePrice = 'Enter a valid price greater than zero.';
      }
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError(null);
      return;
    }

    setFieldErrors({});
    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from('chef_services').insert({
      chef_id: chef.id,
      service_name: serviceName.trim(),
      service_type: serviceType,
      description: description.trim() || null,
      base_price: priceCents,
      price_type: priceType,
    });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    navigate('/chef/services');
  }

  return (
    <div className="app-screen app-screen--narrow">
      <button type="button" className="app-back-link" onClick={() => navigate(-1)}>
        ← Back
      </button>
      <h1 className="app-title">New service</h1>

      <div className="app-input-group">
        <label htmlFor="svc-name">Service name</label>
        <input
          id="svc-name"
          className={`app-input${fieldErrors.serviceName ? ' app-input--invalid' : ''}`}
          value={serviceName}
          onChange={(e) => {
            setServiceName(e.target.value);
            clearFieldError('serviceName');
          }}
          placeholder="Five-course private dinner"
        />
        <FieldError message={fieldErrors.serviceName} />
      </div>
      <div className="app-input-group">
        <label htmlFor="svc-type">Service type</label>
        <select
          id="svc-type"
          className="app-select"
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value as ChefServiceType)}
        >
          {SERVICE_TYPES.map((t) => (
            <option key={t} value={t}>
              {CHEF_SERVICE_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="app-input-group">
        <label htmlFor="svc-desc">Description</label>
        <textarea
          id="svc-desc"
          className={`app-textarea${fieldErrors.description ? ' app-textarea--invalid' : ''}`}
          value={description}
          aria-invalid={Boolean(fieldErrors.description)}
          onChange={(e) => {
            setDescription(e.target.value);
            clearFieldError('description');
          }}
        />
        <FieldError message={fieldErrors.description} />
      </div>
      <div className="app-input-group">
        <label htmlFor="svc-price-type">Pricing</label>
        <select
          id="svc-price-type"
          className="app-select"
          value={priceType}
          onChange={(e) => setPriceType(e.target.value as ChefPriceType)}
        >
          {PRICE_TYPES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      {priceType !== 'custom_quote' ? (
        <div className="app-input-group">
          <label htmlFor="svc-price">Base price (USD)</label>
          <input
            id="svc-price"
            type="number"
            min="0"
            step="0.01"
            className={`app-input${fieldErrors.basePrice ? ' app-input--invalid' : ''}`}
            value={basePrice}
            onChange={(e) => {
              setBasePrice(e.target.value);
              clearFieldError('basePrice');
            }}
            placeholder="150.00"
          />
          <FieldError message={fieldErrors.basePrice} />
        </div>
      ) : null}

      {error ? <p className="app-error">{error}</p> : null}

      <button
        type="button"
        className="app-btn app-btn--primary"
        disabled={saving}
        onClick={handleSave}
      >
        {saving ? 'Saving…' : 'Create service'}
      </button>
    </div>
  );
}
