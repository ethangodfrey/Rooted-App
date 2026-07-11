import { Linking, Pressable, View } from 'react-native';

import { Text } from '@/src/components/ui/text';
import { getPrivacyPolicyUrl, getTermsOfServiceUrl } from '@/src/lib/legal-urls';

interface LegalConsentProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function LegalConsent({ checked, onChange }: LegalConsentProps) {
  const privacyUrl = getPrivacyPolicyUrl();
  const termsUrl = getTermsOfServiceUrl();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      className="mb-4 flex-row items-start gap-3"
      onPress={() => onChange(!checked)}>
      <View
        className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${
          checked ? 'border-primary bg-primary' : 'border-muted bg-white'
        }`}>
        {checked ? <Text className="text-xs font-bold text-white">✓</Text> : null}
      </View>
      <Text className="flex-1 text-sm leading-5 text-subtle">
        I agree to the{' '}
        <Text
          className="text-sm font-medium text-primary"
          onPress={() => Linking.openURL(termsUrl)}>
          Terms of Service
        </Text>{' '}
        and{' '}
        <Text
          className="text-sm font-medium text-primary"
          onPress={() => Linking.openURL(privacyUrl)}>
          Privacy Policy
        </Text>
        .
      </Text>
    </Pressable>
  );
}
