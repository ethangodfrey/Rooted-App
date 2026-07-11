import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';

import { complianceChecklistForState } from '@/src/lib/compliance';
import { BadgeRow } from '@/src/components/trust/verification-badge';
import { ActionRow } from '@/src/components/ui/action-row';
import { Card } from '@/src/components/ui/card';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { supabase } from '@/src/lib/supabase';
import type { StateFoodRegulation, VendorCompliance } from '@/src/types/database';

export default function VendorComplianceScreen() {
  const { vendor, user } = useAuth();
  const [regs, setRegs] = useState<StateFoodRegulation | null>(null);
  const [compliance, setCompliance] = useState<VendorCompliance | null>(null);
  const [badges, setBadges] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const stateCode = vendor?.sell_state?.toUpperCase().slice(0, 2) ?? user?.state?.toUpperCase().slice(0, 2);

  useEffect(() => {
    async function load() {
      if (!vendor?.id) {
        setLoading(false);
        return;
      }

      const [regsRes, complianceRes, credsRes] = await Promise.all([
        stateCode
          ? supabase.from('state_food_regulations').select('*').eq('state_code', stateCode).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('vendor_compliance').select('*').eq('vendor_id', vendor.id).maybeSingle(),
        supabase
          .from('verification_credentials')
          .select('credential_type, verification_status')
          .eq('user_id', vendor.user_id),
      ]);

      setRegs(regsRes.data as StateFoodRegulation | null);
      setCompliance(complianceRes.data as VendorCompliance | null);

      const verifiedTypes =
        (credsRes.data ?? [])
          .filter((c) => c.verification_status === 'verified')
          .map((c) => c.credential_type) ?? [];
      setBadges(verifiedTypes);

      if (!complianceRes.data && stateCode) {
        await supabase.from('vendor_compliance').upsert({
          vendor_id: vendor.id,
          state_code: stateCode,
        });
      }

      setLoading(false);
    }

    void load();
  }, [vendor?.id, vendor?.user_id, stateCode]);

  const checklist = complianceChecklistForState(regs);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Food safety checklist',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      {loading ? (
        <View className="flex-1 items-center justify-center bg-canvas">
          <LoadingIndicator />
        </View>
      ) : (
        <Screen scroll>
          <Text variant="eyebrow" className="mb-2">
            Trust & compliance
          </Text>
          <Text variant="subtitle" className="mb-4">
            {stateCode ? `${regs?.state_name ?? stateCode} cottage food requirements` : 'Set your state in application details.'}
          </Text>

          {badges.length ? (
            <View className="mb-4">
              <BadgeRow badgeTypes={badges} />
            </View>
          ) : null}

          <Card className="mb-4">
            <Text variant="heading" className="mb-2">
              Status: {compliance?.compliance_status ?? 'pending_review'}
            </Text>
            {regs?.required_disclaimer ? (
              <Text variant="caption">{regs.required_disclaimer}</Text>
            ) : null}
          </Card>

          <View className="mb-4 gap-2">
            {checklist.map((item) => (
              <Text key={item.label} variant="body">
                {item.required ? '• ' : '○ '}
                {item.label}
              </Text>
            ))}
          </View>

          {regs?.regulation_url ? (
            <ActionRow
              icon="external-link"
              title="Official state guidance"
              subtitle="Open cottage food regulations"
              onPress={() => void Linking.openURL(regs.regulation_url!)}
            />
          ) : null}

          <ActionRow
            icon="upload"
            title="Upload credentials"
            subtitle="Food handler cert, cottage food permit, business license"
            onPress={() => router.push('/(vendor)/compliance/credentials')}
          />
        </Screen>
      )}
    </>
  );
}
