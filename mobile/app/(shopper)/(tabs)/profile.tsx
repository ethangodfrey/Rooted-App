import { router } from 'expo-router';

import { Image, Pressable, View } from 'react-native';



import { Card } from '@/src/components/ui/card';

import { Screen } from '@/src/components/ui/screen';

import { Text } from '@/src/components/ui/text';

import { useAuth } from '@/src/hooks/use-auth';

import { colors } from '@/src/theme/colors';



function BigCard({

  icon,

  title,

  subtitle,

  onPress,

}: {

  icon: string;

  title: string;

  subtitle: string;

  onPress: () => void;

}) {

  return (

    <Pressable onPress={onPress} className="active:scale-[0.97]">

      <Card className="flex-row items-center gap-4 px-5 py-5">

        <View className="h-12 w-12 items-center justify-center rounded-xl bg-honeydew">

          <Text className="text-2xl">{icon}</Text>

        </View>

        <View className="min-w-0 flex-1">

          <Text variant="body" className="font-bold">

            {title}

          </Text>

          <Text variant="caption" className="mt-0.5">

            {subtitle}

          </Text>

        </View>

      </Card>

    </Pressable>

  );

}



export default function ShopperProfileScreen() {

  const { user, session, signOut } = useAuth();



  const displayEmail = user?.email ?? session?.user?.email ?? '—';

  const initials = (user?.name || displayEmail || '?').toString().trim().charAt(0).toUpperCase();

  const displayName = user?.name?.trim() || 'You';



  return (

    <Screen scroll>

      <View className="mb-8 items-center">

        {user?.profile_photo ? (

          <Image

            source={{ uri: user.profile_photo }}

            style={{

              width: 96,

              height: 96,

              borderRadius: 48,

              marginBottom: 12,

              borderWidth: 2,

              borderColor: colors.terracotta,

            }}

          />

        ) : (

          <View
            className="mb-3 h-24 w-24 items-center justify-center rounded-full bg-honeydew"
            style={{ borderWidth: 2, borderColor: colors.terracotta }}>
            <Text variant="title" style={{ color: colors.primary }}>

              {initials}

            </Text>

          </View>

        )}

        <Text variant="body" className="font-semibold">
          {displayName}
        </Text>

        <Text variant="caption" className="mt-1">

          {displayEmail}

        </Text>

      </View>



      <View className="gap-3">

        <BigCard

          icon="📋"

          title="Reservations"

          subtitle="Track reserve-for-pickup orders"

          onPress={() => router.push('/(shopper)/orders')}

        />

        <BigCard

          icon="♥"

          title="Saved"

          subtitle="Vendors, chefs, and products"

          onPress={() => router.push('/(shopper)/saved')}

        />

        <BigCard

          icon="⚙"

          title="Settings"

          subtitle="Profile, location, and preferences"

          onPress={() => router.push('/(shopper)/profile/edit')}

        />

      </View>



      <Pressable onPress={signOut} className="mt-12 py-3 active:opacity-70">
        <Text variant="caption" className="text-center text-muted" style={{ fontSize: 13 }}>
          Sign out
        </Text>
      </Pressable>

    </Screen>

  );

}

