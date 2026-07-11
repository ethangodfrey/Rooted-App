import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Linking from 'expo-linking';

/** Deep link the backend should bounce to after Square OAuth (Expo Go uses exp://). */
export function getPosOAuthReturnUrl(): string {
  const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  return Linking.createURL('pos/connected', inExpoGo ? undefined : { scheme: 'vendorly' });
}
