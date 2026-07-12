import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import '@/components/trust/TrustBadges.css';
import {
  VendorFormPanel,
  VendorHero,
  VendorListPanel,
  VendorListRow,
  VendorScreen,
  VendorSection,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import { complianceChecklistForState } from '@/lib/compliance';
import { supabase } from '@/lib/supabase';
import { CREDENTIAL_LABELS } from '@/lib/verification';
import type { CredentialType, StateFoodRegulation, VendorCompliance } from '@/types/database';
import '@/components/ui/ui.css';

export function VendorCompliancePage() {
  const { vendor, user } = useAuth();
  const [regs, setRegs] = useState<StateFoodRegulation | null>(null);
  const [compliance, setCompliance] = useState<VendorCompliance | null>(null);
  const [verifiedTypes, setVerifiedTypes] = useState<CredentialType[]>([]);
  const [loading, setLoading] = useState(true);

  const stateCode = vendor?.sell_state?.toUpperCase().slice(0, 2) ?? user?.state?.toUpperCase().slice(0, 2);

  useEffect(() => {
    async function load() {
      if (!vendor?.id) {
        setLoading(false);
        return;
      }

      const [regsRes, complianceRes, credsRes] = await Promise.all([
        stateCode
          ? supabase.from('state_food_regulations').select('*').eq('state_code', stateCode).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('vendor_compliance').select('*').eq('vendor_id', vendor.id).maybeSingle(),
        supabase
          .from('verification_credentials')
          .select('credential_type, verification_status')
          .eq('user_id', vendor.user_id),
      ]);

      setRegs(regsRes.data as StateFoodRegulation | null);
      setCompliance(complianceRes.data as VendorCompliance | null);

      const types =
        (credsRes.data ?? [])
          .filter((c) => c.verification_status === 'verified')
          .map((c) => c.credential_type as CredentialType) ?? [];
      setVerifiedTypes(types);

      if (!complianceRes.data && stateCode) {
        await supabase.from('vendor_compliance').upsert({
          vendor_id: vendor.id,
          state_code: stateCode,
        });
      }

      setLoading(false);
    }

    void load();
  }, [vendor?.id, vendor?.user_id, stateCode]);

  const checklist = complianceChecklistForState(regs);

  if (loading) {
    return (
      <VendorScreen>
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      </VendorScreen>
    );
  }

  return (
    <VendorScreen>
      <Link to="/vendor/dashboard" className="app-back-link">
        ← Back
      </Link>
      <VendorHero
        eyebrow="Trust"
        title="Food safety checklist"
        subtitle={
          stateCode
            ? `${regs?.state_name ?? stateCode} cottage food`
            : 'Set your state in application details.'
        }
        pill={compliance?.compliance_status ?? 'pending_review'}
      />

      {verifiedTypes.length > 0 ? (
        <div className="trust-badges mb-4">
          {verifiedTypes.map((type) => (
            <span key={type} className="trust-badge">
              <span aria-hidden="true" className="trust-badge__check">
                ✓
              </span>
              {CREDENTIAL_LABELS[type]}
            </span>
          ))}
        </div>
      ) : null}

      {regs?.required_disclaimer ? (
        <VendorFormPanel className="mb-5">
          <p className="m-0 text-xs text-stone-500">{regs.required_disclaimer}</p>
        </VendorFormPanel>
      ) : null}

      <VendorSection title="Checklist">
        <VendorListPanel>
          {checklist.map((item) => (
            <div key={item.label} className="p-3.5">
              <p className="m-0 text-sm text-stone-700">
                {item.required ? '• ' : '○ '}
                {item.label}
              </p>
            </div>
          ))}
        </VendorListPanel>
      </VendorSection>

      <VendorSection title="Actions">
        <VendorListPanel>
          {regs?.regulation_url ? (
            <VendorListRow
              to={regs.regulation_url}
              external
              title="Official state guidance"
              subtitle="Cottage food regulations"
              icon="file-text"
              tone="sky"
            />
          ) : null}
          <VendorListRow
            to="/vendor/credentials"
            title="Upload credentials"
            subtitle="Food handler cert, permit, license"
            icon="badge"
            tone="emerald"
          />
        </VendorListPanel>
      </VendorSection>
    </VendorScreen>
  );
}
