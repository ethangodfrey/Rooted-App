import { Route, Routes } from 'react-router-dom';

import { GuestOnly } from '@/components/layout/GuestOnly';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { DashboardRedirect } from '@/pages/DashboardRedirect';
import { AdminEventDetailPage } from '@/pages/admin/AdminEventDetailPage';
import { AdminEventFormPage } from '@/pages/admin/AdminEventFormPage';
import { AdminEventsPage } from '@/pages/admin/AdminEventsPage';
import { AdminLayout } from '@/pages/admin/AdminLayout';
import { AdminMorePage } from '@/pages/admin/AdminMorePage';
import { AdminOrderDetailPage } from '@/pages/admin/AdminOrderDetailPage';
import { AdminOrdersPage } from '@/pages/admin/AdminOrdersPage';
import { AdminPostDetailPage } from '@/pages/admin/AdminPostDetailPage';
import { AdminPostsPage } from '@/pages/admin/AdminPostsPage';
import { AdminVendorDetailPage } from '@/pages/admin/AdminVendorDetailPage';
import { AdminVendorsPage } from '@/pages/admin/AdminVendorsPage';
import { AuthCallbackPage } from '@/pages/auth/AuthCallbackPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { SignupPage } from '@/pages/auth/SignupPage';
import { PrivacyPolicyPage } from '@/pages/legal/PrivacyPolicyPage';
import { TermsOfServicePage } from '@/pages/legal/TermsOfServicePage';
import { LandingPage } from '@/pages/marketing/LandingPage';
import { InterestsPage } from '@/pages/onboarding/InterestsPage';
import { RoleSelectPage } from '@/pages/onboarding/RoleSelectPage';
import { ShopperEventDetailPage } from '@/pages/shopper/ShopperEventDetailPage';
import { ShopperEventsPage } from '@/pages/shopper/ShopperEventsPage';
import { ShopperFeedPage } from '@/pages/shopper/ShopperFeedPage';
import { ShopperHomePage } from '@/pages/shopper/ShopperHomePage';
import { ShopperLeftoverDetailPage } from '@/pages/shopper/ShopperLeftoverDetailPage';
import { ShopperLeftoversPage } from '@/pages/shopper/ShopperLeftoversPage';
import { ShopperLayout } from '@/pages/shopper/ShopperLayout';
import { ShopperMapPage } from '@/pages/shopper/ShopperMapPage';
import { ShopperOrderDetailPage } from '@/pages/shopper/ShopperOrderDetailPage';
import { ShopperOrdersPage } from '@/pages/shopper/ShopperOrdersPage';
import { ShopperProductPage } from '@/pages/shopper/ShopperProductPage';
import { ShopperProfileEditPage } from '@/pages/shopper/ShopperProfileEditPage';
import { ShopperProfilePage } from '@/pages/shopper/ShopperProfilePage';
import { ShopperReservePage } from '@/pages/shopper/ShopperReservePage';
import { ShopperVendorPage } from '@/pages/shopper/ShopperVendorPage';
import { VendorAnalyticsPage } from '@/pages/vendor/VendorAnalyticsPage';
import { VendorDashboardPage } from '@/pages/vendor/VendorDashboardPage';
import { VendorEventsPage } from '@/pages/vendor/VendorEventsPage';
import { VendorLeftoverFormPage } from '@/pages/vendor/VendorLeftoverFormPage';
import { VendorLeftoversPage } from '@/pages/vendor/VendorLeftoversPage';
import { VendorLayout } from '@/pages/vendor/VendorLayout';
import { VendorManualSalePage } from '@/pages/vendor/VendorManualSalePage';
import { VendorOrderDetailPage } from '@/pages/vendor/VendorOrderDetailPage';
import { VendorOrdersPage } from '@/pages/vendor/VendorOrdersPage';
import { VendorPosConnectedPage } from '@/pages/vendor/VendorPosConnectedPage';
import { VendorPosConnectionPage } from '@/pages/vendor/VendorPosConnectionPage';
import { VendorPosMappingsPage } from '@/pages/vendor/VendorPosMappingsPage';
import { VendorPosPage } from '@/pages/vendor/VendorPosPage';
import { VendorPostFormPage } from '@/pages/vendor/VendorPostFormPage';
import { VendorPostsPage } from '@/pages/vendor/VendorPostsPage';
import { VendorVideoPostFormPage } from '@/pages/vendor/VendorVideoPostFormPage';
import { VendorProductAvailabilityPage } from '@/pages/vendor/VendorProductAvailabilityPage';
import { VendorProductFormPage } from '@/pages/vendor/VendorProductFormPage';
import { VendorProductsPage } from '@/pages/vendor/VendorProductsPage';
import { VendorProfilePage } from '@/pages/vendor/VendorProfilePage';
import { VendorSetupPage } from '@/pages/vendor/VendorSetupPage';
import { VendorPreviewPage } from '@/pages/vendor/VendorPreviewPage';
import { VendorStorefrontPage } from '@/pages/vendor/VendorStorefrontPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route path="/legal/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/legal/terms" element={<TermsOfServicePage />} />

      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/app" element={<DashboardRedirect />} />
        <Route path="/onboarding/role-select" element={<RoleSelectPage />} />
        <Route path="/onboarding/interests" element={<InterestsPage />} />

        <Route path="/shopper" element={<ShopperLayout />}>
          <Route path="home" element={<ShopperHomePage />} />
          <Route path="events" element={<ShopperEventsPage />} />
          <Route path="map" element={<ShopperMapPage />} />
          <Route path="feed" element={<ShopperFeedPage />} />
          <Route path="profile" element={<ShopperProfilePage />} />
        </Route>

        <Route path="/shopper/events/:id" element={<ShopperEventDetailPage />} />
        <Route path="/shopper/vendors/:id" element={<ShopperVendorPage />} />
        <Route path="/shopper/products/:id" element={<ShopperProductPage />} />
        <Route path="/shopper/checkout/:productId" element={<ShopperReservePage />} />
        <Route path="/shopper/profile/edit" element={<ShopperProfileEditPage />} />
        <Route path="/shopper/orders" element={<ShopperOrdersPage />} />
        <Route path="/shopper/orders/:id" element={<ShopperOrderDetailPage />} />
        <Route path="/shopper/leftovers" element={<ShopperLeftoversPage />} />
        <Route path="/shopper/leftovers/:id" element={<ShopperLeftoverDetailPage />} />

        <Route path="/vendor" element={<VendorLayout />}>
          <Route path="setup" element={<VendorSetupPage />} />
          <Route path="dashboard" element={<VendorDashboardPage />} />
          <Route path="analytics" element={<VendorAnalyticsPage />} />
          <Route path="orders" element={<VendorOrdersPage />} />
          <Route path="products" element={<VendorProductsPage />} />
          <Route path="posts" element={<VendorPostsPage />} />
          <Route path="profile" element={<VendorProfilePage />} />
        </Route>

        <Route path="/vendor/orders/:id" element={<VendorOrderDetailPage />} />
        <Route path="/vendor/products/new" element={<VendorProductFormPage />} />
        <Route path="/vendor/products/:id/edit" element={<VendorProductFormPage />} />
        <Route path="/vendor/products/:id/availability" element={<VendorProductAvailabilityPage />} />
        <Route path="/vendor/posts/new" element={<VendorPostFormPage />} />
        <Route path="/vendor/posts/new-video" element={<VendorVideoPostFormPage />} />
        <Route path="/vendor/leftovers" element={<VendorLeftoversPage />} />
        <Route path="/vendor/leftovers/new" element={<VendorLeftoverFormPage />} />
        <Route path="/vendor/events" element={<VendorEventsPage />} />
        <Route path="/vendor/sales/manual" element={<VendorManualSalePage />} />
        <Route path="/vendor/pos" element={<VendorPosPage />} />
        <Route path="/vendor/pos/connected" element={<VendorPosConnectedPage />} />
        <Route path="/vendor/pos/mappings" element={<VendorPosMappingsPage />} />
        <Route path="/vendor/pos/:id" element={<VendorPosConnectionPage />} />
        <Route path="/vendor/storefront" element={<VendorStorefrontPage />} />
        <Route path="/vendor/preview" element={<VendorPreviewPage />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route path="vendors" element={<AdminVendorsPage />} />
          <Route path="events" element={<AdminEventsPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="posts" element={<AdminPostsPage />} />
          <Route path="more" element={<AdminMorePage />} />
        </Route>

        <Route path="/admin/vendors/:id" element={<AdminVendorDetailPage />} />
        <Route path="/admin/events/new" element={<AdminEventFormPage />} />
        <Route path="/admin/events/:id" element={<AdminEventDetailPage />} />
        <Route path="/admin/orders/:id" element={<AdminOrderDetailPage />} />
        <Route path="/admin/posts/:id" element={<AdminPostDetailPage />} />
      </Route>
    </Routes>
  );
}
