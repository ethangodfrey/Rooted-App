import { api } from '@/src/lib/api';

export type VerifyHandoffSuccess = {
  STATUS: 'SUCCESS';
  CODE: string;
};

export type VerifyHandoffError = {
  STATUS: 'ERROR';
  REASON: 'INVALID_OR_ALREADY_REDEEMED' | string;
};

export type VerifyHandoffResponse = VerifyHandoffSuccess | VerifyHandoffError;

export async function verifyHandoffCode(code: string): Promise<VerifyHandoffResponse> {
  return api.post<VerifyHandoffResponse>('/orders/verify-handoff', { code });
}
