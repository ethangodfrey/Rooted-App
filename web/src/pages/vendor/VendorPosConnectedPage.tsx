import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { VendorHero, VendorScreen, VendorSecondaryButton } from '@/components/vendor/vendor-ui';
import '@/components/ui/ui.css';

export function VendorPosConnectedPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const status = params.get('status');
  const detail = params.get('detail');
  const ok = status === 'success';

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/vendor/pos', { replace: true });
    }, ok ? 1500 : 3500);
    return () => clearTimeout(timer);
  }, [ok, navigate]);

  return (
    <VendorScreen>
      <div className="flex flex-col items-center pt-16 text-center">
        <div className="app-spinner mb-6" />
        <VendorHero
          eyebrow="POS"
          title={ok ? 'Square connected' : 'Connection failed'}
          subtitle={ok ? 'Starting your first sync…' : (detail ?? 'Authorization failed.')}
        />
        <VendorSecondaryButton to="/vendor/pos" className="mt-4">
          Back to POS
        </VendorSecondaryButton>
      </div>
    </VendorScreen>
  );
}
