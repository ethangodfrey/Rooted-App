import { Linking, Pressable, View } from 'react-native';

import { ExternalLink } from '@/components/ExternalLink';
import { Text } from '@/src/components/ui/text';
import { getPrivacyPolicyUrl, getTermsOfServiceUrl } from '@/src/lib/legal-urls';

export function AuthLegalNotice() {
  return (
    <Text className="mt-4 text-center text-[13px] leading-[18px] text-subtle">
      By continuing, you agree to our{' '}
      <ExternalLink href={getTermsOfServiceUrl()}>
        <Text className="text-[13px] text-primary">Terms of Service</Text>
      </ExternalLink>{' '}
      and{' '}
      <ExternalLink href={getPrivacyPolicyUrl()}>
        <Text className="text-[13px] text-primary">Privacy Policy</Text>
      </ExternalLink>
      .
    </Text>
  );
}

interface TermsConsentProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function TermsConsent({ checked, onChange }: TermsConsentProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      className="mt-4 flex-row items-start gap-3"
      onPress={() => onChange(!checked)}>
      <View
        className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${
          checked ? 'border-primary bg-primary' : 'border-muted bg-white'
        }`}>
        {checked ? <Text className="text-xs font-bold text-white">✓</Text> : null}
      </View>
      <Text className="flex-1 text-[13px] leading-[18px] text-subtle">
        I agree to the{' '}
        <Text className="text-primary" onPress={() => Linking.openURL(getTermsOfServiceUrl())}>
          Terms of Service
        </Text>{' '}
        and{' '}
        <Text className="text-primary" onPress={() => Linking.openURL(getPrivacyPolicyUrl())}>
          Privacy Policy
        </Text>
        .
      </Text>
    </Pressable>
  );
}
