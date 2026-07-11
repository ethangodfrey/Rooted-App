import { Linking } from 'react-native';

import { Text } from '@/src/components/ui/text';
import { getPrivacyPolicyUrl, getTermsOfServiceUrl } from '@/src/lib/legal';

export function AuthLegalNotice() {
  const termsUrl = getTermsOfServiceUrl();
  const privacyUrl = getPrivacyPolicyUrl();

  return (
    <Text className="mt-4 text-center text-xs leading-[18px] text-subtle">
      By creating an account, you agree to our{' '}
      <Text className="text-primary underline" onPress={() => Linking.openURL(termsUrl)}>
        Terms of Service
      </Text>{' '}
      and{' '}
      <Text className="text-primary underline" onPress={() => Linking.openURL(privacyUrl)}>
        Privacy Policy
      </Text>
      .
    </Text>
  );
}
