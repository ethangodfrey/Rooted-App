import { FontAwesome } from '@expo/vector-icons';

import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';

import { LoadingIndicator } from '@/src/components/ui/loading-indicator';

import { router, Stack, useLocalSearchParams } from 'expo-router';

import { useEffect, useState } from 'react';

import { Pressable, View } from 'react-native';



import { Button } from '@/src/components/ui/button';

import { Card } from '@/src/components/ui/card';

import { Input } from '@/src/components/ui/input';

import { Screen } from '@/src/components/ui/screen';

import { Text } from '@/src/components/ui/text';

import { TextArea } from '@/src/components/ui/text-area';

import {

  VendorStorefrontView,

  type StorefrontProduct,

} from '@/src/components/vendor/vendor-storefront-view';

import { useAuth } from '@/src/hooks/use-auth';

import { useSavedVendors } from '@/src/hooks/use-saved-vendors';

import { TrustBadgeRow } from '@/src/components/trust/trust-badge-row';

import { fetchApprovedReviews, submitReview } from '@/src/lib/reviews';

import { parseThemeSettings, resolveAccentColor } from '@/src/lib/vendor-storefront';

import { fetchAwardedBadges, type AwardedBadge } from '@/src/lib/verification';

import { supabase } from '@/src/lib/supabase';

import type { Review, Vendor } from '@/src/types/database';



export default function VendorStorefrontScreen() {

  const { id } = useLocalSearchParams<{ id: string }>();

  const { user } = useAuth();

  const [vendor, setVendor] = useState<Vendor | null>(null);

  const [badges, setBadges] = useState<AwardedBadge[]>([]);

  const [products, setProducts] = useState<StorefrontProduct[]>([]);

  const [reviews, setReviews] = useState<Review[]>([]);

  const [reviewTitle, setReviewTitle] = useState('');

  const [reviewText, setReviewText] = useState('');

  const [reviewRating, setReviewRating] = useState(5);

  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const { isSaved, toggle, pending } = useSavedVendors();

  const saved = isSaved(id);



  const accent = vendor

    ? resolveAccentColor(parseThemeSettings(vendor.theme_settings).accent_color)

    : '#228B22';



  useEffect(() => {

    let active = true;

    async function load() {

      const [vendorRes, productsRes, reviewsRes] = await Promise.all([

        supabase.from('vendors').select('*').eq('id', id).maybeSingle(),

        supabase

          .from('products')

          .select(

            'id, name, description, price, category, reserve_enabled, media_urls, product_event_availability(available_quantity_presale)',

          )

          .eq('vendor_id', id)

          .eq('status', 'active')

          .order('created_at', { ascending: false }),

        fetchApprovedReviews('vendor', id),

      ]);



      if (!active) return;

      if (vendorRes.error) {

        setError(vendorRes.error.message);

      } else if (!vendorRes.data) {

        setError('This vendor is not available.');

      } else {

        setVendor(vendorRes.data);

      }

      if (!productsRes.error && productsRes.data) {

        setProducts(productsRes.data as unknown as StorefrontProduct[]);

      }

      setReviews(reviewsRes.reviews);

      setLoading(false);

    }

    load();

    return () => {

      active = false;

    };

  }, [id]);



  const vendorUserId = vendor?.user_id ?? null;

  useEffect(() => {

    if (!vendorUserId) return;

    let active = true;

    fetchAwardedBadges(vendorUserId).then((rows) => {

      if (active) setBadges(rows);

    });

    return () => {

      active = false;

    };

  }, [vendorUserId]);



  async function handleSubmitReview() {

    if (!user?.id) {

      setReviewMessage('Sign in to leave a review.');

      return;

    }



    setReviewSubmitting(true);

    setReviewMessage(null);



    const result = await submitReview({

      targetType: 'vendor',

      targetId: id,

      reviewerId: user.id,

      overallRating: reviewRating,

      reviewTitle,

      reviewText,

    });



    setReviewSubmitting(false);



    if (result.error) {

      setReviewMessage(result.error);

      return;

    }



    setReviewTitle('');

    setReviewText('');

    setReviewRating(5);

    setReviewMessage('Thanks! Your review was submitted for moderation.');

  }



  return (

    <>

      <Stack.Screen

        options={{

          headerShown: true,

          title: 'Vendor',

          headerBackTitle: 'Back',

          ...rootedStackScreenOptions,

          headerRight: () =>

            vendor ? (

              <Pressable onPress={() => toggle(id)} disabled={pending} hitSlop={8}>

                <FontAwesome

                  name={saved ? 'heart' : 'heart-o'}

                  size={20}

                  color={saved ? '#bc4749' : accent}

                />

              </Pressable>

            ) : null,

        }}

      />

      {loading ? (

        <View className="flex-1 items-center justify-center bg-canvas">

          <LoadingIndicator />

        </View>

      ) : error || !vendor ? (

        <Screen centered>

          <Text variant="subtitle" className="text-center">

            {error ?? 'This vendor is not available.'}

          </Text>

        </Screen>

      ) : (

        <Screen scroll>

          <VendorStorefrontView

            vendor={vendor}

            products={products}

            headerAccessory={<TrustBadgeRow badges={badges} compact />}

            onPressProduct={(productId) => router.push(`/(shopper)/products/${productId}`)}

          />



          <Text variant="heading" className="mb-3 mt-8">

            Reviews

          </Text>

          {reviews.length === 0 ? (

            <Text variant="caption" className="mb-4">

              No approved reviews yet.

            </Text>

          ) : (

            <View className="mb-6 gap-3">

              {reviews.map((review) => (

                <Card key={review.id}>

                  <View className="mb-1 flex-row items-center gap-1">

                    {Array.from({ length: review.overall_rating }).map((_, index) => (

                      <FontAwesome key={index} name="star" size={14} color="#D4A017" />

                    ))}

                  </View>

                  {review.review_title ? (

                    <Text variant="body" className="mb-1 font-semibold">

                      {review.review_title}

                    </Text>

                  ) : null}

                  {review.review_text ? <Text variant="body">{review.review_text}</Text> : null}

                </Card>

              ))}

            </View>

          )}



          <Card className="mb-8">

            <Text variant="heading" className="mb-3">

              Write a review

            </Text>

            <View className="mb-4 flex-row items-center gap-2">

              {[1, 2, 3, 4, 5].map((rating) => (

                <Pressable key={rating} onPress={() => setReviewRating(rating)} hitSlop={6}>

                  <FontAwesome

                    name={rating <= reviewRating ? 'star' : 'star-o'}

                    size={22}

                    color="#D4A017"

                  />

                </Pressable>

              ))}

            </View>

            <Input

              label="Title (optional)"

              value={reviewTitle}

              onChangeText={setReviewTitle}

              placeholder="Great market find"

              className="mb-3"

            />

            <TextArea

              label="Review"

              value={reviewText}

              onChangeText={setReviewText}

              placeholder="Share your experience..."

              minHeight={96}

              className="mb-4"

            />

            {reviewMessage ? (

              <Text variant="caption" className="mb-3">

                {reviewMessage}

              </Text>

            ) : null}

            <Button label="Submit review" loading={reviewSubmitting} onPress={handleSubmitReview} />

          </Card>

        </Screen>

      )}

    </>

  );

}

