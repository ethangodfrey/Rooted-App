import { router } from 'expo-router';

import { type ReactNode, memo } from 'react';

import { Pressable, ScrollView, View, Image } from 'react-native';



import { PostCard, type FeedPost } from '@/src/components/feed/post-card';

import { Card } from '@/src/components/ui/card';

import { HomeSectionSkeleton } from '@/src/components/ui/skeleton';

import { Text } from '@/src/components/ui/text';

import { formatEventDate, formatPrice } from '@/src/lib/format';

import { formatDistanceKm } from '@/src/lib/geo-search';

import type { DiscoverFeedData } from '@/src/lib/discover-feed';

import { formatExpiresIn } from '@/src/lib/leftovers';
import { categoryVisual } from '@/src/lib/category-visuals';

import type { PopularProduct, SuggestedProduct } from '@/src/lib/suggested-products';

import { colors } from '@/src/theme/colors';



function HScrollSection({

  title,

  actionLabel,

  onAction,

  children,

}: {

  title: string;

  actionLabel?: string;

  onAction?: () => void;

  children: ReactNode;

}) {

  return (

    <View className="mb-6">

      <View className="mb-3 flex-row items-center justify-between">

        <Text variant="heading">{title}</Text>

        {actionLabel && onAction ? (

          <Pressable onPress={onAction}>

            <Text variant="caption" className="font-semibold text-primary">

              {actionLabel}

            </Text>

          </Pressable>

        ) : null}

      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>

        {children}

      </ScrollView>

    </View>

  );

}



const TileCard = memo(function TileCard({

  title,

  meta,

  badge,

  emoji,

  onPress,

}: {

  title: string;

  meta?: string;

  badge?: string;

  emoji?: string;

  onPress: () => void;

}) {

  return (

    <Pressable onPress={onPress} className="active:scale-[0.98]">

      <Card className="w-56 overflow-hidden p-0" style={{ width: 220 }}>

        <View

          className="h-[72px] items-center justify-center"

          style={{ backgroundColor: colors.warmSage }}>

          <Text className="text-3xl">{emoji ?? '🌿'}</Text>

        </View>

        <View className="px-4 py-4">

          {badge ? (

            <View

              className="mb-2 self-start rounded-full px-2 py-0.5"

              style={{ backgroundColor: colors.warmSageAlt }}>

              <Text className="text-xs font-semibold text-accent">{badge}</Text>

            </View>

          ) : null}

          <Text variant="body" className="font-semibold" numberOfLines={2}>

            {title}

          </Text>

          {meta ? (

            <Text variant="caption" className="mt-1" numberOfLines={2}>

              {meta}

            </Text>

          ) : null}

        </View>

      </Card>

    </Pressable>

  );

});



function productCategory(product: PopularProduct | SuggestedProduct): string | null {

  if ('matchedInterest' in product) return product.category ?? product.matchedInterest;

  return product.category;

}



const ProductTileCard = memo(function ProductTileCard({

  product,

  onPress,

}: {

  product: PopularProduct | SuggestedProduct;

  onPress: () => void;

}) {

  const category = productCategory(product);

  const visual = categoryVisual(category);

  return (

    <Pressable onPress={onPress} className="active:scale-[0.98]">

      <Card className="overflow-hidden p-0" style={{ width: 160 }}>

        <View

          className="h-[120px] items-center justify-center overflow-hidden"

          style={{ backgroundColor: colors.warmSage }}>

          {product.displayImageUrl ? (

            <Image

              source={{ uri: product.displayImageUrl }}

              className="h-full w-full"

              resizeMode="cover"

              fadeDuration={200}

            />

          ) : (

            <Text className="text-4xl">{visual.emoji}</Text>

          )}

        </View>

        <View className="px-3 py-3">

          <Text variant="body" className="font-semibold" numberOfLines={2}>

            {product.name}

          </Text>

          <Text variant="caption" className="mt-1" numberOfLines={2}>

            {product.vendor?.business_name ?? 'Vendor'} · {formatPrice(product.price)}

          </Text>

        </View>

      </Card>

    </Pressable>

  );

});



function PostsEmptyState() {

  return (

    <View

      className="items-center rounded-bento px-5 py-8"

      style={{ backgroundColor: colors.warmSage }}>

      <Text className="text-3xl">📮</Text>

      <Text variant="subtitle" className="mt-3 text-center font-semibold">

        No updates yet

      </Text>

      <Text variant="caption" className="mt-2 text-center" style={{ opacity: 0.8 }}>

        Save vendors to see their postcards here, or check back after market days.

      </Text>

    </View>

  );

}



interface DiscoverBrowseFeedProps {

  data: DiscoverFeedData | null;

  loading: boolean;

}



export function DiscoverBrowseFeed({ data, loading }: DiscoverBrowseFeedProps) {

  if (loading && !data) {

    return (

      <View>

        <HomeSectionSkeleton />

        <HomeSectionSkeleton />

      </View>

    );

  }



  if (!data) return null;



  const { posts, postsFocus, markets, vendors, chefs, products, leftovers } = data;

  const postsTitle = postsFocus === 'saved' ? 'From vendors you follow' : 'Fresh updates';

  const hasBrowseMore =

    markets.length > 0 || vendors.length > 0 || chefs.length > 0 || leftovers.length > 0;

  const hasPrimary = posts.length > 0 || products.length > 0;



  if (!hasPrimary && !hasBrowseMore) {

    return (

      <Text variant="caption" style={{ opacity: 0.72 }}>

        Local picks will appear as markets, vendors, and chefs join Vendorly near you.

      </Text>

    );

  }



  return (

    <View>

      <View className="mb-6">

        <View className="mb-3 flex-row items-center justify-between">

          <Text variant="heading">{postsTitle}</Text>

          <Pressable onPress={() => router.push('/(shopper)/(tabs)/feed')}>

            <Text variant="caption" className="font-semibold text-primary">

              See all

            </Text>

          </Pressable>

        </View>

        {posts.length > 0 ? (

          <View className="gap-3">

            {posts.slice(0, 4).map((post: FeedPost) => (

              <PostCard

                key={post.id}

                post={post}

                onPressVendor={(vendorId) => router.push(`/(shopper)/vendors/${vendorId}`)}

                onPressProduct={(productId) => router.push(`/(shopper)/products/${productId}`)}

                onPressEvent={(eventId) => router.push(`/(shopper)/events/${eventId}`)}

              />

            ))}

          </View>

        ) : (

          <PostsEmptyState />

        )}

      </View>



      {products.length > 0 ? (

        <HScrollSection title="Popular products">

          {products.slice(0, 10).map((product) => (

            <ProductTileCard

              key={product.id}

              product={product}

              onPress={() => router.push(`/(shopper)/products/${product.id}`)}

            />

          ))}

        </HScrollSection>

      ) : null}



      {hasBrowseMore ? (

        <>

          <Text variant="heading" className="mb-4">

            Browse more

          </Text>



          {markets.length > 0 ? (

            <HScrollSection

              title="Markets"

              actionLabel="See all"

              onAction={() => router.push('/(shopper)/(tabs)/events')}>

              {markets.slice(0, 10).map((event) => (

                <TileCard

                  key={event.id}

                  emoji="🧺"

                  title={event.name}

                  meta={[

                    formatEventDate(event.start_datetime),

                    event.city,

                    formatDistanceKm(event.distance_km),

                  ]

                    .filter(Boolean)

                    .join(' · ')}

                  onPress={() => router.push(`/(shopper)/events/${event.id}`)}

                />

              ))}

            </HScrollSection>

          ) : null}



          {vendors.length > 0 ? (

            <HScrollSection title="Local businesses">

              {vendors.slice(0, 8).map((vendor) => (

                <TileCard

                  key={vendor.id}

                  emoji="🏪"

                  title={vendor.business_name ?? 'Vendor'}

                  meta={

                    [vendor.category, formatDistanceKm(vendor.distance_km)].filter(Boolean).join(' · ') ||

                    [vendor.sell_city, vendor.sell_state].filter(Boolean).join(', ') ||

                    'Local vendor'

                  }

                  onPress={() => router.push(`/(shopper)/vendors/${vendor.id}`)}

                />

              ))}

            </HScrollSection>

          ) : null}



          {chefs.length > 0 ? (

            <HScrollSection

              title="Private chefs"

              actionLabel="See all"

              onAction={() => router.push('/(shopper)/chefs')}>

              {chefs.slice(0, 8).map((chef) => (

                <TileCard

                  key={chef.id}

                  emoji="👨‍🍳"

                  badge={chef.featured ? 'Featured' : undefined}

                  title={chef.display_name}

                  meta={

                    [chef.home_base_city, chef.home_base_state].filter(Boolean).join(', ') ||

                    'Private chef'

                  }

                  onPress={() => router.push(`/(shopper)/chefs/${chef.id}`)}

                />

              ))}

            </HScrollSection>

          ) : null}



          {leftovers.length > 0 ? (

            <HScrollSection

              title="Leftovers near you"

              actionLabel="See all"

              onAction={() => router.push('/(shopper)/leftovers')}>

              {leftovers.slice(0, 6).map((listing) => (

                <TileCard

                  key={listing.id}

                  emoji="♻️"

                  title={listing.title}

                  meta={`${formatPrice(listing.price_cents)} · ${formatExpiresIn(listing.hoursLeft)}`}

                  onPress={() => router.push(`/(shopper)/leftovers/${listing.id}`)}

                />

              ))}

            </HScrollSection>

          ) : null}

        </>

      ) : null}

    </View>

  );

}


