import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

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
} from '@/lib/vendor-types';
import '@/components/ui/ui.css';

/**
 * High-fidelity vendor persona picker — `/vendor/onboarding`.
 * Persists selection to `vendors.vendor_type`.
 */
export function VendorOnboardingPage() {
  const navigate = useNavigate();
  const { vendor, refreshUser } = useAuth();
  const initial = isVendorPersona(vendor?.vendor_type) ? vendor.vendor_type : null;
  const [persona, setPersona] = useState<VendorPersona | null>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!vendor?.id) {
      setError('Vendor profile not found. Finish role selection first.');
      return;
    }
    if (!persona) {
                    setError(
                      'Choose how you sell — Market Vendor, Home Chef, Private Chef, or Micro-Brand.',
                    );
      return;
    }

    setSaving(true);
    setError(null);
    const { error: upError } = await supabase
      .from('vendors')
      .update({
        vendor_type: persona,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendor.id);
    setSaving(false);

    if (upError) {
      setError(upError.message);
      return;
    }

    await refreshUser();
    if (persona === 'farmers_market') {
      navigate('/vendor/setup');
    } else {
      navigate('/vendor/settings/fulfillment');
    }
  }

  return (
    <VendorScreen>
      <Link to="/vendor/dashboard" className="app-back-link">
        ← Dashboard
      </Link>
      <VendorHero
        eyebrow="Onboarding"
        title="How do you sell?"
        subtitle="Pick the model that matches your booth, kitchen, private dining, or maker brand. You can change this later in settings."
        pill={persona ? VENDOR_PERSONA_OPTIONS.find((o) => o.value === persona)?.title : 'Choose one'}
      />

      {error ? <p className="app-error mb-4">{error}</p> : null}

      <VendorSection title="Vendor type">
        <div className="grid gap-3 sm:grid-cols-2">
          {VENDOR_PERSONA_OPTIONS.map((option) => {
            const selected = persona === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setPersona(option.value)}
                aria-pressed={selected}
                className={`rounded-2xl border px-5 py-5 text-left transition active:scale-[0.99] ${
                  selected
                    ? 'border-orange-500/60 bg-orange-500/15 shadow-[0_0_0_1px_rgba(249,115,22,0.35)]'
                    : 'border-white/10 bg-[#121A36] hover:border-white/25'
                }`}
              >
                <span className="block text-3xl" aria-hidden>
                  {option.emoji}
                </span>
                <span className="mt-3 block text-lg font-extrabold tracking-tight text-white">
                  {option.title}
                </span>
                <span className="mt-2 block text-sm font-medium leading-relaxed text-white/65">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </VendorSection>

      <VendorFormPanel className="!bg-[#121A36] !text-zinc-50 mt-4">
        <p className="m-0 text-sm text-white/65">
          Next you’ll configure fulfillment — market booths, home pickup/delivery, or private chef
          service rates.
        </p>
        <VendorPrimaryButton className="mt-4" disabled={saving || !persona} onClick={() => void handleContinue()}>
          {saving ? 'Saving…' : 'Continue'}
        </VendorPrimaryButton>
      </VendorFormPanel>
    </VendorScreen>
  );
}
