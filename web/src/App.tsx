import { Navigate, Route, Routes } from 'react-router-dom';

import { GuestOnly } from '@/components/layout/GuestOnly';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { DashboardRedirect } from '@/pages/DashboardRedirect';
import { NotFoundPage } from '@/pages/NotFoundPage';
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
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<ShopperHomePage />} />
          <Route path="events" element={<ShopperEventsPage />} />
          <Route path="map" element={<ShopperMapPage />} />
          <Route path="feed" element={<ShopperFeedPage />} />
          <Route path="profile" element={<ShopperProfilePage />} />
          <Route path="events/:id" element={<ShopperEventDetailPage />} />
          <Route path="vendors/:id" element={<ShopperVendorPage />} />
          <Route path="products/:id" element={<ShopperProductPage />} />
          <Route path="checkout/:productId" element={<ShopperReservePage />} />
          <Route path="profile/edit" element={<ShopperProfileEditPage />} />
          <Route path="orders" element={<ShopperOrdersPage />} />
          <Route path="orders/:id" element={<ShopperOrderDetailPage />} />
          <Route path="leftovers" element={<ShopperLeftoversPage />} />
          <Route path="leftovers/:id" element={<ShopperLeftoverDetailPage />} />
        </Route>

        <Route path="/vendor" element={<VendorLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="setup" element={<VendorSetupPage />} />
          <Route path="dashboard" element={<VendorDashboardPage />} />
          <Route path="analytics" element={<VendorAnalyticsPage />} />
          <Route path="orders" element={<VendorOrdersPage />} />
          <Route path="products" element={<VendorProductsPage />} />
          <Route path="posts" element={<VendorPostsPage />} />
          <Route path="profile" element={<VendorProfilePage />} />
          <Route path="orders/:id" element={<VendorOrderDetailPage />} />
          <Route path="products/new" element={<VendorProductFormPage />} />
          <Route path="products/:id/edit" element={<VendorProductFormPage />} />
          <Route path="products/:id/availability" element={<VendorProductAvailabilityPage />} />
          <Route path="posts/new" element={<VendorPostFormPage />} />
          <Route path="posts/new-video" element={<VendorVideoPostFormPage />} />
          <Route path="leftovers" element={<VendorLeftoversPage />} />
          <Route path="leftovers/new" element={<VendorLeftoverFormPage />} />
          <Route path="events" element={<VendorEventsPage />} />
          <Route path="sales/manual" element={<VendorManualSalePage />} />
          <Route path="pos" element={<VendorPosPage />} />
          <Route path="pos/connected" element={<VendorPosConnectedPage />} />
          <Route path="pos/mappings" element={<VendorPosMappingsPage />} />
          <Route path="pos/:id" element={<VendorPosConnectionPage />} />
          <Route path="storefront" element={<VendorStorefrontPage />} />
          <Route path="preview" element={<VendorPreviewPage />} />
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="vendors" replace />} />
          <Route path="vendors" element={<AdminVendorsPage />} />
          <Route path="events" element={<AdminEventsPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="posts" element={<AdminPostsPage />} />
          <Route path="more" element={<AdminMorePage />} />
          <Route path="vendors/:id" element={<AdminVendorDetailPage />} />
          <Route path="events/new" element={<AdminEventFormPage />} />
          <Route path="events/:id" element={<AdminEventDetailPage />} />
          <Route path="orders/:id" element={<AdminOrderDetailPage />} />
          <Route path="posts/:id" element={<AdminPostDetailPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
