import { Link } from 'react-router-dom';



import { useAuth } from '@/hooks/use-auth';

import '@/components/ui/ui.css';



export function ShopperProfilePage() {

  const { user, session, signOut } = useAuth();



  const displayEmail = user?.email ?? session?.user?.email ?? '—';

  const initials = (user?.name || displayEmail || '?').toString().trim().charAt(0).toUpperCase();

  const displayName = user?.name?.trim() || 'You';



  return (
    <div className="app-screen app-screen--narrow app-screen--titled">

      <div className="app-profile-header">
        {user?.profile_photo ? (
          <img src={user.profile_photo} alt="" className="profile-avatar" />
        ) : (
          <div className="profile-avatar profile-avatar--placeholder">{initials}</div>
        )}
        <div>
          <p className="app-row-title" style={{ fontSize: '1.125rem', marginBottom: '0.25rem' }}>
            {displayName}
          </p>
          <p className="app-row-meta">{displayEmail}</p>
        </div>
      </div>



      <div className="app-profile-big-cards">

        <Link to="/shopper/orders" className="app-profile-big-card">

          <span className="app-profile-big-card__icon" aria-hidden="true">

            📋

          </span>

          <div>

            <p className="app-profile-big-card__title">Reservations</p>

            <p className="app-profile-big-card__meta">Track reserve-for-pickup orders</p>

          </div>

        </Link>



        <Link to="/shopper/saved" className="app-profile-big-card">

          <span className="app-profile-big-card__icon" aria-hidden="true">

            ♥

          </span>

          <div>

            <p className="app-profile-big-card__title">Saved</p>

            <p className="app-profile-big-card__meta">Vendors, chefs, and products</p>

          </div>

        </Link>



        <Link to="/shopper/profile/edit" className="app-profile-big-card">

          <span className="app-profile-big-card__icon" aria-hidden="true">

            ⚙

          </span>

          <div>

            <p className="app-profile-big-card__title">Settings</p>

            <p className="app-profile-big-card__meta">Profile, location, and preferences</p>

          </div>

        </Link>

      </div>



      <button type="button" className="app-sign-out-link" onClick={signOut}>

        Sign out

      </button>

    </div>

  );

}

