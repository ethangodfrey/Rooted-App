import { useEffect, useState } from 'react';

import { Navigate } from 'react-router-dom';



import { AppShell } from '@/components/layout/AppShell';

import { SHOPPER_TABS, SHOPPER_MAP_HREF } from '@/components/navigation/shopper-tabs';

import { useAuth } from '@/hooks/use-auth';

import { readAuthRouteCache, type AuthRouteCache } from '@/lib/auth-route-cache';

import { isCustomerRole } from '@/lib/role-utils';



export function ShopperLayout() {

  const { user, shopper, session, isProfileLoading } = useAuth();

  const [routeCache, setRouteCache] = useState<AuthRouteCache | null | undefined>(undefined);



  useEffect(() => {

    void readAuthRouteCache().then(setRouteCache);

  }, []);



  if (isProfileLoading || routeCache === undefined) {

    return (

      <div className="app-loading">

        <div className="app-spinner" />

      </div>

    );

  }



  const trustedCache =

    session?.user?.id && routeCache?.userId === session.user.id ? routeCache : null;

  const role = user?.role ?? trustedCache?.role ?? null;



  if (!isCustomerRole(role)) {

    return <Navigate to="/app" replace />;

  }



  const hasInterests = user

    ? (shopper?.interests?.length ?? 0) > 0

    : (trustedCache?.hasInterests ?? false);



  if (!hasInterests) {

    return <Navigate to="/onboarding/interests" replace />;

  }



  return <AppShell role="shopper" tabs={SHOPPER_TABS} mapFabHref={SHOPPER_MAP_HREF} />;

}

