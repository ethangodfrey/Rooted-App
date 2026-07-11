import * as Linking from 'expo-linking';
import { Pressable, View } from 'react-native';

import { Text } from '@/src/components/ui/text';
import { getPrivacyPolicyUrl, getTermsOfServiceUrl } from '@/src/lib/legal-urls';

interface AuthLegalFooterProps {
  showConsent?: boolean;
  consentAccepted?: boolean;
  onConsentChange?: (accepted: boolean) => void;
}

export function AuthLegalFooter({
  showConsent = false,
  consentAccepted = false,
  onConsentChange,
}: AuthLegalFooterProps) {
  return (
    <View className="mt-6">
      {showConsent ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consentAccepted }}
          className="mb-4 flex-row items-start gap-3"
          onPress={() => onConsentChange?.(!consentAccepted)}>
          <View
            className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${
              consentAccepted ? 'border-primary bg-primary' : 'border-muted bg-surface'
            }`}>
            {consentAccepted ? <Text className="text-xs text-white">✓</Text> : null}
          </View>
          <Text className="flex-1 text-[13px] leading-[18px] text-subtle">
            I agree to the{' '}
            <Text
              className="text-[13px] text-primary"
              onPress={() => Linking.openURL(getTermsOfServiceUrl())}>
              Terms of Service
            </Text>{' '}
            and{' '}
            <Text
              className="text-[13px] text-primary"
              onPress={() => Linking.openURL(getPrivacyPolicyUrl())}>
              Privacy Policy
            </Text>
            .
          </Text>
        </Pressable>
      ) : (
        <Text className="text-center text-[13px] leading-[18px] text-subtle">
          By continuing, you agree to our{' '}
          <Text className="text-[13px] text-primary" onPress={() => Linking.openURL(getTermsOfServiceUrl())}>
            Terms of Service
          </Text>{' '}
          and{' '}
          <Text className="text-[13px] text-primary" onPress={() => Linking.openURL(getPrivacyPolicyUrl())}>
            Privacy Policy
          </Text>
          .
        </Text>
      )}
    </View>
  );
}
