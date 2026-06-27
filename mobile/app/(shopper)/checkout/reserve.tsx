import { FontAwesome } from '@expo/vector-icons';

import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';

import { LoadingIndicator } from '@/src/components/ui/loading-indicator';

import { router, Stack, useLocalSearchParams } from 'expo-router';

import { useEffect, useMemo, useState } from 'react';

import { Pressable, View } from 'react-native';



import { Button } from '@/src/components/ui/button';

import { Card } from '@/src/components/ui/card';

import { Screen } from '@/src/components/ui/screen';

import { Text } from '@/src/components/ui/text';

import { TextArea } from '@/src/components/ui/text-area';

import { useAuth } from '@/src/hooks/use-auth';

import { formatEventFullDate, formatPrice } from '@/src/lib/format';

import { supabase } from '@/src/lib/supabase';



interface AvailabilityOption {

  available_quantity_presale: number;

  reserved_quantity: number;

  event: {

    id: string;

    name: string;

    start_datetime: string;

    city: string | null;

    state: string | null;

  } | null;

}



interface ReserveProduct {

  id: string;

  name: string;

  price: number;

  reserve_enabled: boolean;

}



interface ReserveInventoryResult {

  success: boolean;

  error?: string;

  hold_id?: string;

  available?: number;

}



interface HoldActionResult {

  success: boolean;

  error?: string;

}



function effectiveAvailable(opt: AvailabilityOption): number {

  return Math.max(0, opt.available_quantity_presale - (opt.reserved_quantity ?? 0));

}



export default function ReserveScreen() {

  const { productId } = useLocalSearchParams<{ productId: string }>();

  const { user } = useAuth();

  const [product, setProduct] = useState<ReserveProduct | null>(null);

  const [options, setOptions] = useState<AvailabilityOption[]>([]);

  const [eventId, setEventId] = useState<string | null>(null);

  const [quantity, setQuantity] = useState(1);

  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);

  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);



  const selectedOption = useMemo(

    () => options.find((opt) => opt.event?.id === eventId) ?? null,

    [options, eventId],

  );



  const maxQuantity = selectedOption ? effectiveAvailable(selectedOption) : 0;



  useEffect(() => {

    let active = true;

    async function load() {

      const [productRes, availRes] = await Promise.all([

        supabase

          .from('products')

          .select('id, name, price, reserve_enabled')

          .eq('id', productId)

          .maybeSingle(),

        supabase

          .from('product_event_availability')

          .select(

            'available_quantity_presale, reserved_quantity, event:events(id, name, start_datetime, city, state)',

          )

          .eq('product_id', productId)

          .gt('available_quantity_presale', 0),

      ]);



      if (!active) return;

      if (productRes.error || !productRes.data) {

        setError('Product not found.');

      } else {

        setProduct(productRes.data);

      }

      if (!availRes.error && availRes.data) {

        const opts = (availRes.data as unknown as AvailabilityOption[]).filter(

          (opt) => effectiveAvailable(opt) > 0,

        );

        setOptions(opts);

        if (opts.length === 1 && opts[0].event) {

          setEventId(opts[0].event.id);

        }

      }

      setLoading(false);

    }

    load();

    return () => {

      active = false;

    };

  }, [productId]);



  useEffect(() => {

    if (maxQuantity > 0 && quantity > maxQuantity) {

      setQuantity(maxQuantity);

    }

  }, [maxQuantity, quantity]);



  async function handleSubmit() {

    if (!eventId) {

      setError('Select an event for pickup.');

      return;

    }

    if (!user?.id) {

      setError('Sign in to place a reservation.');

      return;

    }

    if (maxQuantity < quantity) {

      setError(`Only ${maxQuantity} presale spots remain for this event.`);

      return;

    }



    setSubmitting(true);

    setError(null);



    const { data: holdData, error: holdError } = await supabase.rpc('reserve_inventory', {

      p_product_id: productId,

      p_event_id: eventId,

      p_customer_id: user.id,

      p_quantity: quantity,

    });



    if (holdError) {

      setSubmitting(false);

      setError(holdError.message);

      return;

    }



    const holdResult = holdData as ReserveInventoryResult;

    if (!holdResult?.success || !holdResult.hold_id) {

      setSubmitting(false);

      setError(holdResult?.error ?? 'Could not reserve inventory.');

      return;

    }



    const holdId = holdResult.hold_id;



    const { data: orderId, error: rpcError } = await supabase.rpc('create_reservation', {

      p_product_id: productId,

      p_event_id: eventId,

      p_quantity: quantity,

      p_notes: notes.trim() || null,

      p_hold_id: holdId,

    });



    if (rpcError) {

      await supabase.rpc('release_inventory_hold', { p_hold_id: holdId });

      setSubmitting(false);

      setError(rpcError.message);

      return;

    }



    const { data: confirmData, error: confirmError } = await supabase.rpc(

      'confirm_reservation_hold',

      {

        p_order_id: orderId as string,

        p_hold_id: holdId,

      },

    );



    if (confirmError || !(confirmData as HoldActionResult | null)?.success) {

      await supabase.rpc('release_inventory_hold', { p_hold_id: holdId });

      setSubmitting(false);

      setError(

        (confirmData as HoldActionResult | null)?.error ??

          confirmError?.message ??

          'Reservation created but inventory hold could not be confirmed.',

      );

      return;

    }



    setSubmitting(false);

    router.replace(`/(shopper)/orders/${orderId as string}`);

  }



  const total = product ? product.price * quantity : 0;



  return (

    <>

      <Stack.Screen

        options={{

          headerShown: true,

          title: 'Reserve for pickup',

          headerBackTitle: 'Back',

          ...rootedStackScreenOptions,

        }}

      />

      {loading ? (

        <View className="flex-1 items-center justify-center bg-canvas">

          <LoadingIndicator />

        </View>

      ) : !product || !product.reserve_enabled ? (

        <Screen centered>

          <Text variant="subtitle" className="text-center">

            {error ?? 'This product cannot be reserved.'}

          </Text>

        </Screen>

      ) : (

        <Screen scroll>

          <Text variant="title" className="mb-1">

            {product.name}

          </Text>

          <Text variant="body" className="mb-6 text-muted">

            {formatPrice(product.price)} each · pay at pickup

          </Text>



          <Text variant="heading" className="mb-3">

            Pickup event

          </Text>

          {options.length === 0 ? (

            <Text variant="caption" className="mb-6">

              No presale availability right now. Check back later.

            </Text>

          ) : (

            <View className="mb-6 gap-3">

              {options.map((opt) =>

                opt.event ? (

                  <Pressable key={opt.event.id} onPress={() => setEventId(opt.event!.id)}>

                    <Card

                      className={`flex-row items-center ${

                        eventId === opt.event.id ? 'border-2 border-primary' : ''

                      }`}>

                      <View className="flex-1 pr-3">

                        <Text variant="body" className="font-semibold">

                          {opt.event.name}

                        </Text>

                        <Text variant="caption" className="mt-0.5">

                          {formatEventFullDate(opt.event.start_datetime)}

                          {opt.event.city ? ` · ${opt.event.city}` : ''}

                        </Text>

                        <Text variant="caption" className="mt-0.5 text-subtle">

                          {effectiveAvailable(opt)} presale available

                        </Text>

                      </View>

                      <FontAwesome

                        name={eventId === opt.event.id ? 'check-circle' : 'circle-o'}

                        size={22}

                        color={eventId === opt.event.id ? '#228B22' : '#9CAF88'}

                      />

                    </Card>

                  </Pressable>

                ) : null,

              )}

            </View>

          )}



          <Text variant="heading" className="mb-3">

            Quantity

          </Text>

          <View className="mb-6 flex-row items-center gap-4">

            <Pressable

              onPress={() => setQuantity((q) => Math.max(1, q - 1))}

              className="h-11 w-11 items-center justify-center rounded-full bg-honeydew">

              <FontAwesome name="minus" size={14} color="#228B22" />

            </Pressable>

            <Text variant="title">{quantity}</Text>

            <Pressable

              onPress={() => setQuantity((q) => (maxQuantity > 0 ? Math.min(maxQuantity, q + 1) : q))}

              disabled={maxQuantity > 0 && quantity >= maxQuantity}

              className="h-11 w-11 items-center justify-center rounded-full bg-honeydew">

              <FontAwesome name="plus" size={14} color="#228B22" />

            </Pressable>

          </View>



          <TextArea

            label="Notes (optional)"

            className="mb-6"

            value={notes}

            onChangeText={setNotes}

            placeholder="Pickup time, allergies, requests..."

            minHeight={80}

          />



          <Card className="mb-4 flex-row items-center justify-between">

            <Text variant="body" className="font-semibold">

              Total (pay at pickup)

            </Text>

            <Text variant="subtitle">{formatPrice(total)}</Text>

          </Card>



          {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}



          <Button

            label="Place reservation"

            loading={submitting}

            disabled={!eventId || maxQuantity < 1}

            onPress={handleSubmit}

          />

        </Screen>

      )}

    </>

  );

}

