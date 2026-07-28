export type AppRole = 'shopper' | 'vendor' | 'farmer' | 'chef' | 'admin';

export interface AuthenticatedUser {
  id: string;
  role: AppRole;
  /** Present when the user has a vendor profile. */
  vendorId?: string;
  /** Present when the user has a chef profile. */
  chefId?: string;
  email?: string;
}
