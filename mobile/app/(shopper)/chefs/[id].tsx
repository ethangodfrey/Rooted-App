import { FontAwesome } from '@expo/vector-icons';

import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';

import { router, Stack, useLocalSearchParams } from 'expo-router';

import { useEffect, useState } from 'react';

import { Pressable } from 'react-native';



import { ServiceCard } from '@/src/components/chef/service-card';

import { TrustBadgeRow } from '@/src/components/trust/trust-badge-row';

import { LoadingIndicator } from '@/src/components/ui/loading-indicator';

import { Screen } from '@/src/components/ui/screen';

import { Text } from '@/src/components/ui/text';

import { useSavedItems } from '@/src/hooks/use-saved-items';

import { supabase } from '@/src/lib/supabase';

import { fetchAwardedBadges, type AwardedBadge } from '@/src/lib/verification';

import type { Chef, ChefService } from '@/src/types/database';



export default function ChefDetailScreen() {

  const { id } = useLocalSearchParams<{ id: string }>();

  const [chef, setChef] = useState<Chef | null>(null);

  const [badges, setBadges] = useState<AwardedBadge[]>([]);

  const [services, setServices] = useState<ChefService[]>([]);

  const [loading, setLoading] = useState(true);

  const { isSaved, toggle, pending } = useSavedItems();

  const saved = isSaved('chef', id);



  useEffect(() => {

    async function load() {

      const [chefRes, servicesRes] = await Promise.all([

        supabase.from('chefs').select('*').eq('id', id).maybeSingle(),

        supabase.from('chef_services').select('*').eq('chef_id', id).eq('active', true),

      ]);

      setChef(chefRes.data);

      setServices((servicesRes.data ?? []) as ChefService[]);

      setLoading(false);

    }

    void load();

  }, [id]);



  const chefUserId = chef?.user_id ?? null;

  useEffect(() => {

    if (!chefUserId) return;

    let active = true;

    fetchAwardedBadges(chefUserId).then((rows) => {

      if (active) setBadges(rows);

    });

    return () => {

      active = false;

    };

  }, [chefUserId]);



  return (

    <>

      <Stack.Screen

        options={{

          headerShown: true,

          title: 'Chef',

          headerBackTitle: 'Back',

          ...rootedStackScreenOptions,

          headerRight: () =>

            chef ? (

              <Pressable onPress={() => toggle({ itemType: 'chef', itemId: id })} disabled={pending} hitSlop={8}>

                <FontAwesome

                  name={saved ? 'heart' : 'heart-o'}

                  size={20}

                  color={saved ? '#bc4749' : '#228B22'}

                />

              </Pressable>

            ) : null,

        }}

      />

      {loading ? (

        <Screen>

          <LoadingIndicator />

        </Screen>

      ) : !chef ? (

        <Screen>

          <Text>Chef not found.</Text>

        </Screen>

      ) : (

        <Screen scroll>

          <Text variant="title" className="mb-2">

            {chef.display_name}

          </Text>

          <Text variant="subtitle" className="mb-4">

            {chef.home_base_city}, {chef.home_base_state}

          </Text>

          <TrustBadgeRow badges={badges} className="mb-4" compact />

          {chef.bio ? <Text variant="body" className="mb-6">{chef.bio}</Text> : null}



          <Text variant="heading" className="mb-3">

            Services

          </Text>

          {services.length === 0 ? (

            <Text variant="caption">No services listed yet.</Text>

          ) : (

            services.map((service) => (

              <ServiceCard

                key={service.id}

                service={service}

                onPress={() => router.push(`/(shopper)/chefs/book/${service.id}`)}

              />

            ))

          )}

        </Screen>

      )}

    </>

  );

}

