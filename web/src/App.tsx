import { Route, Routes, Navigate } from 'react-router-dom';

import { GuestOnly } from '@/components/layout/GuestOnly';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { ShopperCartHost } from '@/components/cart/ShopperCartHost';
import { DashboardRedirect } from '@/pages/DashboardRedirect';
import { AdminEventDetailPage } from '@/pages/admin/AdminEventDetailPage';
import { AdminEventFormPage } from '@/pages/admin/AdminEventFormPage';
import { AdminCommunityEventsPage } from '@/pages/admin/AdminCommunityEventsPage';
import { AdminCredentialsPage } from '@/pages/admin/AdminCredentialsPage';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { AdminMixAnalyticsPage } from '@/pages/admin/AdminMixAnalyticsPage';
import { AdminAnalyticsPage } from '@/pages/admin/AdminAnalyticsPage';
import { AdminEventsPage } from '@/pages/admin/AdminEventsPage';
import { AdminLayout } from '@/pages/admin/AdminLayout';
import { AdminMorePage } from '@/pages/admin/AdminMorePage';
import { AdminOrderDetailPage } from '@/pages/admin/AdminOrderDetailPage';
import { AdminOrdersPage } from '@/pages/admin/AdminOrdersPage';
import { AdminPostDetailPage } from '@/pages/admin/AdminPostDetailPage';
import { AdminPostsPage } from '@/pages/admin/AdminPostsPage';
import { AdminVendorDetailPage } from '@/pages/admin/AdminVendorDetailPage';
import { AdminVendorsPage } from '@/pages/admin/AdminVendorsPage';
import { ChefBookingDetailPage } from '@/pages/chef/ChefBookingDetailPage';
import { ChefBookingsPage } from '@/pages/chef/ChefBookingsPage';
import { ChefCredentialsPage } from '@/pages/chef/ChefCredentialsPage';
import { ChefDashboardPage } from '@/pages/chef/ChefDashboardPage';
import { ChefLayout } from '@/pages/chef/ChefLayout';
import { ChefPortfolioPage } from '@/pages/chef/ChefPortfolioPage';
import { ChefProcurementPage } from '@/pages/chef/ChefProcurementPage';
import { ChefProfilePage } from '@/pages/chef/ChefProfilePage';
import { ChefServiceFormPage } from '@/pages/chef/ChefServiceFormPage';
import { ChefServicesPage } from '@/pages/chef/ChefServicesPage';
import { ChefSetupPage } from '@/pages/chef/ChefSetupPage';
import { AuthCallbackPage } from '@/pages/auth/AuthCallbackPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { SignupPage } from '@/pages/auth/SignupPage';
import { PrivacyPolicyPage } from '@/pages/legal/PrivacyPolicyPage';
import { TermsOfServicePage } from '@/pages/legal/TermsOfServicePage';
import { LandingPage } from '@/pages/marketing/LandingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { InterestsPage } from '@/pages/onboarding/InterestsPage';
import { RoleSelectPage } from '@/pages/onboarding/RoleSelectPage';
import { SpecialtiesPage } from '@/pages/onboarding/SpecialtiesPage';
import { ShopperBookingDetailPage } from '@/pages/shopper/ShopperBookingDetailPage';
import { ShopperBookingsPage } from '@/pages/shopper/ShopperBookingsPage';
import { ShopperCartPage } from '@/pages/shopper/ShopperCartPage';
import { ShopperChefBookingPage } from '@/pages/shopper/ShopperChefBookingPage';
import { ShopperChefPage } from '@/pages/shopper/ShopperChefPage';
import { ShopperChefsPage } from '@/pages/shopper/ShopperChefsPage';
import { CheckoutSuccessPage } from '@/pages/shopper/CheckoutSuccessPage';
import { ShopperEventDetailPage } from '@/pages/shopper/ShopperEventDetailPage';
import { ShopperEventsPage } from '@/pages/shopper/ShopperEventsPage';
import { ShopperExplorePage } from '@/pages/shopper/ShopperExplorePage';
import { ShopperHomePage } from '@/pages/shopper/ShopperHomePage';
import { ShopperLeftoverDetailPage } from '@/pages/shopper/ShopperLeftoverDetailPage';
import { ShopperLeftoversPage } from '@/pages/shopper/ShopperLeftoversPage';
import { ShopperFollowingPage } from '@/pages/shopper/ShopperFollowingPage';
import { ShopperInboxPage } from '@/pages/shopper/ShopperInboxPage';
import { ShopperLayout } from '@/pages/shopper/ShopperLayout';
import { OrderContextThreadPage } from '@/pages/messaging/OrderContextThreadPage';
import { ShopperMapPage } from '@/pages/shopper/ShopperMapPage';
import { ShopperOrderDetailPage } from '@/pages/shopper/ShopperOrderDetailPage';
import { ShopperOrdersPage } from '@/pages/shopper/ShopperOrdersPage';
import { ShopperProductPage } from '@/pages/shopper/ShopperProductPage';
import { ShopperProfileEditPage } from '@/pages/shopper/ShopperProfileEditPage';
import { ShopperProfilePage } from '@/pages/shopper/ShopperProfilePage';
import { ShopperReservePage } from '@/pages/shopper/ShopperReservePage';
import { ShopperSearchPage } from '@/pages/shopper/ShopperSearchPage';
import { ShopperSavedPage } from '@/pages/shopper/ShopperSavedPage';
import { ShopperVendorPage } from '@/pages/shopper/ShopperVendorPage';
import { ShopperMeetTheMakersPage } from '@/pages/shopper/ShopperMeetTheMakersPage';
import { ShopperMessagesPage } from '@/pages/shopper/ShopperMessagesPage';
import { ShopperRewardsPage } from '@/pages/shopper/ShopperRewardsPage';
import { VendorCateringSettingsPage } from '@/pages/vendor/VendorCateringSettingsPage';
import { VendorAvailabilityPage } from '@/pages/vendor/VendorAvailabilityPage';
import { VendorLoyaltyPage } from '@/pages/vendor/VendorLoyaltyPage';
import { VendorFinancialsPage } from '@/pages/vendor/VendorFinancialsPage';
import { VendorFulfillmentSettingsPage } from '@/pages/vendor/VendorFulfillmentSettingsPage';
import { VendorLoadInPage } from '@/pages/vendor/VendorLoadInPage';
import { VendorMessagesPage } from '@/pages/vendor/VendorMessagesPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { FarmerLogisticsPage } from '@/pages/farmer/FarmerLogisticsPage';
import { VendorProcurementPage } from '@/pages/vendor/VendorProcurementPage';
import { VendorFulfillmentPage } from '@/pages/vendor/VendorFulfillmentPage';
import { VendorHandoffsPage } from '@/pages/vendor/VendorHandoffsPage';
import { CreatorB2bChatPage } from '@/pages/creator/CreatorB2bChatPage';
import { CreatorHandoffsPage } from '@/pages/creator/CreatorHandoffsPage';
import { CreatorInboxPage } from '@/pages/creator/CreatorInboxPage';
import { CreatorLayout } from '@/pages/creator/CreatorLayout';
import { CreatorListingsPage } from '@/pages/creator/CreatorListingsPage';
import { CreatorNetworkPage } from '@/pages/creator/CreatorNetworkPage';
import { CreatorSettingsPage } from '@/pages/creator/CreatorSettingsPage';
import { VendorInboxPage } from '@/pages/vendor/VendorInboxPage';
import { VendorB2bChatPage } from '@/pages/vendor/VendorB2bChatPage';
import { VendorNetworkPage } from '@/pages/vendor/VendorNetworkPage';
import { VendorAnalyticsIntegrationsPage } from '@/pages/vendor/VendorAnalyticsIntegrationsPage';
import { VendorAnalyticsPage } from '@/pages/vendor/VendorAnalyticsPage';
import { VendorCompliancePage } from '@/pages/vendor/VendorCompliancePage';
import { VendorCredentialsPage } from '@/pages/vendor/VendorCredentialsPage';
import { VendorDashboardPage } from '@/pages/vendor/VendorDashboardPage';
import { VendorEventsPage } from '@/pages/vendor/VendorEventsPage';
import { VendorExplorePage } from '@/pages/vendor/VendorExplorePage';
import { VendorInventoryPage } from '@/pages/vendor/VendorInventoryPage';
import { VendorLeftoverFormPage } from '@/pages/vendor/VendorLeftoverFormPage';
import { VendorLeftoversPage } from '@/pages/vendor/VendorLeftoversPage';
import { VendorLayout } from '@/pages/vendor/VendorLayout';
import { VendorManualSalePage } from '@/pages/vendor/VendorManualSalePage';
import { VendorOrderDetailPage } from '@/pages/vendor/VendorOrderDetailPage';
import { VendorOrdersPage } from '@/pages/vendor/VendorOrdersPage';
import { VendorPaymentsPage } from '@/pages/vendor/VendorPaymentsPage';
import { VendorPosActivityPage } from '@/pages/vendor/VendorPosActivityPage';
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
        <Route element={<ShopperCartHost />}>
        <Route path="/app" element={<DashboardRedirect />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/onboarding/role-select" element={<RoleSelectPage />} />
        <Route path="/onboarding/role" element={<RoleSelectPage />} />
        <Route path="/onboarding/interests" element={<InterestsPage />} />
        <Route path="/onboarding/specialties" element={<SpecialtiesPage />} />

        {/* Shopper workspace — Explore / Inbox / Following / Orders */}
        <Route element={<ShopperLayout />}>
          <Route path="/explore" element={<ShopperMapPage />} />
          <Route path="/explore/feed" element={<ShopperExplorePage />} />
          <Route path="/inbox" element={<ShopperInboxPage />} />
          <Route
            path="/inbox/thread/:threadId"
            element={<OrderContextThreadPage viewerRole="shopper" backTo="/inbox" />}
          />
          <Route path="/following" element={<ShopperFollowingPage />} />
          <Route path="/orders" element={<ShopperOrdersPage />} />
          <Route path="/orders/:id" element={<ShopperOrderDetailPage />} />
          <Route path="/shopper/home" element={<ShopperHomePage />} />
          <Route path="/shopper/search" element={<ShopperSearchPage />} />
          <Route path="/shopper/explore" element={<ShopperExplorePage />} />
          <Route path="/shopper/meet-the-makers" element={<ShopperMeetTheMakersPage />} />
          <Route path="/shopper/messages" element={<ShopperMessagesPage />} />
          <Route path="/shopper/events" element={<ShopperEventsPage />} />
          <Route path="/shopper/map" element={<Navigate to="/explore" replace />} />
          <Route path="/shopper/feed" element={<Navigate to="/following" replace />} />
          <Route path="/shopper/profile" element={<ShopperProfilePage />} />
          <Route path="/shopper/rewards" element={<ShopperRewardsPage />} />
          <Route path="/shopper/cart" element={<ShopperCartPage />} />
        </Route>

        <Route path="/shopper" element={<Navigate to="/explore" replace />} />

        <Route path="/markets/:id" element={<ShopperEventDetailPage />} />
        <Route path="/vendors/:id" element={<ShopperVendorPage />} />
        <Route path="/shopper/events/:id" element={<ShopperEventDetailPage />} />
        <Route path="/shopper/vendors/:id" element={<ShopperVendorPage />} />
        <Route path="/shopper/chefs" element={<ShopperChefsPage />} />
        <Route path="/shopper/chefs/:id" element={<ShopperChefPage />} />
        <Route path="/shopper/chefs/book/:serviceId" element={<ShopperChefBookingPage />} />
        <Route path="/shopper/bookings" element={<ShopperBookingsPage />} />
        <Route path="/shopper/bookings/:id" element={<ShopperBookingDetailPage />} />
        <Route path="/shopper/products/:id" element={<ShopperProductPage />} />
        <Route path="/shopper/checkout/:productId" element={<ShopperReservePage />} />
        <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
        <Route path="/shopper/profile/edit" element={<ShopperProfileEditPage />} />
        <Route path="/shopper/saved" element={<ShopperSavedPage />} />
        <Route path="/shopper/orders" element={<Navigate to="/orders" replace />} />
        <Route path="/shopper/orders/:id" element={<ShopperOrderDetailPage />} />
        <Route path="/profile/orders" element={<Navigate to="/orders" replace />} />
        <Route path="/profile/orders/:id" element={<ShopperOrderDetailPage />} />
        <Route path="/shopper/leftovers" element={<ShopperLeftoversPage />} />
        <Route path="/shopper/leftovers/:id" element={<ShopperLeftoverDetailPage />} />

        {/* Spec aliases: /creator → dedicated creator shell (Phase 83 amend) */}
        <Route path="/creator" element={<CreatorLayout />}>
          <Route index element={<Navigate to="listings" replace />} />
          <Route path="listings" element={<CreatorListingsPage />} />
          <Route path="handoffs" element={<CreatorHandoffsPage />} />
          <Route path="network" element={<CreatorNetworkPage />} />
          <Route path="inbox" element={<CreatorInboxPage />} />
          <Route path="inbox/chat/:peerId" element={<CreatorB2bChatPage />} />
          <Route
            path="inbox/thread/:threadId"
            element={<OrderContextThreadPage viewerRole="vendor" backTo="/creator/inbox" />}
          />
          <Route path="settings" element={<CreatorSettingsPage />} />
        </Route>
        <Route path="/creator/events" element={<Navigate to="/vendor/events" replace />} />
        <Route
          path="/creator/analytics/integrations"
          element={<Navigate to="/vendor/analytics/integrations" replace />}
        />
        <Route path="/creator/analytics" element={<Navigate to="/vendor/analytics" replace />} />

        {/* Vendor workspace — Storefront / Hand-offs / Inbox / Network */}
        <Route path="/vendor" element={<VendorLayout />}>
          <Route index element={<Navigate to="storefront" replace />} />
          <Route path="setup" element={<VendorSetupPage />} />
          <Route path="storefront" element={<VendorStorefrontPage />} />
          <Route path="dashboard" element={<VendorDashboardPage />} />
          {/* Same farmers-market map as shopper Explore — available inside vendor shell */}
          <Route path="map" element={<ShopperMapPage />} />
          <Route path="inventory" element={<VendorInventoryPage />} />
          <Route path="fulfillment" element={<VendorFulfillmentPage />} />
          <Route path="fulfillment-settings" element={<VendorFulfillmentSettingsPage />} />
          <Route path="load-in" element={<VendorLoadInPage />} />
          <Route path="handoffs" element={<VendorHandoffsPage />} />
          <Route path="inbox" element={<VendorInboxPage />} />
          <Route path="messages" element={<VendorMessagesPage />} />
          <Route path="inbox/chat/:peerId" element={<VendorB2bChatPage />} />
          <Route
            path="inbox/thread/:threadId"
            element={<OrderContextThreadPage viewerRole="vendor" backTo="/vendor/inbox" />}
          />
          <Route path="network" element={<VendorNetworkPage />} />
          <Route path="procurement" element={<VendorProcurementPage />} />
          <Route path="wholesale" element={<ChefProcurementPage />} />
          <Route path="analytics" element={<VendorAnalyticsPage />} />
          <Route path="analytics/integrations" element={<VendorAnalyticsIntegrationsPage />} />
          <Route path="orders" element={<VendorOrdersPage />} />
          <Route path="products" element={<VendorProductsPage />} />
          <Route path="posts" element={<VendorPostsPage />} />
          <Route path="profile" element={<VendorProfilePage />} />
          <Route path="catering" element={<VendorCateringSettingsPage />} />
          <Route path="availability" element={<VendorAvailabilityPage />} />
          <Route path="loyalty" element={<VendorLoyaltyPage />} />
          <Route path="financials" element={<VendorFinancialsPage />} />
        </Route>

        <Route path="/farmer" element={<VendorLayout />}>
          <Route index element={<Navigate to="logistics" replace />} />
          <Route path="logistics" element={<FarmerLogisticsPage />} />
          <Route path="network" element={<VendorNetworkPage />} />
          <Route path="procurement" element={<VendorProcurementPage />} />
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
        <Route path="/vendor/settings/payments" element={<VendorPaymentsPage />} />
        <Route path="/vendor/pos" element={<VendorPosPage />} />
        <Route path="/vendor/pos/activity" element={<VendorPosActivityPage />} />
        <Route path="/vendor/pos/connected" element={<VendorPosConnectedPage />} />
        <Route path="/vendor/pos/mappings" element={<VendorPosMappingsPage />} />
        <Route path="/vendor/pos/:id" element={<VendorPosConnectionPage />} />
        <Route path="/vendor/preview" element={<VendorPreviewPage />} />
        <Route path="/vendor/explore" element={<VendorExplorePage />} />
        <Route path="/vendor/compliance" element={<VendorCompliancePage />} />
        <Route path="/vendor/credentials" element={<VendorCredentialsPage />} />

        <Route path="/dashboard/fulfillment" element={<Navigate to="/vendor/fulfillment" replace />} />

        <Route path="/chef" element={<ChefLayout />}>
          <Route path="setup" element={<ChefSetupPage />} />
          <Route path="dashboard" element={<ChefDashboardPage />} />
          <Route path="procurement" element={<ChefProcurementPage />} />
          <Route path="services" element={<ChefServicesPage />} />
          <Route path="bookings" element={<ChefBookingsPage />} />
          <Route path="portfolio" element={<ChefPortfolioPage />} />
          <Route path="profile" element={<ChefProfilePage />} />
        </Route>

        <Route path="/chef/services/new" element={<ChefServiceFormPage />} />
        <Route path="/chef/bookings/:id" element={<ChefBookingDetailPage />} />
        <Route path="/chef/credentials" element={<ChefCredentialsPage />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="mix-analytics" element={<AdminMixAnalyticsPage />} />
          <Route path="analytics" element={<AdminAnalyticsPage />} />
          <Route path="vendors" element={<AdminVendorsPage />} />
          <Route path="events" element={<AdminEventsPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="posts" element={<AdminPostsPage />} />
          <Route path="credentials" element={<AdminCredentialsPage />} />
          <Route path="community-events" element={<AdminCommunityEventsPage />} />
          <Route path="more" element={<AdminMorePage />} />
        </Route>

        <Route path="/admin/vendors/:id" element={<AdminVendorDetailPage />} />
        <Route path="/admin/events/new" element={<AdminEventFormPage />} />
        <Route path="/admin/events/:id" element={<AdminEventDetailPage />} />
        <Route path="/admin/orders/:id" element={<AdminOrderDetailPage />} />
        <Route path="/admin/posts/:id" element={<AdminPostDetailPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
