import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

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
    <div className="app-screen app-screen--narrow" style={{ textAlign: 'center', paddingTop: '4rem' }}>
      <div className="app-spinner" style={{ margin: '0 auto 1.5rem' }} />
      <h1 className="app-title">{ok ? 'Square connected' : 'Connection failed'}</h1>
      <p className="app-subtitle">
        {ok ? 'Starting your first sync…' : (detail ?? 'Something went wrong during authorization.')}
      </p>
      <Link to="/vendor/pos" className="app-btn app-btn--secondary" style={{ marginTop: '1.5rem', display: 'inline-block' }}>
        Back to POS
      </Link>
    </div>
  );
}
