import { DeleteAccountSection } from '@/components/account/DeleteAccountSection';
import { LegalLinks } from '@/components/account/LegalLinks';
import { SpecialtyPills } from '@/components/ui/SpecialtyPills';
import { UserSticker } from '@/components/ui/UserSticker';
import {
  VendorFormPanel,
  VendorHero,
  VendorListPanel,
  VendorListRow,
  VendorPrimaryButton,
  VendorScreen,
  VendorSection,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import '@/components/ui/ui.css';
import '@/components/ui/user-sticker.css';

export function VendorProfilePage() {
  const { user, vendor, signOut } = useAuth();
  const stickerRole = user?.role === 'farmer' ? 'farmer' : 'vendor';
  const specialties =
    stickerRole === 'farmer' ? (user?.farmer_specialties ?? []) : (user?.vendor_specialties ?? []);

  return (
    <VendorScreen>
      <VendorHero
        eyebrow="Account"
        title="Profile"
        pill={vendor?.approval_status}
        subtitle={vendor?.business_name ?? undefined}
      />

      <VendorSection title="Account">
        <VendorFormPanel>
          <div className="user-sticker-row mb-2">
            <p className="m-0 text-sm font-semibold text-stone-800">
              {user?.name?.trim() || vendor?.business_name || 'Vendor'}
            </p>
            <UserSticker role={stickerRole} />
          </div>
          <SpecialtyPills specialties={specialties} style={{ marginBottom: '0.75rem' }} />
          <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-stone-400">Email</p>
          <p className="m-0 mt-1 text-sm font-semibold text-stone-800">{user?.email}</p>
        </VendorFormPanel>
      </VendorSection>

      <VendorSection title="Settings">
        <VendorListPanel>
          <VendorListRow to="/onboarding/specialties" title="Edit specialties" icon="grid" tone="amber" />
          <VendorListRow to="/vendor/storefront" title="Edit storefront" icon="store" tone="orange" />
          <VendorListRow to="/vendor/preview" title="Preview shop" icon="grid" tone="stone" />
          <VendorListRow to="/vendor/setup" title="Application details" icon="clipboard" tone="stone" />
          <VendorListRow to="/vendor/events" title="My events" icon="calendar" tone="sky" />
          <VendorListRow to="/vendor/pos" title="Point of Sale" icon="credit-card" tone="amber" />
          <VendorListRow to="/vendor/compliance" title="Food safety checklist" icon="shield-check" tone="teal" />
          <VendorListRow to="/vendor/credentials" title="Verification credentials" icon="badge" tone="emerald" />
        </VendorListPanel>
      </VendorSection>

      <VendorPrimaryButton className="mt-6 w-full" onClick={() => void signOut()}>
        Sign out
      </VendorPrimaryButton>

      <LegalLinks />
      <DeleteAccountSection />
    </VendorScreen>
  );
}
