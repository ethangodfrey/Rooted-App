import { supabase } from '@/lib/supabase';

export interface ShopperProfileInput {
  name?: string;
  phone?: string;
  profile_photo?: string | null;
}

export async function updateShopperProfile(
  userId: string,
  input: ShopperProfileInput,
): Promise<{ error: string | null }> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) {
    payload.name = input.name.trim() || null;
  }
  if (input.phone !== undefined) {
    payload.phone = input.phone.trim() || null;
  }
  if (input.profile_photo !== undefined) {
    payload.profile_photo = input.profile_photo;
  }

  const { error } = await supabase.from('users').update(payload).eq('id', userId);

  return { error: error?.message ?? null };
}

export async function updateShopperEmail(
  newEmail: string,
): Promise<{ error: string | null; confirmationRequired: boolean }> {
  const trimmed = newEmail.trim();
  if (!trimmed) {
    return { error: 'Email is required.', confirmationRequired: false };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.updateUser({ email: trimmed });

  if (error) {
    return { error: error.message, confirmationRequired: false };
  }

  const confirmationRequired = user?.email !== trimmed;

  if (user?.id && !confirmationRequired) {
    await supabase
      .from('users')
      .update({ email: trimmed, updated_at: new Date().toISOString() })
      .eq('id', user.id);
  }

  return { error: null, confirmationRequired };
}
