import { Linking, Pressable } from 'react-native';

import { Text } from '@/src/components/ui/text';
import { getPrivacyPolicyUrl, getSupportUrl, getTermsOfServiceUrl } from '@/src/lib/legal';

export function LegalLinks() {
  const links = [
    { label: 'Terms of Service', url: getTermsOfServiceUrl() },
    { label: 'Privacy Policy', url: getPrivacyPolicyUrl() },
    { label: 'Support', url: getSupportUrl() },
  ];

  return (
    <Pressable className="mt-6 items-center gap-1" accessibilityRole="none">
      {links.map((link) => (
        <Pressable
          key={link.label}
          accessibilityRole="link"
          onPress={() => Linking.openURL(link.url)}>
          <Text className="text-sm text-primary">{link.label}</Text>
        </Pressable>
      ))}
    </Pressable>
  );
}
