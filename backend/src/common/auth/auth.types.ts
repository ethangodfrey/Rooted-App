export type AppRole = 'shopper' | 'vendor' | 'admin';

export interface AuthenticatedUser {
  id: string;
  role: AppRole;
  /** Present when the user has a vendor profile. */
  vendorId?: string;
  email?: string;
}
