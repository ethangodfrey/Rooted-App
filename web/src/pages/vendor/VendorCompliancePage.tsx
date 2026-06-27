import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import '@/components/trust/TrustBadges.css';
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
      <div className="app-screen">
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="app-screen">
      <Link to="/vendor/dashboard" className="app-back-link">
        ← Back
      </Link>
      <p className="app-eyebrow">Trust & compliance</p>
      <h1 className="app-title">Food safety checklist</h1>
      <p className="app-subtitle">
        {stateCode
          ? `${regs?.state_name ?? stateCode} cottage food requirements`
          : 'Set your state in application details.'}
      </p>

      {verifiedTypes.length > 0 ? (
        <div className="trust-badges" style={{ marginBottom: '1rem' }}>
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

      <div className="app-card" style={{ marginBottom: '1rem' }}>
        <p className="app-row-title">Status: {compliance?.compliance_status ?? 'pending_review'}</p>
        {regs?.required_disclaimer ? <p className="app-row-meta">{regs.required_disclaimer}</p> : null}
      </div>

      <div className="app-card" style={{ marginBottom: '1.5rem' }}>
        {checklist.map((item) => (
          <p key={item.label} className="app-row-meta" style={{ marginBottom: '0.5rem' }}>
            {item.required ? '• ' : '○ '}
            {item.label}
          </p>
        ))}
      </div>

      {regs?.regulation_url ? (
        <a
          href={regs.regulation_url}
          target="_blank"
          rel="noopener noreferrer"
          className="app-card app-card--pressable"
          style={{ display: 'block', marginBottom: '1rem' }}
        >
          <p className="app-row-title">Official state guidance</p>
          <p className="app-row-meta">Open cottage food regulations</p>
        </a>
      ) : null}

      <Link to="/vendor/credentials" className="app-card app-card--pressable" style={{ display: 'block' }}>
        <p className="app-row-title">Upload credentials</p>
        <p className="app-row-meta">Food handler cert, cottage food permit, business license</p>
      </Link>
    </div>
  );
}
