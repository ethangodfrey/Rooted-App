import * as Linking from 'expo-linking';
import { Pressable, View } from 'react-native';

import { Card } from '@/src/components/ui/card';
import { Text } from '@/src/components/ui/text';
import { getVendorVerificationCues, isApplicationReadyForReview } from '@/src/lib/vendor-application';
import type { Vendor } from '@/src/types/database';

interface VerificationCuesProps {
  vendor: Vendor;
  showLinks?: boolean;
}

export function VerificationCues({ vendor, showLinks = true }: VerificationCuesProps) {
  const cues = getVendorVerificationCues(vendor);
  const ready = isApplicationReadyForReview(vendor);

  return (
    <Card className={`mb-4 ${ready ? 'bg-honeydew' : 'bg-honeydew'}`}>
      <Text variant="heading" className="mb-1">
        Verification checklist
      </Text>
      <Text variant="caption" className="mb-4">
        {ready
          ? 'Application is complete — spot-check their link before approving.'
          : 'Application is incomplete — reject or ask the vendor to resubmit.'}
      </Text>

      {cues.map((cue) => (
        <View key={cue.label} className="mb-3 flex-row gap-3">
          <Text className="text-base">{cue.ok ? '✓' : '○'}</Text>
          <View className="flex-1">
            <Text variant="body" className="font-semibold">
              {cue.label}
            </Text>
            {cue.detail ? <Text variant="caption">{cue.detail}</Text> : null}
          </View>
        </View>
      ))}

      {showLinks && (vendor.instagram_url || vendor.website_url) ? (
        <View className="mt-2 gap-2">
          {vendor.instagram_url ? (
            <Pressable onPress={() => Linking.openURL(vendor.instagram_url!)}>
              <Text className="text-sm font-medium text-forest">Open Instagram</Text>
            </Pressable>
          ) : null}
          {vendor.website_url ? (
            <Pressable onPress={() => Linking.openURL(vendor.website_url!)}>
              <Text className="text-sm font-medium text-forest">Open website</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}
